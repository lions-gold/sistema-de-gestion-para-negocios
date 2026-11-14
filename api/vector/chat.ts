import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleVectorChat, VectorChatPayload } from '../../lib/vectorServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const payload = (req.body || {}) as VectorChatPayload;
  const result = await handleVectorChat(payload, req.headers.authorization);
  return res.status(200).json(result);
}
