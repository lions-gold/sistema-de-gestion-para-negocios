import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleOpenSourceGoogleStart } from '../../lib/openSourceAuthServer';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }
  return handleOpenSourceGoogleStart(req, res);
}
