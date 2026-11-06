import React, { useState } from 'react';
import { Mail, Phone, MessageCircle, Send, CheckCircle2, Shield, MapPin } from 'lucide-react';

export const ContactSection: React.FC = () => {
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    // Direct WhatsApp message link creation
    const text = `Hola Smith Bussines Solutions 2026, mi nombre es ${encodeURIComponent(
      name
    )} del negocio ${encodeURIComponent(businessName || 'Comercio')}. Deseo implementar el Gestor de Almacenes La Taberna Lions Gold. Mi consulta: ${encodeURIComponent(
      message || 'Solicitud de demostración'
    )}`;
    window.open(`https://wa.me/584220273766?text=${text}`, '_blank');
    setIsSubmitted(true);
  };

  return (
    <section id="contacto" className="py-16 lg:py-24 border-t border-slate-800/80 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Direct info and credentials */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <div className="text-xs font-semibold text-amber-400 mb-2">
                Atención Directa en Venezuela
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display text-balance">
                Implementa La Taberna Lions Gold en tu negocio hoy mismo
              </h2>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                Asesoría técnica, migración de inventario desde Excel o papel y capacitación personalizada para tu equipo de cajeros y encargados de almacén.
              </p>
            </div>

            {/* Contact cards */}
            <div className="space-y-3 text-sm">
              <a
                href="https://wa.me/584220273766?text=Hola%20Smith%20Bussines%20Solutions,%20deseo%20informaci%C3%B3n%20sobre%20el%20Gestor%20de%20Almacenes%20La%20Taberna%20Lions%20Gold"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-4 rounded-xl flex items-center gap-3.5 group transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">WhatsApp Oficial (Venezuela)</span>
                  <span className="font-mono font-bold text-white group-hover:text-emerald-400 transition-colors">
                    +58 422 027 3766
                  </span>
                </div>
              </a>

              <a
                href="mailto:empresaalhadiqainvest@gmail.com?subject=Consulta%20Gestor%20de%20Almacenes%20La%20Taberna%20Lions%20Gold"
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-4 rounded-xl flex items-center gap-3.5 group transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-xs text-slate-400 block">Correo Corporativo</span>
                  <span className="font-medium text-white group-hover:text-amber-400 transition-colors truncate block">
                    empresaalhadiqainvest@gmail.com
                  </span>
                </div>
              </a>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Desarrollador Oficial</span>
                  <span className="font-semibold text-white">
                    Smith Bussines Solutions 2026
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Contact Form */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
            {isSubmitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">
                  ¡Mensaje Enviado con Éxito!
                </h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto">
                  Se ha redirigido a la línea de WhatsApp de Smith Bussines Solutions 2026 (+58 422 027 3766). Un asesor responderá a la brevedad.
                </p>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                >
                  Enviar otra consulta
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
                <h3 className="text-lg font-bold text-white font-display mb-1">
                  Solicita una demostración guiada para tu taberna o almacén
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Completa tus datos y te contactaremos de inmediato por WhatsApp o llamada.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Tu Nombre Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Carlos Zambrano"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Nombre del Negocio o Licorería</label>
                    <input
                      type="text"
                      placeholder="Ej: Bodegón & Taberna Central"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Número de WhatsApp (Venezuela)</label>
                    <input
                      type="text"
                      required
                      placeholder="+58 412 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Ciudad / Estado</label>
                    <input
                      type="text"
                      placeholder="Ej: Caracas / Valencia / Maracaibo"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">¿Qué necesitas gestionar principalmente?</label>
                  <textarea
                    rows={3}
                    placeholder="Ej: Control de stock de botellas, cobranza de fiados por WhatsApp y cuadre diario de caja..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar Consulta Directa por WhatsApp</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
