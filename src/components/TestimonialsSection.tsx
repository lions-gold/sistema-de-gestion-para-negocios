import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export const TestimonialsSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16 lg:py-24 border-t border-white/[0.08] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mb-12">
        <div className="text-xs font-semibold text-amber-400 mb-2">{t.testimonials.eyebrow}</div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-50 tracking-tight font-display text-balance">
          {t.testimonials.title}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {t.testimonials.items.map((item, idx) => (
          <div
            key={idx}
            className="obsidian-surface rounded-2xl p-6 flex flex-col justify-between hover:border-amber-400/30 transition-colors space-y-5"
          >
            <div>
              <div className="text-amber-400 font-mono text-xs font-semibold mb-3 tabular-nums">
                {item.metric}
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">
                &ldquo;{item.text}&rdquo;
              </p>
            </div>

            <div className="pt-4 border-t border-white/[0.07] text-xs space-y-0.5">
              <div className="font-semibold text-zinc-100">{item.name}</div>
              <div className="text-zinc-400">
                {item.role} <span aria-hidden="true">·</span>{' '}
                <span className="text-amber-400/90 font-medium">{item.business}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
