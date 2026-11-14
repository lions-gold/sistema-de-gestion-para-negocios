import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleVectorCampaignDraft,
  VectorCampaignDraftPayload,
} from '../../lib/vectorServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const payload = (req.body || {}) as VectorCampaignDraftPayload;
  const result = await handleVectorCampaignDraft(payload, req.headers.authorization);
  if (result && 'status' in result && result.status === 403) {
    return res.status(403).json(result);
  }
  return res.status(200).json(result);
}
