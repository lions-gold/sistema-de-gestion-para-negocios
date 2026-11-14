import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handlePaymentProofNotification,
  PaymentProofNotifyPayload,
} from '../../lib/paymentNotifyServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const result = await handlePaymentProofNotification(
      (req.body || {}) as PaymentProofNotifyPayload,
      req.headers.authorization
    );
    if (result.status === 403) {
      return res.status(403).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('Vercel /api/payments/notify-proof error:', err);
    return res.status(500).json({
      ok: false,
      emailSent: false,
      deliveryChannel: 'client_mailto',
      message: 'No se pudo procesar el envío en servidor; usa envío directo por Correo/WhatsApp.',
    });
  }
}
