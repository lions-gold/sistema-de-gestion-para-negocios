import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleVectorTTS, VectorTTSPayload } from '../../lib/vectorServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const payload = (req.body || {}) as VectorTTSPayload;
  const result = await handleVectorTTS(payload);
  return res.status(200).json(result);
}
