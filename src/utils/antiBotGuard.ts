// Multi-layer client-side anti-bot guard: honeypot trap, minimum human timing,
// cooldown rate-limiting, and privacy-preserving human verification check.

const SUBMISSION_TIMESTAMPS_KEY = 'smith_antibot_submit_log_v1';

export interface HumanCheckChallenge {
  a: number;
  b: number;
  prompt: string;
  expected: number;
}

export function createHumanCheckChallenge(): HumanCheckChallenge {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * 9);
  return {
    a,
    b,
    prompt: `${a} + ${b}`,
    expected: a + b,
  };
}

export function verifyHumanCheckChallenge(
  challenge: HumanCheckChallenge,
  userAnswer: string
): boolean {
  const cleaned = Number(userAnswer.trim());
  return Number.isFinite(cleaned) && cleaned === challenge.expected;
}

export function isHoneypotTriggered(honeypotValue: string): boolean {
  return honeypotValue.trim().length > 0;
}

export function isTooFastSubmission(mountedAtMs: number, minHumanMs: number = 750): boolean {
  return Date.now() - mountedAtMs < minHumanMs;
}

export function checkSubmissionCooldown(
  actionKey: string,
  cooldownMs: number = 12000,
  maxPerHour: number = 12
): { allowed: boolean; waitSeconds: number } {
  if (typeof window === 'undefined') {
    return { allowed: true, waitSeconds: 0 };
  }
  try {
    const raw = sessionStorage.getItem(SUBMISSION_TIMESTAMPS_KEY);
    const map: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const history = Array.isArray(map[actionKey])
      ? map[actionKey].filter((ts) => now - ts < 60 * 60 * 1000)
      : [];

    const last = history[history.length - 1];
    if (last && now - last < cooldownMs) {
      return {
        allowed: false,
        waitSeconds: Math.max(1, Math.ceil((cooldownMs - (now - last)) / 1000)),
      };
    }

    if (history.length >= maxPerHour) {
      return {
        allowed: false,
        waitSeconds: 60,
      };
    }

    return { allowed: true, waitSeconds: 0 };
  } catch {
    return { allowed: true, waitSeconds: 0 };
  }
}

export function recordSubmissionTimestamp(actionKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(SUBMISSION_TIMESTAMPS_KEY);
    const map: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const history = Array.isArray(map[actionKey])
      ? map[actionKey].filter((ts) => now - ts < 60 * 60 * 1000)
      : [];
    history.push(now);
    map[actionKey] = history;
    sessionStorage.setItem(SUBMISSION_TIMESTAMPS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota issues
  }
}
