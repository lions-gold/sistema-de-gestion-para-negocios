import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Maximize2,
  QrCode,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { compressImageFileToDataURL } from '../services/saasService';
import { useSubsectionTranslation } from './LanguageSettings';

interface QrUploadFieldProps {
  value?: string;
  onChange: (nextQrUrl: string) => void;
  label?: string;
  hint?: string;
  accent?: 'amber' | 'emerald' | 'indigo';
  onZoom?: (qrUrl: string) => void;
  disabled?: boolean;
}

export const QrUploadField: React.FC<QrUploadFieldProps> = ({
  value,
  onChange,
  label,
  hint,
  accent = 'amber',
  onZoom,
  disabled = false,
}) => {
  const { tr } = useSubsectionTranslation('common');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const compressed = await compressImageFileToDataURL(file, 480, 0.84);
      onChange(compressed);
    } catch (err) {
      setUploadErr(
        err instanceof Error
          ? err.message
          : tr(
              'No se pudo procesar la imagen del código QR.',
              'Could not process the QR code image.',
              '无法处理该二维码图片。'
            )
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const accentBorder =
    accent === 'emerald'
      ? 'border-emerald-500/35 hover:border-emerald-400/60'
      : accent === 'indigo'
        ? 'border-indigo-500/35 hover:border-indigo-400/60'
        : 'border-amber-500/35 hover:border-amber-400/60';

  const accentBtn =
    accent === 'emerald'
      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
      : accent === 'indigo'
        ? 'bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/40 text-indigo-300'
        : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300';

  return (
    <div className={`p-3 rounded-xl bg-[#09090b] border ${accentBorder} space-y-2.5 transition-colors`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              {label ||
                tr(
                  'Imagen de Código QR (Binance Pay / Bybit Pay / Pago)',
                  'QR Code Image (Binance Pay / Bybit Pay / Payment)',
                  '收款二维码图片 (Binance Pay / Bybit Pay)'
                )}
            </span>
          </label>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {hint ||
              tr(
                'Sube la captura del QR oficial para que tus clientes o suscriptores escaneen y paguen directo desde su app.',
                'Upload your official payment QR screenshot so buyers or subscribers can scan and pay directly.',
                '上传官方收款二维码截图，方便买家或商户直接扫码转账付款。'
              )}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="hidden"
      />

      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onZoom?.(value)}
            className="bg-white p-2 rounded-xl border border-white/20 shadow-md shrink-0 hover:scale-[1.03] transition-transform cursor-pointer group relative"
            title={tr('Ampliar QR para escanear', 'Zoom QR to scan', '放大二维码扫码')}
          >
            <img
              src={value}
              alt="Payment QR"
              referrerPolicy="no-referrer"
              className="w-20 h-20 object-contain rounded"
            />
            {onZoom && (
              <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white">
                <Maximize2 className="w-4 h-4" />
              </span>
            )}
          </button>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {tr('QR adjunto listo para escanear', 'QR attached and ready to scan', '二维码已上传并可扫码')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => inputRef.current?.click()}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${accentBtn}`}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading
                  ? tr('Procesando...', 'Processing...', '处理中...')
                  : tr('Cambiar QR', 'Replace QR', '更换二维码')}
              </button>
              {onZoom && (
                <button
                  type="button"
                  onClick={() => onZoom(value)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-white/[0.12] bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  {tr('Ampliar QR', 'Zoom QR', '放大预览')}
                </button>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange('')}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {tr('Quitar', 'Remove', '移除')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 ${accentBtn}`}
        >
          <Upload className="w-4 h-4 shrink-0" />
          <span>
            {uploading
              ? tr('Comprimiendo imagen QR...', 'Compressing QR image...', '正在压缩二维码...')
              : tr('Subir Imagen QR (PNG / JPG)', 'Upload QR Image (PNG / JPG)', '上传二维码图片 (PNG / JPG)')}
          </span>
        </button>
      )}

      {uploadErr && <p className="text-[11px] text-red-400 font-medium">{uploadErr}</p>}
    </div>
  );
};

interface QrZoomModalProps {
  isOpen: boolean;
  qrUrl?: string;
  title: string;
  subtitle?: string;
  accountDetails?: string;
  onClose: () => void;
}

export const QrZoomModal: React.FC<QrZoomModalProps> = ({
  isOpen,
  qrUrl,
  title,
  subtitle,
  accountDetails,
  onClose,
}) => {
  const { tr } = useSubsectionTranslation('common');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !qrUrl) return null;

  const handleCopyDetails = async () => {
    if (!accountDetails) return;
    try {
      await navigator.clipboard.writeText(accountDetails);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadQr = () => {
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qr-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#111114] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">{title}</span>
            </h3>
            {subtitle && <p className="text-[11px] text-zinc-400 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer shrink-0"
            aria-label={tr('Cerrar', 'Close', '关闭')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-xl border-4 border-white">
            <img
              src={qrUrl}
              alt={title}
              referrerPolicy="no-referrer"
              className="w-60 h-60 object-contain"
            />
          </div>

          <p className="text-xs text-zinc-300 text-center">
            {tr(
              'Escanea este código QR directamente desde tu app de Binance, Bybit o billetera digital.',
              'Scan this QR code directly from your Binance, Bybit, or digital wallet app.',
              '请使用 Binance、Bybit 或数字钱包应用直接扫描此二维码付款。'
            )}
          </p>

          {accountDetails && (
            <div className="w-full p-2.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-zinc-200 break-all">{accountDetails}</span>
              <button
                type="button"
                onClick={handleCopyDetails}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? tr('Copiado', 'Copied', '已复制') : tr('Copiar', 'Copy', '复制')}
              </button>
            </div>
          )}

          <div className="w-full grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {tr('Guardar QR', 'Save QR', '保存图片')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center justify-center cursor-pointer"
            >
              {tr('Listo', 'Done', '完成')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
