import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleStoreEmailDispatch,
  StoreEmailDispatchPayload,
} from '../../lib/storeEmailServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const result = await handleStoreEmailDispatch(
      (req.body || {}) as StoreEmailDispatchPayload,
      req.headers.authorization
    );
    if (result.status && result.status >= 400) {
      return res.status(result.status).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('Vercel /api/stores/send-email error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error interno al enviar el correo desde el servidor.',
      error: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    });
  }
}
