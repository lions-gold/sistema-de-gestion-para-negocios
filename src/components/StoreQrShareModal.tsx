import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  Palette,
  QrCode,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { StoreTenant } from '../types';
import { useSubsectionTranslation } from './LanguageSettings';
import {
  buildSocialShareIntents,
  getSocialPlatformEntries,
  getStoreShareUrl,
  getStoreSubdomainDisplay,
  isSafeHttpUrl,
  normalizeStoreSubdomainSlug,
} from '../utils/socialLinks';

export type StoreQrThemeKey = 'obsidian' | 'ivory' | 'emerald' | 'cobalt';

interface QrThemeConfig {
  key: StoreQrThemeKey;
  labelEs: string;
  labelEn: string;
  labelZh: string;
  bg: string;
  card: string;
  border: string;
  accent: string;
  text: string;
  muted: string;
  qrDark: string;
  swatchClass: string;
}

const QR_CARD_THEMES: QrThemeConfig[] = [
  {
    key: 'obsidian',
    labelEs: 'Obsidiana Oro',
    labelEn: 'Obsidian Gold',
    labelZh: '黑曜石金',
    bg: '#09090b',
    card: '#131318',
    border: '#3f3f46',
    accent: '#f59e0b',
    text: '#fafafa',
    muted: '#a1a1aa',
    qrDark: '#09090b',
    swatchClass: 'bg-zinc-950 border-amber-400',
  },
  {
    key: 'ivory',
    labelEs: 'Marfil Editorial',
    labelEn: 'Editorial Ivory',
    labelZh: '象牙极简',
    bg: '#f5f5f4',
    card: '#ffffff',
    border: '#d6d3d1',
    accent: '#b45309',
    text: '#18181b',
    muted: '#57534e',
    qrDark: '#18181b',
    swatchClass: 'bg-stone-100 border-amber-700',
  },
  {
    key: 'emerald',
    labelEs: 'Esmeralda',
    labelEn: 'Emerald',
    labelZh: '翡翠绿',
    bg: '#041b15',
    card: '#082c22',
    border: '#10b981',
    accent: '#34d399',
    text: '#f0fdf4',
    muted: '#a7f3d0',
    qrDark: '#064e3b',
    swatchClass: 'bg-emerald-950 border-emerald-400',
  },
  {
    key: 'cobalt',
    labelEs: 'Cobalto Nocturno',
    labelEn: 'Midnight Cobalt',
    labelZh: '深海蓝',
    bg: '#090e1a',
    card: '#111827',
    border: '#38bdf8',
    accent: '#38bdf8',
    text: '#f8fafc',
    muted: '#94a3b8',
    qrDark: '#0f172a',
    swatchClass: 'bg-slate-900 border-sky-400',
  },
];

interface StoreQrShareModalProps {
  isOpen: boolean;
  store: StoreTenant | null;
  onClose: () => void;
  onVisitStore?: (store: StoreTenant) => void;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines.slice(0, 3);
}

function loadCorsSafeImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 3000);
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const probe = document.createElement('canvas');
        probe.width = 4;
        probe.height = 4;
        const pCtx = probe.getContext('2d');
        if (!pCtx) {
          resolve(null);
          return;
        }
        pCtx.drawImage(img, 0, 0, 4, 4);
        probe.toDataURL('image/png');
        resolve(img);
      } catch {
        // External host lacks CORS headers; gracefully fall back to store monogram emblem
        resolve(null);
      }
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function getStoreInitials(name: string): string {
  const parts = (name || 'SS')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export const StoreQrShareModal: React.FC<StoreQrShareModalProps> = ({
  isOpen,
  store,
  onClose,
  onVisitStore,
}) => {
  const { lang, tr } = useSubsectionTranslation('common');
  const [selectedTheme, setSelectedTheme] = useState<StoreQrThemeKey>('obsidian');
  const [includeEmblem, setIncludeEmblem] = useState(true);
  const [customTagline, setCustomTagline] = useState('');
  const [posterDataUrl, setPosterDataUrl] = useState<string>('');
  const [soloQrDataUrl, setSoloQrDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const defaultTagline = useMemo(
    () =>
      tr(
        'Escanea con tu cámara para ver nuestro catálogo y comprar en línea',
        'Scan with your camera to browse our catalog & shop online',
        '使用手机相机扫码，立即浏览专属店铺并在线下单'
      ),
    [tr]
  );

  useEffect(() => {
    if (isOpen && store) {
      setCustomTagline('');
      setShareFeedback(null);
      setCopiedUrl(false);
    }
  }, [isOpen, store?.id]);

  const cleanSlug = useMemo(() => {
    if (!store) return '';
    return normalizeStoreSubdomainSlug(store.slug || store.id) || store.id;
  }, [store]);

  const directStoreUrl = useMemo(() => {
    if (!store) return '';
    return getStoreShareUrl(store.slug || store.id, 'live_at');
  }, [store]);

  const subdomainLabel = useMemo(() => {
    if (!store) return '';
    return getStoreSubdomainDisplay(store.slug || store.id);
  }, [store]);

  const socialEntries = useMemo(
    () => getSocialPlatformEntries(store?.socialLinks),
    [store?.socialLinks]
  );

  const shareIntents = useMemo(() => {
    if (!store || !directStoreUrl) return null;
    return buildSocialShareIntents(directStoreUrl, store.storeName);
  }, [store, directStoreUrl]);

  const theme = useMemo(
    () => QR_CARD_THEMES.find((t) => t.key === selectedTheme) || QR_CARD_THEMES[0],
    [selectedTheme]
  );

  const generateQrAssets = useCallback(async () => {
    if (!isOpen || !store || !directStoreUrl) return;
    setIsGenerating(true);
    try {
      // 1. High-resolution raw square QR canvas (error correction H allows center logo emblem safely)
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, directStoreUrl, {
        width: 560,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: theme.qrDark,
          light: '#ffffff',
        },
      });

      const logoImg =
        includeEmblem && isSafeHttpUrl(store.logoUrl)
          ? await loadCorsSafeImage(store.logoUrl)
          : store.logoUrl?.startsWith('data:image/')
            ? await loadCorsSafeImage(store.logoUrl)
            : null;

      // Draw optional store emblem in the center of the QR
      if (includeEmblem) {
        const qCtx = qrCanvas.getContext('2d');
        if (qCtx) {
          const emblemBox = 112;
          const ex = (qrCanvas.width - emblemBox) / 2;
          const ey = (qrCanvas.height - emblemBox) / 2;

          qCtx.save();
          drawRoundedRect(qCtx, ex - 8, ey - 8, emblemBox + 16, emblemBox + 16, 24);
          qCtx.fillStyle = '#ffffff';
          qCtx.fill();

          drawRoundedRect(qCtx, ex, ey, emblemBox, emblemBox, 20);
          qCtx.fillStyle = theme.bg;
          qCtx.fill();
          qCtx.lineWidth = 3;
          qCtx.strokeStyle = theme.accent;
          qCtx.stroke();

          if (logoImg) {
            qCtx.save();
            drawRoundedRect(qCtx, ex + 4, ey + 4, emblemBox - 8, emblemBox - 8, 16);
            qCtx.clip();
            try {
              qCtx.drawImage(logoImg, ex + 4, ey + 4, emblemBox - 8, emblemBox - 8);
            } catch {
              qCtx.restore();
            }
            qCtx.restore();
          } else {
            qCtx.fillStyle = theme.accent;
            qCtx.font = '700 40px "Plus Jakarta Sans", system-ui, sans-serif';
            qCtx.textAlign = 'center';
            qCtx.textBaseline = 'middle';
            qCtx.fillText(getStoreInitials(store.storeName), qrCanvas.width / 2, qrCanvas.height / 2);
          }
          qCtx.restore();
        }
      }

      // Safely extract Solo QR data URL
      let cleanSoloUrl = '';
      try {
        cleanSoloUrl = qrCanvas.toDataURL('image/png');
      } catch {
        // Fallback if external logo tainted canvas
        const cleanCanvas = document.createElement('canvas');
        await QRCode.toCanvas(cleanCanvas, directStoreUrl, {
          width: 560,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: { dark: theme.qrDark, light: '#ffffff' },
        });
        cleanSoloUrl = cleanCanvas.toDataURL('image/png');
      }
      setSoloQrDataUrl(cleanSoloUrl);

      // 2. Render full Social Media Ready Branded Poster Card (900 x 1140)
      const poster = document.createElement('canvas');
      poster.width = 900;
      poster.height = 1140;
      const ctx = poster.getContext('2d');
      if (!ctx) return;

      // Outer backdrop
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, poster.width, poster.height);

      // Subtle inner card surface
      drawRoundedRect(ctx, 44, 44, 812, 1052, 36);
      ctx.fillStyle = theme.card;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.border;
      ctx.stroke();

      // Top accent rule
      drawRoundedRect(ctx, 370, 74, 160, 6, 3);
      ctx.fillStyle = theme.accent;
      ctx.fill();

      // Store Category Kicker
      ctx.fillStyle = theme.accent;
      ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        (store.category || tr('Tienda Verificada', 'Verified Store', '认证店铺')).toUpperCase(),
        450,
        126
      );

      // Store Name (auto-fit font size)
      ctx.fillStyle = theme.text;
      const storeTitle = store.storeName.trim();
      let titleFontSize = 48;
      if (storeTitle.length > 26) titleFontSize = 36;
      else if (storeTitle.length > 18) titleFontSize = 42;
      ctx.font = `800 ${titleFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
      const titleLines = wrapCanvasText(ctx, storeTitle, 700);
      let cursorY = 186;
      for (const line of titleLines.slice(0, 2)) {
        ctx.fillText(line, 450, cursorY);
        cursorY += titleFontSize + 8;
      }

      // Subdomain / handle line
      ctx.fillStyle = theme.muted;
      ctx.font = '600 24px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillText(`/@${cleanSlug}  ·  ${subdomainLabel}`, 450, cursorY + 12);

      // White crisp quiet-zone QR container
      const qrBoxSize = 540;
      const qrX = (900 - qrBoxSize) / 2;
      const qrY = cursorY + 46;

      drawRoundedRect(ctx, qrX - 18, qrY - 18, qrBoxSize + 36, qrBoxSize + 36, 32);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = theme.accent;
      ctx.stroke();

      try {
        ctx.drawImage(qrCanvas, qrX, qrY, qrBoxSize, qrBoxSize);
      } catch {
        const cleanFallback = document.createElement('img');
        cleanFallback.src = cleanSoloUrl;
        ctx.drawImage(cleanFallback, qrX, qrY, qrBoxSize, qrBoxSize);
      }

      // Tagline below QR
      const caption = (customTagline || defaultTagline).trim();
      ctx.fillStyle = theme.text;
      ctx.font = '600 25px "Plus Jakarta Sans", system-ui, sans-serif';
      const captionLines = wrapCanvasText(ctx, caption, 720);
      let capY = qrY + qrBoxSize + 68;
      for (const line of captionLines.slice(0, 2)) {
        ctx.fillText(line, 450, capY);
        capY += 34;
      }

      // Accepted methods & social badges summary
      const socialBadges =
        socialEntries.length > 0
          ? socialEntries
              .slice(0, 4)
              .map((s) => s.meta.label)
              .join('  ·  ')
          : 'Binance Pay QR  ·  Bybit QR  ·  Pago Móvil';
      ctx.fillStyle = theme.accent;
      ctx.font = '600 21px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(socialBadges, 450, capY + 22);

      // Divider
      ctx.strokeStyle = theme.border;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(110, 1018);
      ctx.lineTo(790, 1018);
      ctx.stroke();

      // Direct Scannable URL Footer
      ctx.fillStyle = theme.muted;
      ctx.font = '500 19px "JetBrains Mono", ui-monospace, monospace';
      const truncatedUrl =
        directStoreUrl.length > 58 ? `${directStoreUrl.slice(0, 55)}...` : directStoreUrl;
      ctx.fillText(truncatedUrl, 450, 1062);

      try {
        setPosterDataUrl(poster.toDataURL('image/png'));
      } catch {
        // Fallback if logo tainted poster canvas: redraw with clean QR
        const soloImg = await loadCorsSafeImage(cleanSoloUrl);
        if (soloImg) {
          ctx.drawImage(soloImg, qrX, qrY, qrBoxSize, qrBoxSize);
          setPosterDataUrl(poster.toDataURL('image/png'));
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }, [
    isOpen,
    store,
    directStoreUrl,
    theme,
    includeEmblem,
    cleanSlug,
    subdomainLabel,
    customTagline,
    defaultTagline,
    socialEntries,
    tr,
  ]);

  useEffect(() => {
    void generateQrAssets();
  }, [generateQrAssets]);

  if (!isOpen || !store) return null;

  const triggerDownload = (dataUrl: string, filename: string) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyDirectUrl = async () => {
    try {
      await navigator.clipboard.writeText(directStoreUrl);
      setCopiedUrl(true);
      setShareFeedback(
        tr(
          'Enlace directo de la tienda copiado.',
          'Direct store link copied.',
          '店铺直达链接已复制。'
        )
      );
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleNativeSocialShare = async () => {
    setShareFeedback(null);
    const shareTitle = `${store.storeName} (@${cleanSlug})`;
    const shareText = tr(
      `Escanea el QR o abre nuestra tienda oficial ${store.storeName}: ${directStoreUrl}`,
      `Scan the QR or open our official store ${store.storeName}: ${directStoreUrl}`,
      `扫描二维码或访问官方店铺 ${store.storeName}: ${directStoreUrl}`
    );

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        if (posterDataUrl) {
          const resp = await fetch(posterDataUrl);
          const blob = await resp.blob();
          const file = new File([blob], `qr-tienda-${cleanSlug}.png`, { type: 'image/png' });
          if (
            typeof navigator.canShare === 'function' &&
            navigator.canShare({ files: [file] })
          ) {
            await navigator.share({
              files: [file],
              title: shareTitle,
              text: shareText,
              url: directStoreUrl,
            });
            return;
          }
        }
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: directStoreUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    await handleCopyDirectUrl();
  };

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-qr-modal-title"
    >
      <div
        className="w-full max-w-3xl bg-[#111114] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="store-qr-modal-title"
              className="text-base sm:text-lg font-bold text-zinc-50 font-display flex items-center gap-2 truncate"
            >
              <QrCode className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="truncate">
                {tr(
                  `QR Personalizado · ${store.storeName}`,
                  `Custom QR · ${store.storeName}`,
                  `专属二维码 · ${store.storeName}`
                )}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 truncate mt-0.5">
              {tr(
                `Al escanear este código abre directamente /@${cleanSlug}`,
                `Scanning this code opens /@${cleanSlug} directly`,
                `扫码后将直接打开专属店铺 /@${cleanSlug}`
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            aria-label={tr('Cerrar', 'Close', '关闭')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Grid: Preview Poster Left + Personalization & Social Share Right */}
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start max-h-[82vh] overflow-y-auto">
          {/* Left: High-Contrast Live Poster Preview */}
          <div className="md:col-span-5 flex flex-col items-center gap-3">
            <div className="w-full max-w-[290px] rounded-2xl overflow-hidden border border-white/[0.12] bg-[#09090b] shadow-2xl shadow-black/70">
              {posterDataUrl ? (
                <img
                  src={posterDataUrl}
                  alt={`QR ${store.storeName}`}
                  className="w-full h-auto block"
                />
              ) : (
                <div className="aspect-[900/1140] flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
                  <div className="w-7 h-7 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                  <span>
                    {isGenerating
                      ? tr('Generando QR...', 'Generating QR...', '正在生成二维码...')
                      : tr('Preparando vista previa...', 'Preparing preview...', '准备预览中...')}
                  </span>
                </div>
              )}
            </div>

            {onVisitStore && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onVisitStore(store);
                }}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1.5 cursor-pointer py-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  {tr(
                    'Probar enlace de destino',
                    'Preview destination storefront',
                    '预览扫码直达店铺'
                  )}
                </span>
              </button>
            )}
          </div>

          {/* Right: Customization & Share Controls */}
          <div className="md:col-span-7 space-y-5 min-w-0">
            {/* Destination URL display */}
            <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <Link2 className="w-3.5 h-3.5" />
                  {tr('Destino exclusivo al escanear', 'Direct scan destination', '扫码直达目标网址')}
                </span>
                <span className="font-mono text-zinc-500">@{cleanSlug}</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-zinc-100 bg-[#111114] border border-white/[0.08] px-3 py-2 rounded-lg truncate">
                  {directStoreUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopyDirectUrl}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-xs font-semibold text-zinc-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedUrl ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{copiedUrl ? tr('Copiado', 'Copied', '已复制') : tr('Copiar', 'Copy', '复制')}</span>
                </button>
              </div>
            </div>

            {/* Color Palette Theme Selector */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {tr(
                    'Estilo personalizado de la tarjeta QR',
                    'Custom QR card theme',
                    '自定义二维码海报主题'
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {QR_CARD_THEMES.map((item) => {
                  const active = selectedTheme === item.key;
                  const label =
                    lang === 'en' ? item.labelEn : lang === 'zh' ? item.labelZh : item.labelEs;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedTheme(item.key)}
                      className={`min-h-[40px] px-2.5 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-400/15 border-amber-400 text-amber-200'
                          : 'bg-[#09090b] border-white/[0.1] text-zinc-300 hover:border-white/25'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-sm border shrink-0 ${item.swatchClass}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editable Tagline & Emblem Toggle */}
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="store-qr-tagline"
                  className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 mb-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {tr(
                      'Mensaje en la tarjeta para redes sociales',
                      'Social poster call-to-action',
                      '海报底部宣传语'
                    )}
                  </span>
                </label>
                <input
                  id="store-qr-tagline"
                  type="text"
                  maxLength={90}
                  value={customTagline}
                  onChange={(e) => setCustomTagline(e.target.value)}
                  placeholder={defaultTagline}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#09090b] border border-white/[0.1] text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeEmblem}
                  onChange={(e) => setIncludeEmblem(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 rounded"
                />
                <span>
                  {tr(
                    'Incluir insignia/logo de la tienda en el centro del QR (alta legibilidad)',
                    'Include store logo/emblem at QR center (high error correction)',
                    '在二维码中心嵌入店铺徽标/首字母（高容错清晰扫码）'
                  )}
                </span>
              </label>
            </div>

            {/* Primary Download & Share Actions */}
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={!posterDataUrl}
                  onClick={() => triggerDownload(posterDataUrl, `qr-redes-${cleanSlug}.png`)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>
                    {tr('Descargar Tarjeta PNG', 'Download Social Card PNG', '下载社交海报 PNG')}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!soloQrDataUrl}
                  onClick={() => triggerDownload(soloQrDataUrl, `qr-${cleanSlug}.png`)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-white/[0.12] text-zinc-100 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{tr('Descargar Solo QR', 'Download QR Only', '仅下载二维码图片')}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleNativeSocialShare}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>
                  {tr(
                    'Compartir Tarjeta QR en Redes / Instagram / TikTok / WhatsApp',
                    'Share QR Card on Social Media / Instagram / TikTok / WhatsApp',
                    '分享二维码海报至社交媒体 / Instagram / TikTok / WhatsApp'
                  )}
                </span>
              </button>

              {shareIntents && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-zinc-400 mr-1">
                    {tr('Compartir enlace rápido:', 'Quick link share:', '快速分享链接：')}
                  </span>
                  <a
                    href={shareIntents.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#09090b] border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href={shareIntents.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#09090b] border border-white/[0.1] hover:border-sky-400/50 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <span>Facebook</span>
                  </a>
                  <a
                    href={shareIntents.x}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#09090b] border border-white/[0.1] hover:border-white/30 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <span>X</span>
                  </a>
                  <a
                    href={shareIntents.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#09090b] border border-white/[0.1] hover:border-sky-400/50 text-sky-300 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <span>Telegram</span>
                  </a>
                </div>
              )}

              {shareFeedback && (
                <p className="text-xs text-emerald-400 font-medium pt-1">{shareFeedback}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
