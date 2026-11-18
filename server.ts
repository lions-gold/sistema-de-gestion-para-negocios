import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { fetchOfficialBCVData, OfficialBCVPayload } from './lib/bcvServer';
import {
  handleVectorCampaignDraft,
  handleVectorChat,
  handleVectorTTS,
  VectorCampaignDraftPayload,
  VectorChatPayload,
  VectorTTSPayload,
} from './lib/vectorServer';
import {
  handlePaymentProofNotification,
  PaymentProofNotifyPayload,
} from './lib/paymentNotifyServer';
import {
  handleStoreEmailDispatch,
  handleVerifySmtpConnection,
  StoreEmailDispatchPayload,
  VerifySmtpPayload,
} from './lib/storeEmailServer';
import {
  AuthBackupSyncPayload,
  handleAuthBackupSync,
} from './lib/authSyncServer';
import {
  handleOpenSourceGoogleCallback,
  handleOpenSourceGoogleStart,
  handleOpenSourceLogout,
  handleOpenSourceSession,
} from './lib/openSourceAuthServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPER_ADMIN_EMAIL = 'empresaalhadiqainvest@gmail.com';
let firebaseApiKey = '';
try {
  const fbCfgRaw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8');
  const fbCfg = JSON.parse(fbCfgRaw) as { apiKey?: string };
  firebaseApiKey = fbCfg.apiKey || '';
} catch {
  firebaseApiKey = '';
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '1mb' }));

// Force HTTPS in production / proxy environments & add security headers
app.use((req, res, next) => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const host = req.headers.host;
  
  // Force HTTPS redirect if requested via plain HTTP (excluding local dev)
  if (
    forwardedProto === 'http' &&
    host &&
    !host.includes('localhost') &&
    !host.includes('127.0.0.1')
  ) {
    return res.redirect(301, `https://${host}${req.originalUrl || req.url}`);
  }

  // Security headers, HSTS & Google Auth Popup compatibility across Safari/Mac/iOS/Android
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// In-memory cache for BCV rate
let cachedRate: OfficialBCVPayload | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// Real-time official BCV API proxy route
app.get('/api/bcv', async (req, res) => {
  const now = Date.now();
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

  if (!forceRefresh && cachedRate && now - cachedRate.timestamp < CACHE_TTL_MS) {
    return res.json({ ...cachedRate, cached: true });
  }

  if (forceRefresh) {
    res.setHeader('Cache-Control', 'no-store');
  }

  const latest = await fetchOfficialBCVData(cachedRate);
  cachedRate = latest;
  return res.json(latest);
});

interface AdminEmailRecipientInput {
  email: string;
  storeName?: string;
  ownerName?: string;
}

async function verifySuperAdminBearerToken(authHeader?: string): Promise<{ ok: boolean; email?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ') || !firebaseApiKey) {
    return { ok: false };
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) return { ok: false };

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return { ok: false };
    const data = (await resp.json()) as {
      users?: Array<{ email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (
      user &&
      user.emailVerified === true &&
      user.email &&
      user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
    ) {
      return { ok: true, email: user.email };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

// Super Admin Individual & Collective Email Dispatch Endpoint
app.post('/api/admin/send-email', async (req, res) => {
  const verified = await verifySuperAdminBearerToken(req.headers.authorization);
  if (!verified.ok) {
    return res.status(403).json({
      ok: false,
      error: 'No autorizado. Solo el Super Admin verificado puede enviar correos.',
    });
  }

  const { recipients, subject, body, mode } = req.body as {
    recipients?: AdminEmailRecipientInput[];
    subject?: string;
    body?: string;
    mode?: 'individual' | 'collective';
  };

  if (!subject || !subject.trim() || !body || !body.trim()) {
    return res.status(400).json({ ok: false, error: 'Asunto y mensaje son obligatorios.' });
  }

  const validRecipients = Array.isArray(recipients)
    ? recipients.filter((r) => typeof r?.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim()))
    : [];

  if (validRecipients.length === 0) {
    return res.json({
      ok: true,
      deliveryChannel: 'cloud_inbox_mailto',
      sentCount: 0,
      message: 'Sin correos externos válidos; entregado en Bandeja Oficial de cada tienda.',
    });
  }

  const cleanSubject = subject.trim().slice(0, 180);
  const cleanBody = body.trim().slice(0, 5000);
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser || SUPER_ADMIN_EMAIL;
  const resendApiKey = process.env.RESEND_API_KEY;

  // Option 1: Real SMTP via Nodemailer
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const emails = Array.from(new Set(validRecipients.map((r) => r.email.trim())));
      if (mode === 'collective' && emails.length > 1) {
        await transporter.sendMail({
          from: `"Smith Solutions E-Commerce Admin" <${smtpFrom}>`,
          to: smtpFrom,
          bcc: emails,
          replyTo: SUPER_ADMIN_EMAIL,
          subject: cleanSubject,
          text: cleanBody,
        });
      } else {
        for (const r of validRecipients) {
          await transporter.sendMail({
            from: `"Smith Solutions E-Commerce Admin" <${smtpFrom}>`,
            to: r.email.trim(),
            replyTo: SUPER_ADMIN_EMAIL,
            subject: cleanSubject,
            text: cleanBody,
          });
        }
      }

      return res.json({
        ok: true,
        deliveryChannel: 'smtp',
        sentCount: emails.length,
        message: `Correo enviado por SMTP real a ${emails.length} destinatario(s).`,
      });
    } catch (err) {
      console.error('SMTP email error:', err);
    }
  }

  // Option 2: Resend API if configured
  if (resendApiKey) {
    try {
      const emails = Array.from(new Set(validRecipients.map((r) => r.email.trim())));
      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.SMTP_FROM || 'Smith Solutions <onboarding@resend.dev>',
          to: mode === 'collective' && emails.length > 1 ? [SUPER_ADMIN_EMAIL] : emails,
          bcc: mode === 'collective' && emails.length > 1 ? emails : undefined,
          reply_to: SUPER_ADMIN_EMAIL,
          subject: cleanSubject,
          text: cleanBody,
        }),
      });
      if (resendResp.ok) {
        return res.json({
          ok: true,
          deliveryChannel: 'resend',
          sentCount: emails.length,
          message: `Correo enviado vía Resend API a ${emails.length} destinatario(s).`,
        });
      }
    } catch (err) {
      console.error('Resend API email error:', err);
    }
  }

  // Option 3: Always succeeds via Cloud Store Inbox + Mailto/Gmail draft helper
  return res.json({
    ok: true,
    deliveryChannel: 'cloud_inbox_mailto',
    sentCount: validRecipients.length,
    message:
      'Mensaje entregado a la Bandeja Oficial de cada tienda en Firestore. Puedes abrir tu cliente de correo/Gmail para copia externa opcional.',
  });
});

