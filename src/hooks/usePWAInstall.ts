import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios' | 'mac' | 'android' | 'desktop';

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platformStr = typeof navigator !== 'undefined' ? navigator.platform || '' : '';
  const maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;

  // Detect iPhone, iPad (including iPadOS 13+ reporting MacIntel with touch points), or iPod
  const isIOS =
    typeof window !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(ua) || (platformStr === 'MacIntel' && maxTouchPoints > 1)) &&
    !(window as { MSStream?: unknown }).MSStream;

  const isAndroid = /Android/i.test(ua);
  const isMac = !isIOS && (/Macintosh|Mac OS X/i.test(ua) || /Mac/i.test(platformStr));
  const isSafari =
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg|EdgiOS|EdgA|OPR|Firefox|FxiOS|SamsungBrowser/i.test(ua);
  const isInAppBrowser = /FBAN|FBAV|Instagram|WhatsApp|BytedanceWebview|TikTok/i.test(ua);

  const platform: InstallPlatform = isIOS
    ? 'ios'
    : isMac
      ? 'mac'
      : isAndroid
        ? 'android'
        : 'desktop';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone]);

  const promptInstall = async (): Promise<boolean> => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      return true;
    }
    return false;
  };

  return {
    canInstall: Boolean(installPrompt) && !isInstalled && !isStandalone,
    isInstalled: isInstalled || isStandalone,
    isIOS: isIOS && !isStandalone,
    isMac: isMac && !isStandalone,
    isAndroid: isAndroid && !isStandalone,
    isSafari,
    isInAppBrowser,
    platform,
    promptInstall,
  };
}

const MANUAL_OFFLINE_KEY = 'smith_manual_offline_mode_v1';
const OFFLINE_MODE_EVENT = 'smith:offline-mode-changed';

export function readManualOfflineFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(MANUAL_OFFLINE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeManualOfflineFlag(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MANUAL_OFFLINE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(OFFLINE_MODE_EVENT, { detail: { enabled } }));
  } catch {
    // ignore storage errors
  }
}

export function useOnlineStatus() {
  const [isNavigatorOnline, setIsNavigatorOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isManualOffline, setIsManualOfflineState] = useState<boolean>(() =>
    readManualOfflineFlag()
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsNavigatorOnline(true);
      if (!readManualOfflineFlag()) {
        setWasOffline(true);
        setTimeout(() => setWasOffline(false), 6000);
      }
    };

    const handleOffline = () => {
      setIsNavigatorOnline(false);
    };

    const handleManualToggle = () => {
      const next = readManualOfflineFlag();
      setIsManualOfflineState(next);
      if (!next && navigator.onLine) {
        setWasOffline(true);
        setTimeout(() => setWasOffline(false), 6000);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === MANUAL_OFFLINE_KEY) {
        handleManualToggle();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_MODE_EVENT, handleManualToggle);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_MODE_EVENT, handleManualToggle);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setManualOffline = (enabled: boolean) => {
    writeManualOfflineFlag(enabled);
  };

  return {
    isOnline: isNavigatorOnline && !isManualOffline,
    isNavigatorOnline,
    isManualOffline,
    setManualOffline,
    wasOffline,
  };
}
