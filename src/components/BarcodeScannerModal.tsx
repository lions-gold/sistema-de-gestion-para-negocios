import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Product } from '../types';
import {
  Camera,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Barcode,
  ShoppingCart,
  Volume2,
  VolumeX,
  History,
  Trash2,
  Search,
} from 'lucide-react';
import { VENEZUELA_LOCALE, VENEZUELA_TIMEZONE } from '../utils/venezuelaTime';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  exchangeRate: number;
  onAddToCart?: (product: Product) => void;
  onUpdateStock?: (productId: string, delta: number) => void;
  onSelectProduct?: (product: Product) => void;
}

interface RecentScannedItem {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  priceUSD: number;
  stock: number;
  minStock: number;
  unit: string;
  scannedAt: string;
}

const RECENT_SCANS_SESSION_KEY = 'smith_scanner_recent_products_v1';
const MAX_RECENT_SCANS = 5;

function loadRecentScansFromSession(): RecentScannedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(RECENT_SCANS_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentScannedItem =>
          Boolean(item && typeof item.productId === 'string' && typeof item.name === 'string')
      )
      .slice(0, MAX_RECENT_SCANS);
  } catch {
    return [];
  }
}

function saveRecentScansToSession(items: RecentScannedItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      RECENT_SCANS_SESSION_KEY,
      JSON.stringify(items.slice(0, MAX_RECENT_SCANS))
    );
  } catch {
    // Ignore storage quota errors
  }
}

