import React, { useState } from 'react';
import { Product, Debtor, CashMovement, Sale } from './types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_DEBTORS, 
  INITIAL_MOVEMENTS, 
  INITIAL_SALES, 
  INITIAL_EXCHANGE_RATE 
} from './data/mockData';
import { Header } from './components/Header';
import { LiveRateBar } from './components/LiveRateBar';
import { LandingHero } from './components/LandingHero';
import { FeatureBento } from './components/FeatureBento';
import { ComparisonSection } from './components/ComparisonSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { WarehouseApp } from './components/WarehouseApp';
import { GitHubModal } from './components/GitHubModal';
import { MessageCircle } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'app'>('landing');
  const [exchangeRate, setExchangeRate] = useState<number>(INITIAL_EXCHANGE_RATE);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [debtors, setDebtors] = useState<Debtor[]>(INITIAL_DEBTORS);
  const [movements, setMovements] = useState<CashMovement[]>(INITIAL_MOVEMENTS);
  const [sales, setSales] = useState<Sale[]>(INITIAL_SALES);
  const [appInitialTab, setAppInitialTab] = useState<'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales'>('inventory');
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);

  // Inventory stock updater
  const handleUpdateProductStock = (id: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const newStock = Math.max(0, p.stock + delta);
          return { ...p, stock: newStock };
        }
        return p;
      })
    );
  };

  // Add new product
  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    const product: Product = {
      ...newProd,
      id: `prod-${Date.now()}`,
    };
    setProducts((prev) => [product, ...prev]);
  };

  // Process completed sale from POS
  const handleCompleteSale = (sale: Sale) => {
    setSales((prev) => [sale, ...prev]);

    // Deduct stock for all items
    setProducts((prev) =>
      prev.map((p) => {
        const itemSold = sale.items.find((i) => i.product.id === p.id);
        if (itemSold) {
          return { ...p, stock: Math.max(0, p.stock - itemSold.quantity) };
        }
        return p;
      })
    );

    // If sale is paid immediately (not fiado), record cash movement
    if (sale.paymentMethod !== 'Fiado (Crédito)') {
      const newMov: CashMovement = {
        id: `mov-${Date.now()}`,
        type: 'ingreso',
        category: 'Venta',
        description: `Venta Mostrador #${sale.receiptNumber} (${sale.paymentMethod})`,
        amountUSD: sale.subtotalUSD,
        date: sale.date,
      };
      setMovements((prev) => [newMov, ...prev]);
    } else {
      // If sold on credit (fiado), automatically update or create debtor record
      setDebtors((prev) => {
        const existing = prev.find(
          (d) => d.name.toLowerCase() === sale.customerName.toLowerCase()
        );
        if (existing) {
          return prev.map((d) =>
            d.id === existing.id
              ? {
                  ...d,
                  balanceUSD: d.balanceUSD + sale.subtotalUSD,
                  lastPurchaseDate: sale.date.split(' ')[0],
                  history: [
                    {
                      date: sale.date.split(' ')[0],
                      description: `Compra fiada #${sale.receiptNumber}`,
                      amountUSD: sale.subtotalUSD,
                      type: 'cargo',
                    },
                    ...d.history,
                  ],
                }
              : d
          );
        } else {
          const newDebtor: Debtor = {
            id: `deb-${Date.now()}`,
            name: sale.customerName,
            phone: '584140000000',
            balanceUSD: sale.subtotalUSD,
            lastPurchaseDate: sale.date.split(' ')[0],
            notes: `Cuenta fiada creada desde POS (#${sale.receiptNumber})`,
            history: [
              {
                date: sale.date.split(' ')[0],
                description: `Compra fiada #${sale.receiptNumber}`,
                amountUSD: sale.subtotalUSD,
                type: 'cargo',
              },
            ],
          };
          return [newDebtor, ...prev];
        }
      });
    }
  };

  // Add debtor
  const handleAddDebtor = (debtorData: Omit<Debtor, 'id' | 'history'>) => {
    const newDebtor: Debtor = {
      ...debtorData,
      id: `deb-${Date.now()}`,
      history: [
        {
          date: debtorData.lastPurchaseDate,
          description: 'Apertura de saldo pendiente',
          amountUSD: debtorData.balanceUSD,
          type: 'cargo',
        },
      ],
    };
    setDebtors((prev) => [newDebtor, ...prev]);
  };

  // Record payment / abono on debt
  const handleRecordPayment = (debtorId: string, amountUSD: number, description: string) => {
    const today = new Date().toISOString().split('T')[0];
    let debtorName = '';

    setDebtors((prev) =>
      prev.map((d) => {
        if (d.id === debtorId) {
          debtorName = d.name;
          const newBal = Math.max(0, d.balanceUSD - amountUSD);
          return {
            ...d,
            balanceUSD: newBal,
            history: [
              {
                date: today,
                description: `${description} (-$${amountUSD.toFixed(2)})`,
                amountUSD,
                type: 'abono',
              },
              ...d.history,
            ],
          };
        }
        return d;
      })
    );

    // Record cash entry for the payment received
    const newMov: CashMovement = {
      id: `mov-${Date.now()}`,
      type: 'ingreso',
      category: 'Venta',
      description: `Abono de deuda: ${debtorName || 'Cliente'} (${description})`,
      amountUSD,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setMovements((prev) => [newMov, ...prev]);
  };

  // Add manual cash movement
  const handleAddMovement = (movData: Omit<CashMovement, 'id' | 'date'>) => {
    const newMov: CashMovement = {
      ...movData,
      id: `mov-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setMovements((prev) => [newMov, ...prev]);
  };

  const handleOpenAppToModule = (module?: 'inventory' | 'pos' | 'debtors' | 'cashier') => {
    if (module) {
      setAppInitialTab(module);
    }
    setCurrentView('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      {/* Top Header */}
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        exchangeRate={exchangeRate}
        onOpenGitHub={() => setIsGitHubModalOpen(true)}
      />

      {/* GitHub Connection Modal */}
      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        userEmail="zambranogonzalezcarlossmith@gmail.com"
      />

      {/* Exchange Rate ticker and converter */}
      <LiveRateBar
        rate={exchangeRate}
        onUpdateRate={(newRate) => setExchangeRate(newRate)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentView === 'landing' ? (
          <div>
            <LandingHero
              onOpenApp={() => handleOpenAppToModule('inventory')}
              exchangeRate={exchangeRate}
            />

            <FeatureBento
              onOpenApp={(mod) => handleOpenAppToModule(mod)}
              exchangeRate={exchangeRate}
            />

            <ComparisonSection />

            <TestimonialsSection />

            <ContactSection />
          </div>
        ) : (
          <WarehouseApp
            products={products}
            debtors={debtors}
            movements={movements}
            sales={sales}
            exchangeRate={exchangeRate}
            initialTab={appInitialTab}
            onUpdateProductStock={handleUpdateProductStock}
            onAddProduct={handleAddProduct}
            onCompleteSale={handleCompleteSale}
            onAddDebtor={handleAddDebtor}
            onRecordPayment={handleRecordPayment}
            onAddMovement={handleAddMovement}
            onBackToLanding={() => {
              setCurrentView('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* Footer */}
      <Footer onOpenApp={() => handleOpenAppToModule('inventory')} />

      {/* Direct WhatsApp Floating Support Button */}
      <a
        href="https://wa.me/584220273766?text=Hola%20Smith%20Bussines%20Solutions,%20deseo%20asesor%C3%ADa%20sobre%20el%20Gestor%20de%20Almacenes%20La%20Taberna%20Lions%20Gold"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-40 bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 rounded-full shadow-2xl shadow-black/60 hover:scale-110 transition-transform flex items-center justify-center group"
        title="Contactar a Smith Bussines Solutions (+58 422 027 3766)"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 text-xs font-semibold">
          WhatsApp Directo
        </span>
      </a>
    </div>
  );
}
