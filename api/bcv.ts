import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchOfficialBCVData } from '../lib/bcvServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const latest = await fetchOfficialBCVData();

  if (forceRefresh) {
    res.setHeader('Cache-Control', 'no-store');
  } else {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  }

  return res.status(200).json(latest);
}