// Audio beep for authentic scanner feedback
const playScannerBeep = () => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch {
    // Ignore audio restrictions
  }
};

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  exchangeRate,
  onAddToCart,
  onUpdateStock,
  onSelectProduct,
}) => {
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [recentScans, setRecentScans] = useState<RecentScannedItem[]>(() =>
    loadRecentScansFromSession()
  );

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'mobile-barcode-reader';
  const scanLockRef = useRef<boolean>(false);

  // Keep latest products & preferences accessible to camera decode callbacks
  const productsRef = useRef<Product[]>(products);
  productsRef.current = products;
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const onSelectProductRef = useRef(onSelectProduct);
  onSelectProductRef.current = onSelectProduct;

  const pushRecentScan = (product: Product) => {
    const nowTime = new Date().toLocaleTimeString(VENEZUELA_LOCALE, {
      timeZone: VENEZUELA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const entry: RecentScannedItem = {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      priceUSD: product.priceUSD,
      stock: product.stock,
      minStock: product.minStock,
      unit: product.unit,
      scannedAt: nowTime,
    };

    setRecentScans((prev) => {
      const next = [entry, ...prev.filter((item) => item.productId !== product.id)].slice(
        0,
        MAX_RECENT_SCANS
      );
      saveRecentScansToSession(next);
      return next;
    });
  };

  // Handle scanned code
  const handleCodeDetected = (code: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    if (soundEnabledRef.current) {
      playScannerBeep();
    }
    if (navigator.vibrate) {
      navigator.vibrate(80);
    }

    setLastScannedCode(code);

    const normalizedCode = code.trim().toLowerCase();
    const found = productsRef.current.find(
      (p) => p.barcode.toLowerCase() === normalizedCode || p.sku.toLowerCase() === normalizedCode
    );

    if (found) {
      setMatchedProduct(found);
      pushRecentScan(found);
      onSelectProductRef.current?.(found);
    } else {
      setMatchedProduct(null);
    }

    // Release scan lock after 1.5 seconds so user can scan next bottle
    setTimeout(() => {
      scanLockRef.current = false;
    }, 1500);
  };

  const handleSelectRecentItem = (recent: RecentScannedItem) => {
    const liveProduct =
      products.find((p) => p.id === recent.productId) ||
      products.find((p) => p.barcode === recent.barcode) ||
      null;

    if (liveProduct) {
      setMatchedProduct(liveProduct);
      setLastScannedCode(liveProduct.barcode);
      onSelectProduct?.(liveProduct);
    } else {
      setLastScannedCode(recent.barcode);
      setMatchedProduct(null);
    }
  };

  const handleClearRecentScans = () => {
    setRecentScans([]);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(RECENT_SCANS_SESSION_KEY);
      } catch {
        // ignore
      }
    }
  };

  // Keep matchedProduct synced with live stock updates while modal is open
  const liveMatchedProduct = matchedProduct
    ? products.find((p) => p.id === matchedProduct.id) || matchedProduct
    : null;

  // Start the camera
  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(console.error);
        }
        scannerRef.current = null;
      }
      setScannerActive(false);
      setCameraError(null);
      setLastScannedCode(null);
      setMatchedProduct(null);
      return;
    }

    const startScanner = async () => {
      try {
        setCameraError(null);

        if (typeof window !== 'undefined' && !window.isSecureContext) {
          setCameraError(
            'La cámara en móvil/iPhone requiere conexión HTTPS segura. Usa el campo manual o lector USB abajo.'
          );
          return;
        }
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          setCameraError(
            'Este navegador no expone cámara en vivo. Puedes escribir el código de barras o usar lector USB abajo.'
          );
          return;
        }

        let devices: { id: string; label: string }[] = [];
        let preferredCameraId: string | null = null;
        try {
          devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            const backCam = devices.find(
              (d) =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('rear') ||
                d.label.toLowerCase().includes('ambiente') ||
                d.label.toLowerCase().includes('trasera')
            );
            preferredCameraId = backCam ? backCam.id : devices[0].id;
            setSelectedCameraId(preferredCameraId);
          }
        } catch {
          // On iOS Safari before permission is granted, getCameras may fail until start() prompts
        }

        const scanner = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;

        const scanConfig = {
          fps: 12,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.333,
        };

        const cameraTargets: Array<string | { facingMode: string }> = [
          { facingMode: 'environment' },
        ];
        if (preferredCameraId) cameraTargets.push(preferredCameraId);
        cameraTargets.push({ facingMode: 'user' });

        let started = false;
        let lastErr: unknown = null;
        for (const target of cameraTargets) {
          try {
            await scanner.start(
              target,
              scanConfig,
              (decodedText) => {
                handleCodeDetected(decodedText.trim());
              },
              () => {
                // normal frame without code
              }
            );
            started = true;
            break;
          } catch (attemptErr) {
            lastErr = attemptErr;
            const msg = attemptErr instanceof Error ? attemptErr.message : String(attemptErr);
            if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
              throw attemptErr;
            }
          }
        }

        if (!started) {
          throw lastErr || new Error('No se pudo inicializar ninguna cámara');
        }

        setScannerActive(true);
      } catch (err: unknown) {
        console.warn('Camera start error:', err);
        setScannerActive(false);
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
          setCameraError(
            'Permiso de cámara denegado. Usa el lector USB / entrada manual o los códigos de muestra abajo.'
          );
        } else {
          setCameraError(
            'No se detectó cámara activa. En PC o móvil puedes usar el campo manual / lector USB abajo.'
          );
        }
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    // Ensure iPhone Safari always keeps <video> inline (never opens fullscreen native player)
    const enforceInlineVideo = () => {
      const container = document.getElementById(scannerContainerId);
      const vid = container?.querySelector('video');
      if (vid) {
        vid.setAttribute('playsinline', 'true');
        vid.setAttribute('webkit-playsinline', 'true');
        vid.setAttribute('muted', 'true');
        vid.playsInline = true;
        vid.muted = true;
      }
    };
    const obs = new MutationObserver(enforceInlineVideo);
    const targetEl = document.getElementById(scannerContainerId);
    if (targetEl) {
      obs.observe(targetEl, { childList: true, subtree: true });
      enforceInlineVideo();
    }

    return () => {
      clearTimeout(timer);
      obs.disconnect();
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(console.error);
        }
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleCycleCamera = async () => {
    if (cameras.length < 2 || !scannerRef.current) return;
    const currentIdx = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextCam = cameras[(currentIdx + 1) % cameras.length];
    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      setSelectedCameraId(nextCam.id);
      await scannerRef.current.start(
        nextCam.id,
        { fps: 12, qrbox: { width: 260, height: 160 }, aspectRatio: 1.333 },
        (decodedText) => handleCodeDetected(decodedText.trim()),
        () => {}
      );
      const vid = document.getElementById(scannerContainerId)?.querySelector('video');
      if (vid) {
        vid.setAttribute('playsinline', 'true');
        vid.playsInline = true;
        vid.muted = true;
      }
    } catch (err) {
      console.warn('Error switching camera:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 safe-area-bottom">
      {/* Container */}
      <div className="bg-[#111114] border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Top Header */}
        <div className="p-3.5 sm:p-4 bg-[#09090b] border-b border-white/[0.08] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm sm:text-base font-display truncate">
                Lector de Códigos de Barra
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                Apunta la cámara del móvil a la botella o caja
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {cameras.length > 1 && scannerActive && (
              <button
                type="button"
                onClick={handleCycleCamera}
                className="min-w-[44px] min-h-[44px] p-2 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800/80 transition-colors flex items-center justify-center"
                title="Cambiar lente / cámara"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="min-w-[44px] min-h-[44px] p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors flex items-center justify-center"
              title={soundEnabled ? 'Silenciar pitido' : 'Activar sonido'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-amber-400" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors flex items-center justify-center"
              aria-label="Cerrar escáner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Camera Viewport & Reticle Area */}
        <div className="relative bg-black flex-1 min-h-[210px] sm:min-h-[260px] flex items-center justify-center overflow-hidden">
          <div
            id={scannerContainerId}
            className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full"
          />

          {/* Scanner Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            <div className="w-64 h-36 border-2 border-amber-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b] animate-bounce duration-1000 top-1/2 -translate-y-1/2" />
            </div>

            <span className="text-[11px] text-amber-300 font-medium bg-black/70 px-3 py-1 rounded-full mt-4 backdrop-blur-sm border border-amber-500/20">
              Enfoca el código de barras aquí
            </span>
          </div>

          {cameraError && (
            <div className="absolute inset-0 bg-[#09090b]/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs text-zinc-300 max-w-xs leading-relaxed">{cameraError}</p>
              <span className="text-[11px] text-amber-300 font-semibold">
                ¡Puedes tocar los códigos de muestra abajo para probar!
              </span>
            </div>
          )}
        </div>

        {/* Result, Manual/USB Input, Session History (Last 5) & Quick Actions Drawer */}
        <div className="p-4 bg-[#111114] border-t border-white/[0.08] space-y-3.5 overflow-y-auto max-h-[45dvh]">
          {/* Manual / PC USB Barcode Pistol Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualCodeInput.trim()) return;
              scanLockRef.current = false;
              handleCodeDetected(manualCodeInput.trim());
              setManualCodeInput('');
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                inputMode="text"
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                placeholder="Escribir código de barras / SKU o usar pistola USB..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 bg-[#09090b] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              className="min-h-[42px] px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Buscar</span>
            </button>
          </form>

          {/* Matched product card */}
          {liveMatchedProduct ? (
            <div className="p-3.5 bg-[#09090b] rounded-xl border border-emerald-500/40 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Producto identificado</span>
                  </div>
                  <h4 className="text-white font-bold text-sm mt-0.5 font-display truncate">
                    {liveMatchedProduct.name}
                  </h4>
                  <span className="text-zinc-400 text-[11px] font-mono block truncate">
                    Código: {liveMatchedProduct.barcode} · SKU: {liveMatchedProduct.sku}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-amber-400 text-base tabular-nums">
                    ${liveMatchedProduct.priceUSD.toFixed(2)}
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 block tabular-nums">
                    {(liveMatchedProduct.priceUSD * exchangeRate).toFixed(0)} Bs.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-300 pt-2 border-t border-white/[0.08]">
                <span className="text-zinc-400 font-mono tabular-nums">
                  Stock actual:{' '}
                  <strong
                    className={
                      liveMatchedProduct.stock <= liveMatchedProduct.minStock
                        ? 'text-amber-400'
                        : 'text-white'
                    }
                  >
                    {liveMatchedProduct.stock} {liveMatchedProduct.unit}s
                  </strong>
                </span>

                <div className="flex items-center gap-2">
                  {onAddToCart && (
                    <button
                      type="button"
                      onClick={() => {
                        onAddToCart(liveMatchedProduct);
                        onClose();
                      }}
                      className="px-3 py-1.5 min-h-[36px] bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Agregar a Caja</span>
                    </button>
                  )}

                  {onUpdateStock && (
                    <button
                      type="button"
                      onClick={() => onUpdateStock(liveMatchedProduct.id, 1)}
                      className="px-2.5 py-1.5 min-h-[36px] bg-[#111114] border border-white/[0.08] text-emerald-400 hover:bg-zinc-800/80 rounded-lg font-bold text-xs"
                      title="Sumar 1 unidad recibida"
                    >
                      +1 Entrada
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : lastScannedCode ? (
            <div className="p-3 bg-[#09090b] rounded-xl border border-amber-500/30 text-xs flex items-center justify-between">
              <div>
                <span className="text-zinc-400 block">Código escaneado:</span>
                <span className="font-mono text-white font-bold">{lastScannedCode}</span>
                <span className="text-amber-400 block text-[11px]">
                  No coincide con ningún producto en almacén
                </span>
              </div>
            </div>
          ) : null}

          {/* Local Session History: Last 5 Scanned Products */}
          <div className="space-y-2 border-t border-white/[0.08] pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Últimos escaneos ({recentScans.length}/{MAX_RECENT_SCANS})</span>
              </div>

              {recentScans.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearRecentScans}
                  className="text-[11px] text-zinc-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>

            {recentScans.length === 0 ? (
              <p className="text-[11px] text-zinc-500 py-1">
                Los últimos 5 productos que escanees en esta sesión aparecerán aquí para consulta rápida.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#09090b] overflow-hidden">
                {recentScans.map((entry) => {
                  const liveItem = products.find((p) => p.id === entry.productId);
                  const currentStock = liveItem ? liveItem.stock : entry.stock;
                  const currentPrice = liveItem ? liveItem.priceUSD : entry.priceUSD;
                  const currentMinStock = liveItem ? liveItem.minStock : entry.minStock;
                  const isActive = liveMatchedProduct?.id === entry.productId;

                  return (
                    <div
                      key={entry.productId}
                      className={`flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] transition-colors ${
                        isActive ? 'bg-amber-500/10' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectRecentItem(entry)}
                        className="flex-1 min-w-0 text-left py-0.5"
                      >
                        <div className="text-xs font-semibold text-white truncate">
                          {entry.name}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono tabular-nums truncate">
                          <span>{entry.sku}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{entry.scannedAt}</span>
                          <span aria-hidden="true"> · </span>
                          <span
                            className={
                              currentStock <= currentMinStock ? 'text-amber-400' : 'text-zinc-300'
                            }
                          >
                            {currentStock} {entry.unit}s
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-amber-400 tabular-nums">
                          ${currentPrice.toFixed(2)}
                        </span>
                        {onAddToCart && liveItem && (
                          <button
                            type="button"
                            onClick={() => {
                              onAddToCart(liveItem);
                              onClose();
                            }}
                            className="p-2 min-w-[36px] min-h-[36px] rounded-lg bg-[#111114] hover:bg-amber-500 hover:text-zinc-950 border border-white/[0.08] text-amber-400 transition-colors flex items-center justify-center"
                            title={`Agregar ${liveItem.name} a Caja`}
                            aria-label={`Agregar ${liveItem.name} a Caja`}
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Test Barcode Buttons */}
          {products.length > 0 && (
            <div className="space-y-1.5 border-t border-white/[0.08] pt-3">
              <span className="text-[11px] text-zinc-400 font-medium block">
                Lectura rápida de inventario (1 toque):
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {products.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleCodeDetected(p.barcode)}
                    className="p-2 min-h-[44px] rounded-lg bg-[#09090b] hover:bg-zinc-800/80 border border-white/[0.08] hover:border-amber-500/40 text-left transition-colors flex items-center justify-between"
                  >
                    <div className="truncate pr-1">
                      <span className="text-white text-[11px] font-medium block truncate">
                        {p.name.split('(')[0]}
                      </span>
                      <span className="text-[10px] font-mono text-amber-400/80">{p.barcode}</span>
                    </div>
                    <Barcode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
