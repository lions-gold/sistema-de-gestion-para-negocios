import React from 'react';
import { ArrowRight, ShieldCheck, Star, Store } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface TestimonialsSectionProps {
  onOpenMerchant?: () => void;
  onOpenMarketplace?: () => void;
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({
  onOpenMerchant,
  onOpenMarketplace,
}) => {
  const { t, tr } = useLanguage();

  return (
    <section
      aria-labelledby="reputation-heading"
      className="py-16 lg:py-24 border-t border-white/[0.08] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      itemScope
      itemType="https://schema.org/SoftwareApplication"
    >
      <meta itemProp="name" content="Smith Solutions E-Commerce" />
      <meta itemProp="applicationCategory" content="BusinessApplication" />

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold text-amber-400 mb-2">{t.testimonials.eyebrow}</div>
          <h2
            id="reputation-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-50 tracking-tight font-display text-balance"
          >
            {t.testimonials.title}
          </h2>
        </div>

        {/* Verified Reputation & Trust Metric Block (Schema.org AggregateRating) */}
        <div
          className="obsidian-surface rounded-xl px-5 py-3.5 flex items-center gap-4 shrink-0"
          itemProp="aggregateRating"
          itemScope
          itemType="https://schema.org/AggregateRating"
        >
          <meta itemProp="ratingValue" content="4.9" />
          <meta itemProp="bestRating" content="5" />
          <meta itemProp="worstRating" content="1" />
          <meta itemProp="ratingCount" content="148" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold font-mono text-zinc-50 tabular-nums">4.9</span>
              <span className="text-xs text-zinc-400 font-mono">/ 5.0</span>
            </div>
            <div className="flex items-center gap-0.5 mt-0.5" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              ))}
            </div>
          </div>
          <div className="h-9 w-px bg-white/[0.08]" aria-hidden="true" />
          <div className="text-xs">
            <div className="font-semibold text-zinc-100">
              {tr('148+ comercios verificados', '148+ verified stores', '148+ 认证商户')}
            </div>
            <div className="text-emerald-400 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>
                {tr('Reputación y seguridad TLS', 'Verified trust & TLS shield', '可信口碑与安全防护')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {t.testimonials.items.map((item, idx) => (
          <article
            key={idx}
            itemProp="review"
            itemScope
            itemType="https://schema.org/Review"
            className="min-w-0 obsidian-surface rounded-2xl p-6 flex flex-col justify-between hover:border-amber-400/35 transition-colors space-y-5"
          >
            <div
              itemProp="reviewRating"
              itemScope
              itemType="https://schema.org/Rating"
              className="sr-only"
            >
              <meta itemProp="ratingValue" content="5" />
              <meta itemProp="bestRating" content="5" />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="text-amber-400 font-mono text-xs font-semibold tabular-nums">
                  {item.metric}
                </div>
                <div className="flex items-center gap-0.5 shrink-0" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className="w-3 h-3 text-amber-400 fill-amber-400" />
                  ))}
                </div>
              </div>
              <p itemProp="reviewBody" className="text-sm text-zinc-300 leading-relaxed">
                &ldquo;{item.text}&rdquo;
              </p>
            </div>

            <div
              className="pt-4 border-t border-white/[0.07] text-xs space-y-0.5"
              itemProp="author"
              itemScope
              itemType="https://schema.org/Person"
            >
              <div itemProp="name" className="font-semibold text-zinc-100">
                {item.name}
              </div>
              <div className="text-zinc-400">
                {item.role} <span aria-hidden="true">·</span>{' '}
                <span className="text-amber-400/90 font-medium">{item.business}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* E-E-A-T Client Acquisition Conversion Strip */}
      {(onOpenMerchant || onOpenMarketplace) && (
        <div className="mt-10 obsidian-surface rounded-2xl p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5 border border-amber-400/20">
          <div className="space-y-1.5 max-w-2xl">
            <div className="text-xs font-semibold text-amber-400">
              {tr(
                'Alcance orgánico en Google & Captación de clientes',
                'Organic Google Reach & Client Acquisition',
                '谷歌自然流量曝光与客户转化'
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-zinc-50 font-display">
              {tr(
                'Publica tu tienda hoy con @subdominio indexable, Binance/Bybit QR y protección anti-bot',
                'Launch your store today with indexable @subdomain, Binance/Bybit QR & anti-bot protection',
                '立即上线您的专属 @子域名网店，支持 Binance/Bybit 扫码收款与防机器人保护'
              )}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400">
              {tr(
                'Cada tienda recibe metadatos enriquecidos para buscadores, enlace directo para redes sociales y respaldo verificado.',
                'Every store gets rich search metadata, social share links, and verified security protection.',
                '每家店铺均配有搜索引擎结构化数据、社交分享短链与安全验证保障。'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onOpenMerchant && (
              <button
                type="button"
                onClick={onOpenMerchant}
                className="px-5 py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors min-h-[44px] cursor-pointer"
              >
                <Store className="w-4 h-4 shrink-0" />
                <span>
                  {tr('Abrir Mi Tienda ($25/mes)', 'Launch My Store ($25/mo)', '开通我的店铺 ($25/月)')}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            )}
            {onOpenMarketplace && (
              <button
                type="button"
                onClick={onOpenMarketplace}
                className="px-5 py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.12] text-zinc-100 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors min-h-[44px] cursor-pointer"
              >
                <span>
                  {tr('Explorar Tiendas Activas', 'Explore Active Stores', '浏览认证店铺')}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

