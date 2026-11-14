import React, { useState } from 'react';
import { Mail, MessageCircle, Send, CheckCircle2, Shield } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export const ContactSection: React.FC = () => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const text = `Hola Smith Bussines Solutions 2026, mi nombre es ${encodeURIComponent(
      name
    )} del negocio ${encodeURIComponent(businessName || 'Comercio')}. Deseo implementar Smith Solutions E-Commerce. Mi consulta: ${encodeURIComponent(
      message || 'Solicitud de demostración'
    )}`;
    window.open(`https://wa.me/584220273766?text=${text}`, '_blank');
    setIsSubmitted(true);
  };

  const inputClass =
    'w-full bg-[#09090b] border border-white/[0.1] rounded-lg p-2.5 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors';

  return (
    <section id="contacto" className="py-16 lg:py-24 border-t border-white/[0.08] bg-[#09090b]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div>
              <div className="text-xs font-semibold text-amber-400 mb-2">{t.contact.eyebrow}</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-50 tracking-tight font-display text-balance">
                {t.contact.title}
              </h2>
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{t.contact.subtitle}</p>
            </div>

            <div className="space-y-3 text-sm">
              <a
                href="https://wa.me/584220273766?text=Hola%20Smith%20Bussines%20Solutions,%20deseo%20informaci%C3%B3n%20sobre%20Smith%20Solutions%20E-Commerce"
                target="_blank"
                rel="noopener noreferrer"
                className="obsidian-surface hover:border-emerald-400/40 p-4 rounded-xl flex items-center gap-3.5 group transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.08] text-emerald-400 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-zinc-400 block">{t.contact.waCardTitle}</span>
                  <span className="font-mono font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors tabular-nums">
                    +58 422 027 3766
                  </span>
                </div>
              </a>

              <a
                href="mailto:empresaalhadiqainvest@gmail.com?subject=Consulta%20Smith%20Solutions%20E-Commerce"
                className="obsidian-surface hover:border-amber-400/40 p-4 rounded-xl flex items-center gap-3.5 group transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.08] text-amber-400 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-xs text-zinc-400 block">{t.contact.emailCardTitle}</span>
                  <span className="font-medium text-zinc-100 group-hover:text-amber-400 transition-colors truncate block">
                    empresaalhadiqainvest@gmail.com
                  </span>
                </div>
              </a>

              <div className="obsidian-surface p-4 rounded-xl flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.08] text-sky-400 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-zinc-400 block">{t.contact.devCardTitle}</span>
                  <span className="font-semibold text-zinc-100">Smith Bussines Solutions 2026</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 obsidian-surface rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60">
            {isSubmitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-zinc-50 font-display">
                  {t.contact.successTitle}
                </h3>
                <p className="text-sm text-zinc-400 max-w-md mx-auto">{t.contact.successDesc}</p>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-zinc-200 rounded-lg text-xs font-semibold"
                >
                  {t.contact.successAgain}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <h3 className="text-lg font-bold text-zinc-50 font-display mb-1">
                    {t.contact.formTitle}
                  </h3>
                  <p className="text-xs text-zinc-400">{t.contact.formSubtitle}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1.5">
                      {t.contact.nameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t.contact.namePlaceholder}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1.5">
                      {t.contact.businessLabel}
                    </label>
                    <input
                      type="text"
                      placeholder={t.contact.businessPlaceholder}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1.5">
                      {t.contact.phoneLabel}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="+58 412 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`${inputClass} font-mono tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1.5">
                      {t.contact.cityLabel}
                    </label>
                    <input
                      type="text"
                      placeholder={t.contact.cityPlaceholder}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5">
                    {t.contact.messageLabel}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={t.contact.messagePlaceholder}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm rounded-lg shadow-[0_6px_24px_-6px_rgba(245,158,11,0.45)] transition-all flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Send className="w-4 h-4" />
                  <span>{t.contact.submitBtn}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
