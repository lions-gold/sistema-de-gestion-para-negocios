import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export const ComparisonSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section id="comparativa" className="py-16 lg:py-24 border-t border-white/[0.08] bg-[#0c0c0f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="text-xs font-semibold text-amber-400 mb-2">{t.comparison.eyebrow}</div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-50 tracking-tight font-display text-balance">
            {t.comparison.title}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-400">{t.comparison.subtitle}</p>
        </div>

        <div className="max-w-4xl mx-auto obsidian-surface rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#09090b] text-zinc-300 font-semibold border-b border-white/[0.08]">
                <tr>
                  <th className="py-4 px-5">{t.comparison.colFeature}</th>
                  <th className="py-4 px-4 text-center text-zinc-400">{t.comparison.colExcel}</th>
                  <th className="py-4 px-4 text-center text-zinc-400">{t.comparison.colGeneric}</th>
                  <th className="py-4 px-5 text-center text-amber-400 bg-amber-500/[0.07] border-x border-amber-400/20 font-bold">
                    Smith Solutions E-Commerce
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {t.comparison.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 font-medium text-zinc-100">{row.feature}</td>
                    <td className="py-3.5 px-4 text-center text-rose-400 font-mono tabular-nums">{row.excel}</td>
                    <td className="py-3.5 px-4 text-center text-zinc-400 font-mono tabular-nums">
                      {row.generic}
                    </td>
                    <td className="py-3.5 px-5 text-center text-emerald-400 bg-amber-500/[0.04] border-x border-amber-400/20 font-semibold">
                      {row.smith}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
