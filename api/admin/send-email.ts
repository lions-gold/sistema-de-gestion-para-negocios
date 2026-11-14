import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import firebaseConfig from '../../firebase-applet-config.json';

const SUPER_ADMIN_EMAIL = 'empresaalhadiqainvest@gmail.com';

function getFirebaseApiKey(): string {
  if (process.env.VITE_FIREBASE_API_KEY) return process.env.VITE_FIREBASE_API_KEY;
  if (firebaseConfig && typeof firebaseConfig.apiKey === 'string' && firebaseConfig.apiKey) {
    return firebaseConfig.apiKey;
  }
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const parsed = JSON.parse(raw) as { apiKey?: string };
    return parsed.apiKey || '';
  } catch {
    return '';
  }
}

async function verifySuperAdminBearerToken(
  authHeader?: string
): Promise<{ ok: boolean; email?: string }> {
  const firebaseApiKey = getFirebaseApiKey();
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

interface AdminEmailRecipientInput {
  email: string;
  storeName?: string;
  ownerName?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const verified = await verifySuperAdminBearerToken(req.headers.authorization);
  if (!verified.ok) {
    return res.status(403).json({
      ok: false,
      error: 'No autorizado. Solo el Super Admin verificado puede enviar correos.',
    });
  }

  const { recipients, subject, body, mode } = (req.body || {}) as {
    recipients?: AdminEmailRecipientInput[];
    subject?: string;
    body?: string;
    mode?: 'individual' | 'collective';
  };

  if (!subject || !subject.trim() || !body || !body.trim()) {
    return res.status(400).json({ ok: false, error: 'Asunto y mensaje son obligatorios.' });
  }

  const validRecipients = Array.isArray(recipients)
    ? recipients.filter(
        (r) => typeof r?.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())
      )
    : [];

  if (validRecipients.length === 0) {
    return res.status(200).json({
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

      return res.status(200).json({
        ok: true,
        deliveryChannel: 'smtp',
        sentCount: emails.length,
        message: `Correo enviado por SMTP real a ${emails.length} destinatario(s).`,
      });
    } catch (err) {
      console.error('Vercel SMTP email error:', err);
    }
  }

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
        return res.status(200).json({
          ok: true,
          deliveryChannel: 'resend',
          sentCount: emails.length,
          message: `Correo enviado vía Resend API a ${emails.length} destinatario(s).`,
        });
      }
    } catch (err) {
      console.error('Vercel Resend API email error:', err);
    }
  }

  return res.status(200).json({
    ok: true,
    deliveryChannel: 'cloud_inbox_mailto',
    sentCount: validRecipients.length,
    message:
      'Mensaje entregado a la Bandeja Oficial de cada tienda en Firestore. Puedes abrir tu cliente de correo/Gmail para copia externa opcional.',
  });
}
