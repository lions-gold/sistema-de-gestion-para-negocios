import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleVerifySmtpConnection,
  VerifySmtpPayload,
} from '../../lib/storeEmailServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const result = await handleVerifySmtpConnection(
      (req.body || {}) as VerifySmtpPayload,
      req.headers.authorization
    );
    if (result.status && result.status >= 400) {
      return res.status(result.status).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('Vercel /api/stores/verify-smtp error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error interno al verificar la conexión SMTP en el servidor.',
      error: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    });
  }
}
