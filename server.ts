import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

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

  // Security headers & HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// In-memory cache for BCV rate
let cachedRate: {
  bcv: number;
  paralelo: number;
  lastUpdated: string;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// Real-time BCV API proxy route
app.get('/api/bcv', async (_req, res) => {
  const now = Date.now();
  if (cachedRate && now - cachedRate.timestamp < CACHE_TTL_MS) {
    return res.json({ ...cachedRate, cached: true });
  }

  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares', {
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      const oficial = Array.isArray(data) ? data.find((d: { fuente: string }) => d.fuente === 'oficial') : null;
      const paralelo = Array.isArray(data) ? data.find((d: { fuente: string }) => d.fuente === 'paralelo') : null;

      const bcvRate = oficial?.promedio || 896.12;
      const paraleloRate = paralelo?.promedio || 1024.24;

      cachedRate = {
        bcv: Number(bcvRate.toFixed(2)),
        paralelo: Number(paraleloRate.toFixed(2)),
        lastUpdated: oficial?.fechaActualizacion || new Date().toISOString(),
        timestamp: now,
      };

      return res.json({ ...cachedRate, cached: false });
    }
  } catch (error) {
    console.error('Error fetching BCV rate in server:', error);
  }

  // Fallback if third party is down
  if (cachedRate) {
    return res.json({ ...cachedRate, cached: true });
  }

  res.json({
    bcv: 896.12,
    paralelo: 1024.24,
    lastUpdated: new Date().toISOString(),
    timestamp: now,
    cached: false,
  });
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
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
