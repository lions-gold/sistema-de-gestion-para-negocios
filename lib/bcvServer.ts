import https from 'node:https';

export interface OfficialBCVPayload {
  bcv: number;
  bcvExact?: number;
  paralelo: number;
  lastUpdated: string;
  fechaValor?: string;
  source: string;
  timestamp: number;
  cached?: boolean;
}

const DEFAULT_FALLBACK_BCV = 916.65;
const DEFAULT_FALLBACK_PARALELO = 1072.46;

function parseVenezuelanNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return null;
  // Venezuelan format: 1.234,5678 -> remove thousand dots, convert decimal comma to dot
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num) || num <= 1 || num > 1_000_000) return null;
  return num;
}

function fetchBcvOfficialHtml(timeoutMs = 4500): Promise<{ rate: number; fechaValor?: string } | null> {
  return new Promise((resolve) => {
    const req = https.request(
      'https://www.bcv.org.ve/',
      {
        method: 'GET',
        timeout: timeoutMs,
        // bcv.org.ve often omits its intermediate CA certificate on Linux trust stores
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmithSolutionsBCVSync/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 400) {
          res.resume();
          resolve(null);
          return;
        }
        let html = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          html += chunk;
          if (html.length > 512 * 1024) {
            req.destroy();
          }
        });
        res.on('end', () => {
          const dolarMatch = html.match(/id="dolar"[\s\S]{0,600}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i);
          if (!dolarMatch) {
            resolve(null);
            return;
          }
          const parsedRate = parseVenezuelanNumber(dolarMatch[1]);
          if (!parsedRate) {
            resolve(null);
            return;
          }
          const fechaMatch = html.match(/Fecha\s+Valor:\s*<span[^>]*content="([^"]+)"/i);
          resolve({
            rate: parsedRate,
            fechaValor: fechaMatch?.[1],
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => {
      resolve(null);
    });
    req.end();
  });
}

async function fetchDolarApiRates(timeoutMs = 4500): Promise<{
  oficial?: number;
  oficialExact?: number;
  paralelo?: number;
  fechaActualizacion?: string;
} | null> {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data)) return null;

    const oficial = data.find(
      (d: { fuente?: string; nombre?: string }) =>
        d.fuente === 'oficial' ||
        d.nombre?.toLowerCase().includes('oficial') ||
        d.nombre?.toLowerCase().includes('bcv')
    );
    const paralelo = data.find(
      (d: { fuente?: string; nombre?: string }) =>
        d.fuente === 'paralelo' || d.nombre?.toLowerCase().includes('paralelo')
    );

    const oficialNum = typeof oficial?.promedio === 'number' && oficial.promedio > 1 ? oficial.promedio : undefined;
    const paraleloNum = typeof paralelo?.promedio === 'number' && paralelo.promedio > 1 ? paralelo.promedio : undefined;

    return {
      oficial: oficialNum ? Number(oficialNum.toFixed(2)) : undefined,
      oficialExact: oficialNum,
      paralelo: paraleloNum ? Number(paraleloNum.toFixed(2)) : undefined,
      fechaActualizacion: oficial?.fechaActualizacion,
    };
  } catch {
    return null;
  }
}

export async function fetchOfficialBCVData(
  previousCached?: OfficialBCVPayload | null
): Promise<OfficialBCVPayload> {
  const now = Date.now();
  const [bcvSiteRes, dolarApiRes] = await Promise.allSettled([
    fetchBcvOfficialHtml(4500),
    fetchDolarApiRates(4500),
  ]);

  const bcvSite = bcvSiteRes.status === 'fulfilled' ? bcvSiteRes.value : null;
  const dolarApi = dolarApiRes.status === 'fulfilled' ? dolarApiRes.value : null;

  const exactRate = bcvSite?.rate || dolarApi?.oficialExact || previousCached?.bcvExact || DEFAULT_FALLBACK_BCV;
  const bcvRounded = bcvSite?.rate
    ? Number(bcvSite.rate.toFixed(2))
    : dolarApi?.oficial || previousCached?.bcv || DEFAULT_FALLBACK_BCV;
  const paraleloRounded =
    dolarApi?.paralelo ||
    previousCached?.paralelo ||
    Number((bcvRounded * 1.17).toFixed(2)) ||
    DEFAULT_FALLBACK_PARALELO;

  const source = bcvSite?.rate
    ? 'BCV Oficial (bcv.org.ve)'
    : dolarApi?.oficial
      ? 'DolarApi Oficial (BCV)'
      : previousCached?.source || 'Respaldo BCV';

  const lastUpdated =
    bcvSite?.fechaValor ||
    dolarApi?.fechaActualizacion ||
    previousCached?.lastUpdated ||
    new Date().toISOString();

  return {
    bcv: bcvRounded,
    bcvExact: Number(exactRate.toFixed(4)),
    paralelo: paraleloRounded,
    lastUpdated,
    fechaValor: bcvSite?.fechaValor || dolarApi?.fechaActualizacion,
    source,
    timestamp: now,
    cached: false,
  };
}
