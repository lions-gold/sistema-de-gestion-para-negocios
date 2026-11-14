import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Product } from '../types';
import { 
  Camera, 
  X, 
  Flashlight, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Barcode, 
  Plus, 
  Minus, 
  ShoppingCart,
  Sparkles,
  Volume2,
  VolumeX
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  exchangeRate: number;
  onAddToCart?: (product: Product) => void;
  onUpdateStock?: (productId: string, delta: number) => void;
  onSelectProduct?: (product: Product) => void;
}

// Audio beep for authentic scanner feedback
const playScannerBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'mobile-barcode-reader';
  const scanLockRef = useRef<boolean>(false);

  // Handle scanned code
  const handleCodeDetected = (code: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    if (soundEnabled) {
      playScannerBeep();
    }
    if (navigator.vibrate) {
      navigator.vibrate(80);
    }

    setLastScannedCode(code);

    // Look up product by barcode or SKU
    const found = products.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
    );

    if (found) {
      setMatchedProduct(found);
      setScanSuccessMessage(`¡Producto encontrado: ${found.name}!`);
      if (onSelectProduct) {
        onSelectProduct(found);
      }
    } else {
      setMatchedProduct(null);
      setScanSuccessMessage(null);
    }

    // Release scan lock after 1.5 seconds so user can scan next bottle
    setTimeout(() => {
      scanLockRef.current = false;
    }, 1500);
  };

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

    // Initialize scanner
    const startScanner = async () => {
      try {
        setCameraError(null);

        // List cameras
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') || 
            d.label.toLowerCase().includes('ambiente') ||
            d.label.toLowerCase().includes('trasera')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
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

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.333,
          },
          (decodedText) => {
            handleCodeDetected(decodedText.trim());
          },
          () => {
            // normal frame without code
          }
        );

        setScannerActive(true);
      } catch (err: unknown) {
        console.warn('Camera start error:', err);
        setScannerActive(false);
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
          setCameraError('Permiso de cámara denegado. Puedes probar con los códigos de muestra abajo.');
        } else {
          setCameraError('No se pudo acceder a la cámara trasera. Asegúrate de estar en HTTPS o prueba con los códigos de muestra.');
        }
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(console.error);
        }
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
      {/* Container */}
      <div className="bg-[#111114] border border-amber-500/30 rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        
        {/* Top Header */}
        <div className="p-4 bg-[#09090b] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base font-display">
                Lector de Códigos de Barra
              </h3>
              <p className="text-[11px] text-zinc-400">
                Apunta la cámara del móvil a la botella o caja
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors"
              title={soundEnabled ? 'Silenciar pitido' : 'Activar sonido'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Camera Viewport & Reticle Area */}
        <div className="relative bg-black flex-1 min-h-[260px] sm:min-h-[300px] flex items-center justify-center overflow-hidden">
          {/* HTML5 QR code video mount */}
          <div id={scannerContainerId} className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />

          {/* Scanner Overlay Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            {/* Viewfinder Target Box */}
            <div className="w-64 h-36 border-2 border-amber-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

              {/* Laser scanning line animation */}
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b] animate-bounce duration-1000 top-1/2 -translate-y-1/2" />
            </div>

            <span className="text-[11px] text-amber-300 font-medium bg-black/70 px-3 py-1 rounded-full mt-4 backdrop-blur-sm border border-amber-500/20">
              Enfoca el código de barras aquí
            </span>
          </div>

          {/* Error / Fallback Banner if camera cannot be accessed */}
          {cameraError && (
            <div className="absolute inset-0 bg-[#09090b]/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs text-zinc-300 max-w-xs leading-relaxed">
                {cameraError}
              </p>
              <span className="text-[11px] text-amber-300 font-semibold">
                ¡Puedes tocar los códigos de muestra de licores abajo para probar!
              </span>
            </div>
          )}
        </div>

        {/* Result & Actions Drawer */}
        <div className="p-4 bg-[#111114] border-t border-white/[0.08] space-y-3 overflow-y-auto max-h-[38vh]">
          {/* Matched product card */}
          {matchedProduct ? (
            <div className="p-3.5 bg-[#09090b] rounded-xl border border-emerald-500/40 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>¡Producto Identificado!</span>
                  </div>
                  <h4 className="text-white font-bold text-sm mt-0.5 font-display">
                    {matchedProduct.name}
                  </h4>
                  <span className="text-zinc-400 text-[11px] font-mono">
                    Código: {matchedProduct.barcode} · SKU: {matchedProduct.sku}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-amber-400 text-base">
                    ${matchedProduct.priceUSD.toFixed(2)}
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 block">
                    {(matchedProduct.priceUSD * exchangeRate).toFixed(0)} Bs.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-300 pt-2 border-t border-white/[0.08]">
                <span className="text-zinc-400">
                  Stock actual en cava:{' '}
                  <strong className={matchedProduct.stock <= matchedProduct.minStock ? 'text-amber-400' : 'text-white'}>
                    {matchedProduct.stock} {matchedProduct.unit}s
                  </strong>
                </span>

                <div className="flex items-center gap-2">
                  {onAddToCart && (
                    <button
                      onClick={() => {
                        onAddToCart(matchedProduct);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Agregar a Caja</span>
                    </button>
                  )}

                  {onUpdateStock && (
                    <div className="flex items-center gap-1 bg-[#111114] border border-white/[0.08] rounded-lg p-0.5">
                      <button
                        onClick={() => onUpdateStock(matchedProduct.id, 1)}
                        className="px-2 py-1 text-emerald-400 hover:bg-zinc-800/80 rounded font-bold"
                        title="Sumar 1 unidad recibida"
                      >
                        +1 Entrada
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : lastScannedCode ? (
            <div className="p-3 bg-[#09090b] rounded-xl border border-amber-500/30 text-xs flex items-center justify-between">
              <div>
                <span className="text-zinc-400 block">Código escaneado:</span>
                <span className="font-mono text-white font-bold">{lastScannedCode}</span>
                <span className="text-amber-400 block text-[11px]">No coincide con ningún producto en almacén</span>
              </div>
            </div>
          ) : null}

          {/* Quick Test Barcode Buttons (For demo / testing on mobile or desktop) */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-zinc-400 font-medium block">
              Simular lectura de botellas populares (1-toque):
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {products.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleCodeDetected(p.barcode)}
                  className="p-2 rounded-lg bg-[#09090b] hover:bg-zinc-800/80 border border-white/[0.08] hover:border-amber-500/40 text-left transition-colors flex items-center justify-between"
                >
                  <div className="truncate pr-1">
                    <span className="text-white text-[11px] font-medium block truncate">
                      {p.name.split('(')[0]}
                    </span>
                    <span className="text-[10px] font-mono text-amber-400/80">
                      {p.barcode}
                    </span>
                  </div>
                  <Barcode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
