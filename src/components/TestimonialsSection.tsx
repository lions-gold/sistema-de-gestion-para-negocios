import React from 'react';

export const TestimonialsSection: React.FC = () => {
  const testimonials = [
    {
      name: 'Gustavo Rivas',
      role: 'Gerente de Operaciones',
      business: 'Bodegón & Licorería Las Mercedes (Caracas)',
      text: 'Manejar la tasa del día en Bolívares y Dólares solía ser un dolor de cabeza en las noches pico. Con el sistema de La Taberna Lions Gold los cajeros cobran el triple de rápido y la libreta de fiados por WhatsApp nos recuperó más de $1,800 en deudas pendientes en un mes.',
      metric: '+$1,800 USD recuperados en cobranzas',
    },
    {
      name: 'Patricia Domínguez',
      role: 'Propietaria',
      business: 'La Terraza Taberna & Bar (Lechería, Anzoátegui)',
      text: 'Antes no sabíamos cuántas cajas de cerveza o botellas de whisky teníamos en cava real hasta hacer inventario manual a final de mes. Ahora las alertas de stock mínimo nos avisan justo a tiempo para pedirle a los distribuidores.',
      metric: '0 roturas de stock en fines de semana',
    },
    {
      name: 'Leonardo Valbuena',
      role: 'Administrador General',
      business: 'Depósito & Distribuidora El Sol (Valencia)',
      text: 'El soporte de Smith Bussines Solutions 2026 ha sido impecable. Es una plataforma adaptada a Venezuela, rápida, bonita y que no se traba cuando hay fallas de red.',
      metric: '100% de operaciones cuadradas a diario',
    },
  ];

  return (
    <section className="py-16 lg:py-24 border-t border-slate-800/80 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mb-12">
        <div className="text-xs font-semibold text-amber-400 mb-2">
          Testimonios Reales
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight font-display text-balance">
          Comercios y bodegones que transformaron su control de inventario
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((t, idx) => (
          <div
            key={idx}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-amber-500/30 transition-colors space-y-4"
          >
            <div>
              <div className="text-amber-400 font-mono text-xs font-bold mb-3">
                {t.metric}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed italic">
                &quot;{t.text}&quot;
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800 text-xs">
              <div className="font-bold text-white">{t.name}</div>
              <div className="text-slate-400">{t.role}</div>
              <div className="text-amber-400/80 font-medium">{t.business}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