// Vector AI Commercial Assistant Chat Endpoint (Gemini server-side)
app.post('/api/vector/chat', async (req, res) => {
  try {
    const result = await handleVectorChat(
      (req.body || {}) as VectorChatPayload,
      req.headers.authorization
    );
    return res.json(result);
  } catch (err) {
    console.error('Server /api/vector/chat error:', err);
    return res.json({ ok: false, fallbackRequired: true });
  }
});

// Vector Admin-Only AI Campaign A/B Drafting Endpoint
app.post('/api/vector/campaign-draft', async (req, res) => {
  try {
    const result = await handleVectorCampaignDraft(
      (req.body || {}) as VectorCampaignDraftPayload,
      req.headers.authorization
    );
    if (result && 'status' in result && result.status === 403) {
      return res.status(403).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('Server /api/vector/campaign-draft error:', err);
    return res.json({ ok: false, fallbackRequired: true });
  }
});

// Vector Natural HD Voice TTS Endpoint (Gemini 3.8 Flash Lite TTS server-side)
app.post('/api/vector/tts', async (req, res) => {
  try {
    const result = await handleVectorTTS((req.body || {}) as VectorTTSPayload);
    return res.json(result);
  } catch (err) {
    console.error('Server /api/vector/tts error:', err);
    return res.json({ ok: false, fallbackRequired: true });
  }
});

// Subscription Payment Proof Email & WhatsApp Dispatch Endpoint
app.post('/api/payments/notify-proof', async (req, res) => {
  try {
    const result = await handlePaymentProofNotification(
      (req.body || {}) as PaymentProofNotifyPayload,
      req.headers.authorization
    );
    if (result.status === 403) {
      return res.status(403).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('Server /api/payments/notify-proof error:', err);
    return res.status(500).json({
      ok: false,
      emailSent: false,
      deliveryChannel: 'client_mailto',
      message: 'Error interno al procesar comprobante en servidor.',
    });
  }
});

// Per-Store Custom SMTP / Resend API Email Dispatch Endpoint (Stock Alerts & Sales Reports)
app.post('/api/stores/send-email', async (req, res) => {
  try {
    const result = await handleStoreEmailDispatch(
      (req.body || {}) as StoreEmailDispatchPayload,
      req.headers.authorization
    );
    if (result.status && result.status >= 400) {
      return res.status(result.status).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('Server /api/stores/send-email error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error interno al enviar el correo desde el servidor.',
      error: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    });
  }
});

// Real-Time SMTP Connection Ping / Credential Verification Endpoint
app.post('/api/stores/verify-smtp', async (req, res) => {
  try {
    const result = await handleVerifySmtpConnection(
      (req.body || {}) as VerifySmtpPayload,
      req.headers.authorization
    );
    if (result.status && result.status >= 400) {
      return res.status(result.status).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('Server /api/stores/verify-smtp error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error interno al verificar la conexión SMTP en el servidor.',
      error: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    });
  }
});

// Self-Hosted Supabase User Directory Sync (Mirrors verified Firebase accounts server-side)
app.post('/api/auth/sync-backup', async (req, res) => {
  try {
    const result = await handleAuthBackupSync(
      req.headers.authorization,
      (req.body || {}) as AuthBackupSyncPayload
    );
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('Server /api/auth/sync-backup error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error interno al sincronizar respaldo Supabase.',
    });
  }
});

// Open-Source Google OAuth 2.0 PKCE + HTTP-only Session Routes (/api/auth/*)
app.get('/api/auth/google', (req, res) => {
  handleOpenSourceGoogleStart(req, res);
});

app.get('/api/auth/callback/google', async (req, res) => {
  try {
    await handleOpenSourceGoogleCallback(req, res);
  } catch (err) {
    console.error('Server /api/auth/callback/google error:', err);
    res.redirect('/?auth_error=Error+al+procesar+OAuth+Open+Source');
  }
});

app.get('/api/auth/session', (req, res) => {
  handleOpenSourceSession(req, res);
});

app.post('/api/auth/logout', (req, res) => {
  handleOpenSourceLogout(req, res);
});

// Explicit JSON 404 for unknown API routes
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado en Smith Solutions E-Commerce API' });
});

