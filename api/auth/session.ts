import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleOpenSourceSession } from '../../lib/openSourceAuthServer';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }
  return handleOpenSourceSession(req, res);
}
