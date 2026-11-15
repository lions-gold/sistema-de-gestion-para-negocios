import { readManualOfflineFlag } from '../hooks/usePWAInstall';
import { formatCaracasDateTime } from '../utils/venezuelaTime';

export interface DolarRateResponse {
  moneda: string;
  fuente: string;
  nombre: string;
  compra?: number | null;
  venta?: number | null;
  promedio: number;
  fechaActualizacion: string;
}

export interface BCVRatesState {
  bcv: number;
  paralelo: number;
  lastUpdated: string;
  isLive: boolean;
  activeRateType: 'bcv' | 'paralelo' | 'custom';
}

const BCV_CACHE_KEY = 'smith_offline_bcv_v1';
const FALLBACK_BCV = 896.12;
const FALLBACK_PARALELO = 1024.24;

async function fetchWithTimeout(url: string, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function readCachedBcv(): BCVRatesState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BCV_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BCVRatesState;
    if (typeof parsed.bcv === 'number' && parsed.bcv > 0) return parsed;
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveCachedBcv(rates: BCVRatesState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BCV_CACHE_KEY, JSON.stringify(rates));
  } catch {
    // ignore storage errors
  }
}

/**
 * Fetches real-time BCV and parallel dollar rates, caching locally for offline resilience.
 */
export async function fetchLiveExchangeRates(): Promise<BCVRatesState> {
  // If offline or manual offline mode active, return last locally saved live rate immediately
  if (readManualOfflineFlag() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    const cached = readCachedBcv();
    if (cached) {
      return {
        ...cached,
        isLive: false,
      };
    }
    return {
      bcv: FALLBACK_BCV,
      paralelo: FALLBACK_PARALELO,
      lastUpdated: formatDate(new Date().toISOString()),
      isLive: false,
      activeRateType: 'bcv',
    };
  }

  // Strategy 0: Same-origin server proxy (/api/bcv)
  try {
    const res = await fetchWithTimeout('/api/bcv', 4000);
    if (res.ok) {
      const data = (await res.json()) as Partial<BCVRatesState>;
      if (typeof data.bcv === 'number' && data.bcv > 0) {
        const result: BCVRatesState = {
          bcv: Number(data.bcv.toFixed(2)),
          paralelo: Number((data.paralelo || data.bcv * 1.14).toFixed(2)),
          lastUpdated: data.lastUpdated ? formatDate(data.lastUpdated) : formatDate(new Date().toISOString()),
          isLive: true,
          activeRateType: 'bcv',
        };
        saveCachedBcv(result);
        return result;
      }
    }
  } catch {
    // fallback cleanly on static GH Pages or transient errors
  }

  // Strategy 1: Direct DolarApi Venezuela
  try {
    const res = await fetchWithTimeout('https://ve.dolarapi.com/v1/dolares', 4500);

    if (res.ok) {
      const data: DolarRateResponse[] = await res.json();
      const oficialObj = data.find(
        (d) =>
          d.fuente === 'oficial' ||
          d.nombre.toLowerCase().includes('oficial') ||
          d.nombre.toLowerCase().includes('bcv')
      );
      const paraleloObj = data.find(
        (d) => d.fuente === 'paralelo' || d.nombre.toLowerCase().includes('paralelo')
      );

      const bcvRate = oficialObj?.promedio || FALLBACK_BCV;
      const paraleloRate = paraleloObj?.promedio || FALLBACK_PARALELO;
      const dateStr = oficialObj?.fechaActualizacion || new Date().toISOString();

      const result: BCVRatesState = {
        bcv: Number(bcvRate.toFixed(2)),
        paralelo: Number(paraleloRate.toFixed(2)),
        lastUpdated: formatDate(dateStr),
        isLive: true,
        activeRateType: 'bcv',
      };
      saveCachedBcv(result);
      return result;
    }
  } catch (err) {
    console.warn('DolarApi endpoint 1 failed, trying fallback endpoint...', err);
  }

  // Strategy 2: Single oficial endpoint
  try {
    const res = await fetchWithTimeout('https://ve.dolarapi.com/v1/dolares/oficial', 4500);
    if (res.ok) {
      const data: DolarRateResponse = await res.json();
      const result: BCVRatesState = {
        bcv: Number(data.promedio.toFixed(2)),
        paralelo: Number((data.promedio * 1.14).toFixed(2)),
        lastUpdated: formatDate(data.fechaActualizacion),
        isLive: true,
        activeRateType: 'bcv',
      };
      saveCachedBcv(result);
      return result;
    }
  } catch (err) {
    console.warn('DolarApi oficial single endpoint failed', err);
  }

  // Strategy 3: PyDolarVenezuela API fallback
  try {
    const res = await fetchWithTimeout('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv', 4500);
    if (res.ok) {
      const data = await res.json();
      const price = data?.monitors?.usd?.price || data?.price;
      if (price) {
        const result: BCVRatesState = {
          bcv: Number(Number(price).toFixed(2)),
          paralelo: Number((Number(price) * 1.14).toFixed(2)),
          lastUpdated: formatDate(new Date().toISOString()),
          isLive: true,
          activeRateType: 'bcv',
        };
        saveCachedBcv(result);
        return result;
      }
    }
  } catch (err) {
    console.warn('PyDolar fallback failed', err);
  }

  const cached = readCachedBcv();
  if (cached) {
    return {
      ...cached,
      isLive: false,
    };
  }

  return {
    bcv: FALLBACK_BCV,
    paralelo: FALLBACK_PARALELO,
    lastUpdated: formatDate(new Date().toISOString()),
    isLive: false,
    activeRateType: 'bcv',
  };
}

function formatDate(isoString: string): string {
  return formatCaracasDateTime(isoString);
}
