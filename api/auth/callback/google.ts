import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleOpenSourceGoogleCallback } from '../../../lib/openSourceAuthServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }
  return handleOpenSourceGoogleCallback(req, res);
}
