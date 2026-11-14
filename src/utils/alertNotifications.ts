import { Product, EmailAlertConfig, StockAlertEmailLog } from '../types';

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

// Play a gentle notification chime using Web Audio API
export const playAlertNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Sequence of 2 melodic notes (C5 -> G5)
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    playTone(523.25, 0, 0.16);     // C5
    playTone(783.99, 0.12, 0.28);   // G5
  } catch (e) {
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
  const dateStr = now.toLocaleDateString('es-VE', {
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