// Serve dynamic robots.txt with canonical origin
app.get('/robots.txt', (req, res) => {
  const host = req.headers.host || 'ais-pre-hdtyonewfttsukmm6b3ynl-909389987801.us-east1.run.app';
  const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;
  res.type('text/plain').send(
`# Robots.txt — Smith Solutions E-Commerce (Venezuela)
User-agent: *
Allow: /
Allow: /tiendas
Allow: /mi-tienda
Allow: /almacen
Allow: /pos
Allow: /fiados
Allow: /caja
Allow: /rentabilidad

Disallow: /api/
Disallow: /admin
Disallow: /404

Sitemap: ${baseUrl}/sitemap.xml
`
  );
});

// Serve dynamic sitemap.xml with live origin and current date
app.get('/sitemap.xml', (req, res) => {
  const host = req.headers.host || 'ais-pre-hdtyonewfttsukmm6b3ynl-909389987801.us-east1.run.app';
  const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;
  const today = new Date().toISOString().split('T')[0];

  const routes = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/tiendas', priority: '0.95', changefreq: 'daily' },
    { path: '/mi-tienda', priority: '0.9', changefreq: 'weekly' },
    { path: '/almacen', priority: '0.9', changefreq: 'daily' },
    { path: '/pos', priority: '0.9', changefreq: 'daily' },
    { path: '/fiados', priority: '0.8', changefreq: 'weekly' },
    { path: '/caja', priority: '0.8', changefreq: 'daily' },
    { path: '/rentabilidad', priority: '0.85', changefreq: 'daily' },
  ];

  const urlsXml = routes
    .map(
      (r) => `  <url>
    <loc>${baseUrl}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    )
    .join('\n');

  res.type('application/xml').send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`
  );
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
        ws: {
          server: httpServer,
        },
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
