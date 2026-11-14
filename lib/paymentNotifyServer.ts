import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import firebaseConfig from '../firebase-applet-config.json';

const SUPER_ADMIN_EMAIL = 'empresaalhadiqainvest@gmail.com';
const DEFAULT_SUPPORT_WA = '584220273766';

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

async function verifyAuthenticatedUserBearerToken(
  authHeader?: string
): Promise<{ ok: boolean; email?: string; uid?: string }> {
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
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (user && user.emailVerified === true && user.email) {
      return { ok: true, email: user.email, uid: user.localId };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export interface PaymentProofNotifyPayload {
  paymentId: string;
  storeId: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  ownerWhatsapp?: string;
  paymentMethod: string;
  referenceNumber: string;
  amountUSD: number;
  exchangeRate?: number;
  payerInfo?: string;
  notes?: string;
  couponCode?: string;
  discountUSD?: number;
  proofImageUrl?: string;
  supportWhatsapp?: string;
}

export interface PaymentProofNotifyResponse {
  ok: boolean;
  emailSent: boolean;
  deliveryChannel: 'smtp' | 'resend' | 'client_mailto';
  message: string;
  whatsappHref: string;
  mailtoHref: string;
  whatsappText: string;
}

export function buildPaymentVoucherContent(payload: PaymentProofNotifyPayload) {
  const cleanSupportWa =
    (payload.supportWhatsapp || DEFAULT_SUPPORT_WA).replace(/\D/g, '') || DEFAULT_SUPPORT_WA;
  const amountBs =
    payload.exchangeRate && payload.exchangeRate > 0
      ? (payload.amountUSD * payload.exchangeRate).toLocaleString('es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;

  const lines = [
    '*COMPROBANTE DE PAGO DE SUSCRIPCIÓN*',
    'Plataforma: Smith Solutions E-Commerce',
    '-----------------------------------',
    `Tienda: ${payload.storeName} (ID: ${payload.storeId})`,
    `Propietario: ${payload.ownerName}`,
    `Correo cuenta: ${payload.ownerEmail}`,
    payload.ownerWhatsapp ? `WhatsApp tienda: ${payload.ownerWhatsapp}` : '',
    `Comprobante ID: ${payload.paymentId}`,
    `Método de pago: ${payload.paymentMethod}`,
    `Referencia / TxID: ${payload.referenceNumber}`,
    `Monto reportado: $${Number(payload.amountUSD).toFixed(2)} USD${amountBs ? ` (≈ ${amountBs} Bs.)` : ''}`,
    payload.couponCode
      ? `Cupón aplicado: ${payload.couponCode} (-$${Number(payload.discountUSD || 0).toFixed(2)} USD)`
      : '',
    payload.payerInfo ? `Datos pagador: ${payload.payerInfo}` : '',
    payload.notes ? `Notas: ${payload.notes}` : '',
    payload.proofImageUrl ? 'Captura adjunta: Sí (verificada en panel / correo)' : '',
    '-----------------------------------',
    `Fecha: ${new Date().toLocaleString('es-VE')}`,
    'Por favor verificar y activar mi tienda.',
  ].filter(Boolean);

  const voucherText = lines.join('\n');
  const emailSubject = `[COMPROBANTE PAGO] ${payload.storeName} · $${Number(payload.amountUSD).toFixed(2)} USD · Ref: ${payload.referenceNumber}`;
  const whatsappHref = `https://wa.me/${cleanSupportWa}?text=${encodeURIComponent(voucherText)}`;
  const mailtoHref = `mailto:${SUPER_ADMIN_EMAIL}?subject=${encodeURIComponent(
    emailSubject
  )}&body=${encodeURIComponent(voucherText.replace(/\*/g, ''))}`;

  return {
    voucherText,
    emailSubject,
    whatsappHref,
    mailtoHref,
  };
}

export async function handlePaymentProofNotification(
  payload: PaymentProofNotifyPayload,
  authHeader?: string
): Promise<PaymentProofNotifyResponse & { status?: number; error?: string }> {
  const verified = await verifyAuthenticatedUserBearerToken(authHeader);
  if (!verified.ok) {
    return {
      ok: false,
      status: 403,
      error: 'No autorizado. Debes iniciar sesión con tu cuenta verificada de Google.',
      emailSent: false,
      deliveryChannel: 'client_mailto',
      message: 'Autenticación requerida.',
      whatsappHref: '',
      mailtoHref: '',
      whatsappText: '',
    };
  }

  const normalizedPayload: PaymentProofNotifyPayload = {
    ...payload,
    ownerEmail: payload.ownerEmail || verified.email || '',
  };
  const { voucherText, emailSubject, whatsappHref, mailtoHref } =
    buildPaymentVoucherContent(normalizedPayload);

  const plainBody = voucherText.replace(/\*/g, '');
  const htmlSafe = plainBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  const proofDataUri =
    normalizedPayload.proofImageUrl &&
    /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(
      normalizedPayload.proofImageUrl
    )
      ? normalizedPayload.proofImageUrl
      : null;

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#09090b;color:#f4f4f5;padding:24px;border-radius:12px;border:1px solid #27272a;">
      <h2 style="color:#fbbf24;margin-top:0;">Comprobante de Pago — Smith Solutions E-Commerce</h2>
      <div style="background:#111114;padding:16px;border-radius:8px;border:1px solid #27272a;font-size:13px;line-height:1.6;">
        ${htmlSafe}
      </div>
      ${
        proofDataUri
          ? '<p style="margin-top:16px;font-size:12px;color:#a1a1aa;">Captura del comprobante adjunta a este correo.</p>'
          : ''
      }
    </div>
  `;

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

      const attachments = proofDataUri
        ? [
            {
              filename: `comprobante_${normalizedPayload.referenceNumber.replace(/[^a-zA-Z0-9_-]/g, '') || 'pago'}.jpg`,
              content: Buffer.from(proofDataUri.split(',')[1], 'base64'),
            },
          ]
        : [];

      await transporter.sendMail({
        from: `"Smith Solutions Pagos" <${smtpFrom}>`,
        to: SUPER_ADMIN_EMAIL,
        cc:
          normalizedPayload.ownerEmail &&
          normalizedPayload.ownerEmail.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
            ? normalizedPayload.ownerEmail
            : undefined,
        replyTo: normalizedPayload.ownerEmail || SUPER_ADMIN_EMAIL,
        subject: emailSubject,
        text: plainBody,
        html: htmlBody,
        attachments,
      });

      return {
        ok: true,
        emailSent: true,
        deliveryChannel: 'smtp',
        message: `Comprobante enviado por correo SMTP al Administrador (${SUPER_ADMIN_EMAIL}) y copia al usuario.`,
        whatsappHref,
        mailtoHref,
        whatsappText: voucherText,
      };
    } catch (err) {
      console.error('SMTP payment notification error:', err);
    }
  }

  // Option 2: Resend API
  if (resendApiKey) {
    try {
      const resendAttachments = proofDataUri
        ? [
            {
              filename: `comprobante_${normalizedPayload.referenceNumber.replace(/[^a-zA-Z0-9_-]/g, '') || 'pago'}.jpg`,
              content: proofDataUri.split(',')[1],
            },
          ]
        : undefined;

      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.SMTP_FROM || 'Smith Solutions <onboarding@resend.dev>',
          to: [SUPER_ADMIN_EMAIL],
          cc:
            normalizedPayload.ownerEmail &&
            normalizedPayload.ownerEmail.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
              ? [normalizedPayload.ownerEmail]
              : undefined,
          reply_to: normalizedPayload.ownerEmail || SUPER_ADMIN_EMAIL,
          subject: emailSubject,
          text: plainBody,
          html: htmlBody,
          attachments: resendAttachments,
        }),
      });

      if (resendResp.ok) {
        return {
          ok: true,
          emailSent: true,
          deliveryChannel: 'resend',
          message: `Comprobante enviado vía Resend API al Administrador (${SUPER_ADMIN_EMAIL}).`,
          whatsappHref,
          mailtoHref,
          whatsappText: voucherText,
        };
      }
    } catch (err) {
      console.error('Resend API payment notification error:', err);
    }
  }

  // Option 3: Fallback using prefilled Gmail/mailto + WhatsApp voucher
  return {
    ok: true,
    emailSent: false,
    deliveryChannel: 'client_mailto',
    message:
      'Comprobante guardado en Firestore. Usa el botón de Correo y WhatsApp para enviar el respaldo directo al Administrador.',
    whatsappHref,
    mailtoHref,
    whatsappText: voucherText,
  };
}
