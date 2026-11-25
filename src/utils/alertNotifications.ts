import { Product, EmailAlertConfig, StockAlertEmailLog } from '../types';
import { VENEZUELA_LOCALE, VENEZUELA_TIMEZONE } from './venezuelaTime';

const CONFIG_STORAGE_KEY = 'lions_gold_email_alert_config';
const LOGS_STORAGE_KEY = 'lions_gold_email_alert_logs';

export const DEFAULT_EMAIL_CONFIG: EmailAlertConfig = {
  recipientEmail: 'empresaalhadiqainvest@gmail.com',
  secondaryEmail: 'zambranogonzalezcarlossmith@gmail.com',
  isEnabled: true,
  frequency: 'immediate',
  notifyOnPOS: true,
  notifyOnManualAdjustment: true,
};

let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

// Reusable scanner beep using shared AudioContext (avoids 6-context hardware exhaustion)
export const playScannerBeepSound = (frequency = 1450, durationSec = 0.14, gainLevel = 0.18) => {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // ignore disconnect errors
      }
    };
  } catch {
    // Ignore audio restrictions before user gesture
  }
};

// Play a gentle notification chime using Web Audio API
export const playAlertNotificationSound = () => {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    // Sequence of 2 melodic notes (C5 -> G5)
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      };
    };

    playTone(523.25, 0, 0.16);     // C5
    playTone(783.99, 0.12, 0.28);   // G5
  } catch {
    // AudioContext might be blocked before first user interaction
  }
};

// Trigger mobile haptic vibration
export const triggerMobileVibration = () => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([60, 80, 60]);
    }
  } catch (e) {
    // Ignore unsupported
  }
};

// Load saved config
export const getStoredEmailConfig = (): EmailAlertConfig => {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_EMAIL_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Error reading email alert config from localStorage:', e);
  }
  return DEFAULT_EMAIL_CONFIG;
};

// Save config
export const saveStoredEmailConfig = (config: EmailAlertConfig): void => {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving email alert config to localStorage:', e);
  }
};

// Load logs
export const getStoredEmailLogs = (): StockAlertEmailLog[] => {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading email logs from localStorage:', e);
  }
  return [];
};

// Save logs
export const saveStoredEmailLogs = (logs: StockAlertEmailLog[]): void => {
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 50))); // Keep last 50
  } catch (e) {
    console.error('Error saving email logs to localStorage:', e);
  }
};

// Create and record a simulated email dispatch
export const recordSimulatedEmailDispatch = (
  products: Product[],
  triggerEvent: string,
  config?: EmailAlertConfig,
  customRecipient?: string
): StockAlertEmailLog => {
  const currentConfig = config || getStoredEmailConfig();
  const recipient = customRecipient || currentConfig.recipientEmail;

  const now = new Date();
  const dateStr = now.toLocaleDateString(VENEZUELA_LOCALE, {
    timeZone: VENEZUELA_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subject = products.length === 1
    ? `[ALERTA CRÍTICA] Stock Bajo en Smith Solutions E-Commerce - ${products[0].name}`
    : `[ALERTA CRÍTICA] Stock Bajo en Smith Solutions E-Commerce (${products.length} productos afectados)`;

  const newLog: StockAlertEmailLog = {
    id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: dateStr,
    recipientEmail: recipient,
    subject,
    triggerEvent,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      currentStock: p.stock,
      minStock: p.minStock,
      unit: p.unit,
      costUSD: p.costUSD,
    })),
    status: 'Simulado y Enviado',
  };

  const currentLogs = getStoredEmailLogs();
  const updatedLogs = [newLog, ...currentLogs];
  saveStoredEmailLogs(updatedLogs);

  // Provide tactile/audio feedback
  playAlertNotificationSound();
  triggerMobileVibration();

  return newLog;
};
