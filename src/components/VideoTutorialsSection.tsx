import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Video,
  X,
  ExternalLink,
  FileDown,
  ShoppingBag,
  Store,
  Package,
  Layers,
} from 'lucide-react';
import { GuideVideoAudience, GuideVideoLanguage, PlatformGuideVideo } from '../types';
import { subscribeActivePlatformGuideVideos } from '../services/saasService';
import {
  buildYouTubeEmbedUrl,
  buildYouTubeThumbnailUrl,
  buildYouTubeWatchUrl,
} from '../utils/youtube';
import { useLanguage } from '../i18n/LanguageContext';
import { downloadTrilingualPlatformGuidePDF } from '../utils/platformGuideExport';

interface VideoTutorialsProps {
  variant?: 'section' | 'modal';
  isOpen?: boolean;
  onClose?: () => void;
  initialAudience?: GuideVideoAudience | 'all';
}

export const VideoTutorialsSection: React.FC<VideoTutorialsProps> = ({
  variant = 'section',
  isOpen = true,
  onClose,
  initialAudience = 'all',
}) => {
  const { tr } = useLanguage();
  const [videos, setVideos] = useState<PlatformGuideVideo[]>([]);
  const [audienceFilter, setAudienceFilter] = useState<GuideVideoAudience | 'all'>(initialAudience);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [failedThumbIds, setFailedThumbIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAudienceFilter(initialAudience);
  }, [initialAudience]);

  useEffect(() => {
    const unsub = subscribeActivePlatformGuideVideos((list) => {
      setVideos(list);
    });
    return () => unsub();
  }, []);

  const filteredVideos = useMemo(() => {
    if (audienceFilter === 'all') return videos;
    return videos.filter((v) => v.audience === audienceFilter || v.audience === 'all');
  }, [videos, audienceFilter]);

  const activeVideo = useMemo(() => {
    if (filteredVideos.length === 0) return null;
    return filteredVideos.find((v) => v.id === selectedVideoId) || filteredVideos[0];
  }, [filteredVideos, selectedVideoId]);

  useEffect(() => {
    if (variant !== 'modal' || !isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [variant, isOpen, onClose]);

  if (variant === 'modal' && !isOpen) return null;

  const getAudienceLabel = (aud: GuideVideoAudience) => {
    switch (aud) {
      case 'buyers':
        return tr('Compradores', 'Buyers', '买家指南');
      case 'sellers':
        return tr('Dueños de Tienda', 'Store Owners', '商家入驻');
      case 'warehouse':
        return tr('Almacén & POS', 'Warehouse & POS', '仓库与收银');
      default:
        return tr('Guía General', 'General Guide', '综合教程');
    }
  };

  const getLangLabel = (l: GuideVideoLanguage) => {
    if (l === 'es') return 'Español';
    if (l === 'en') return 'English';
    if (l === 'zh') return '中文';
    return tr('Multilingüe', 'Multilingual', '多语言');
  };

  const content = (
    <div className="space-y-6 min-w-0">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400">
            <Video className="w-4 h-4 shrink-0" />
            <span>
              {tr(
                'Academia & Guías en Video',
                'Platform Video Academy',
                '平台官方视频使用指南'
              )}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-50 font-display tracking-tight">
            {tr(
              'Aprende a usar la plataforma paso a paso',
              'Learn how to use the platform step by step',
              '分步视频教程：轻松上手平台功能'
            )}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
            {tr(
              'Videotutoriales publicados por la administración para comprar productos, registrar tu tienda, configurar tallas/pagos y operar Almacén & POS.',
              'Curated video tutorials on how to buy from stores, register your store, configure apparel sizing/payments, and run Warehouse & POS.',
              '由平台管理员发布的精选视频指南，涵盖买家下单购物、商家开店与收款配置、服装尺码及仓库 POS 操作。'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => downloadTrilingualPlatformGuidePDF('all')}
            className="px-3.5 py-2.5 rounded-lg bg-[#111114] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-400/40 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 min-h-[40px] whitespace-nowrap transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{tr('Guía PDF (ES/EN/ZH)', 'PDF Guide (ES/EN/ZH)', '下载三语 PDF 指南')}</span>
          </button>
          {variant === 'modal' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400/40 text-zinc-300 hover:text-white flex items-center justify-center shrink-0"
              aria-label={tr('Cerrar tutoriales', 'Close tutorials', '关闭视频教程')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Audience Filter Bar */}
      {videos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all' as const, label: tr('Todos', 'All', '全部视频'), icon: Layers },
            { id: 'buyers' as const, label: tr('Compradores', 'Buyers', '买家购物'), icon: ShoppingBag },
            { id: 'sellers' as const, label: tr('Dueños de Tienda', 'Store Owners', '商家管理'), icon: Store },
            { id: 'warehouse' as const, label: tr('Almacén & POS', 'Warehouse & POS', '仓库与收银'), icon: Package },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = audienceFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAudienceFilter(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 min-h-[38px] transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-amber-400 text-zinc-950'
                    : 'bg-[#111114] border border-white/[0.08] text-zinc-300 hover:border-white/[0.2]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Video Theater + Playlist */}
      {filteredVideos.length === 0 ? (
        <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-8 text-center space-y-3">
          <Video className="w-10 h-10 text-amber-400/60 mx-auto" />
          <h3 className="text-base font-bold text-white font-display">
            {videos.length === 0
              ? tr(
                  'Próximamente videotutoriales guiados',
                  'Guided video tutorials coming soon',
                  '官方视频指南即将上线'
                )
              : tr(
                  'No hay videos publicados en esta categoría todavía',
                  'No videos published in this category yet',
                  '该分类下暂无视频教程'
                )}
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {videos.length === 0
              ? tr(
                  'El administrador está preparando las guías en video. Mientras tanto, puedes descargar la guía completa en PDF trilingüe arriba.',
                  'The administrator is curating tutorial videos. Meanwhile, you can download our complete trilingual PDF guide above.',
                  '管理员正在陆续上传视频教程。您可先点击上方按钮下载完整的西/英/中三语 PDF 使用手册。'
                )
              : tr(
                  'Prueba seleccionar "Todos" para ver todos los tutoriales disponibles en la plataforma.',
                  'Try selecting "All" to view all available tutorial videos on the platform.',
                  '请切换至“全部视频”查看所有可用的操作视频指南。'
                )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
          {/* Active Theater Player */}
          {activeVideo && (
            <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col">
              <div className="relative w-full aspect-video bg-[#09090b]">
                <iframe
                  key={activeVideo.youtubeId}
                  src={buildYouTubeEmbedUrl(activeVideo.youtubeId)}
                  title={activeVideo.title}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full border-0"
                />
              </div>

              <div className="p-4 sm:p-5 space-y-2.5 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-400">
                    <span className="text-amber-400 font-semibold">
                      {getAudienceLabel(activeVideo.audience)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{getLangLabel(activeVideo.language)}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white font-display">
                    {activeVideo.title}
                  </h3>
                  {activeVideo.description && (
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                      {activeVideo.description}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-500 font-mono text-[11px] truncate">
                    YouTube ID: {activeVideo.youtubeId}
                  </span>
                  <a
                    href={buildYouTubeWatchUrl(activeVideo.youtubeId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold shrink-0"
                  >
                    <span>{tr('Abrir en YouTube', 'Watch on YouTube', '在 YouTube 打开')}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable Playlist Cards */}
          <div className="lg:col-span-5 min-w-0 space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
            {filteredVideos.map((vid, idx) => {
              const isSelected = activeVideo?.id === vid.id;
              const thumbUrl = buildYouTubeThumbnailUrl(vid.youtubeId);
              return (
                <button
                  key={vid.id}
                  type="button"
                  onClick={() => setSelectedVideoId(vid.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'bg-amber-400/[0.08] border-amber-400/50'
                      : 'bg-[#111114] border-white/[0.08] hover:border-white/[0.2]'
                  }`}
                >
                  <div className="relative w-28 sm:w-32 aspect-video rounded-lg overflow-hidden bg-[#09090b] shrink-0 flex items-center justify-center">
                    {!failedThumbIds[vid.id] && thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={vid.title}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedThumbIds((prev) => ({ ...prev, [vid.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Video className="w-6 h-6 text-amber-400/50" />
                    )}
                    <div
                      className={`absolute inset-0 flex items-center justify-center ${
                        isSelected ? 'bg-black/25' : 'bg-black/40'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          isSelected
                            ? 'bg-amber-400 text-zinc-950'
                            : 'bg-[#09090b]/85 text-white border border-white/20'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                      <span className="text-amber-400 font-bold">#{idx + 1}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{getAudienceLabel(vid.audience)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{getLangLabel(vid.language)}</span>
                    </div>
                    <div
                      className={`text-xs sm:text-sm font-bold line-clamp-2 ${
                        isSelected ? 'text-amber-300' : 'text-zinc-100'
                      }`}
                    >
                      {vid.title}
                    </div>
                    {vid.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug">
                        {vid.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (variant === 'modal') {
    return (
      <div
        className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-6xl bg-[#09090b] border border-white/[0.12] rounded-2xl p-5 sm:p-7 shadow-2xl my-auto max-h-[92dvh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <section
      id="videoguias"
      className="py-12 sm:py-16 border-t border-white/[0.08] bg-[#09090b]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{content}</div>
    </section>
  );
};
