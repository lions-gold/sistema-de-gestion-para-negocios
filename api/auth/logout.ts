import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleOpenSourceLogout } from '../../lib/openSourceAuthServer';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }
  return handleOpenSourceLogout(req, res);
}
