import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthBackupSyncPayload, handleAuthBackupSync } from '../../lib/authSyncServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const body = (req.body || {}) as AuthBackupSyncPayload;
  const result = await handleAuthBackupSync(req.headers.authorization, body);
  return res.status(result.statusCode).json(result.body);
}
