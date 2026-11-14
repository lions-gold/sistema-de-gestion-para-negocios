import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares', {
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      const oficial = Array.isArray(data)
        ? data.find((d: { fuente: string }) => d.fuente === 'oficial')
        : null;
      const paralelo = Array.isArray(data)
        ? data.find((d: { fuente: string }) => d.fuente === 'paralelo')
        : null;

      const bcvRate = oficial?.promedio || 896.12;
      const paraleloRate = paralelo?.promedio || 1024.24;

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      return res.status(200).json({
        bcv: Number(bcvRate.toFixed(2)),
        paralelo: Number(paraleloRate.toFixed(2)),
        lastUpdated: oficial?.fechaActualizacion || new Date().toISOString(),
        timestamp: Date.now(),
        cached: false,
      });
    }
  } catch (error) {
    console.error('Vercel BCV API error:', error);
  }

  return res.status(200).json({
    bcv: 896.12,
    paralelo: 1024.24,
    lastUpdated: new Date().toISOString(),
    timestamp: Date.now(),
    cached: false,
  });
}
