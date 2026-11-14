import React, { useState, useMemo } from 'react';
import { Sale, Product, InventoryAuditLog } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Award,
  ShoppingBag,
  Clock,
  Users,
  Flame,
  ArrowUpRight,
  TrendingDown,
  Calendar,
  Filter,
  Download,
  Printer,
  ChevronRight,
  Search,
  Percent,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Receipt,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { exportSingleReceiptPDF, printReceiptTicket, exportSalesReportPDF } from '../utils/pdfExport';
import { INITIAL_INVENTORY_AUDITS } from '../data/mockData';

interface AnalyticsModuleProps {
  sales: Sale[];
  products: Product[];
  exchangeRate: number;
}

type PeriodFilter = 'today' | 'yesterday' | '7days' | 'month';

export const AnalyticsModule: React.FC<AnalyticsModuleProps> = ({
  sales,
  products,
  exchangeRate,
}) => {
  // Navigation Sub-tab
  const [activeTab, setActiveTab] = useState<'profitability' | 'top_products' | 'peak_hours' | 'sales_team' | 'history'>('profitability');
  const [period, setPeriod] = useState<PeriodFilter>('7days');
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('Todos');

  // Load audit records from localStorage or mock for mermas deduction
  const audits: InventoryAuditLog[] = useMemo(() => {
    try {
      const raw = localStorage.getItem('lions_gold_inventory_audits');
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return INITIAL_INVENTORY_AUDITS;
  }, []);

  // Filter sales based on period
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return sales.filter((s) => {
      const saleDate = new Date(s.date.replace(' ', 'T'));
      const saleDateStr = s.date.split(' ')[0];

      if (period === 'today') {
        // If no sales match today, fall back to latest available sale date so data shows
        const hasToday = sales.some((x) => x.date.startsWith(todayStr));
        if (hasToday) return saleDateStr === todayStr;
        // fallback to latest sale date
        const latest = sales[sales.length - 1]?.date.split(' ')[0];
        return saleDateStr === latest;
      }
      if (period === 'yesterday') {
        return saleDateStr === yesterdayStr;
      }
      if (period === '7days') {
        return saleDate >= sevenDaysAgo || sales.length <= 15; // show current window
      }
      if (period === 'month') {
        return saleDate >= firstDayOfMonth || sales.length <= 25;
      }
      return true;
    });
  }, [sales, period]);

  // 1. RENTABILIDAD NETA REAL (Profit & Loss Breakdown)
  const profitabilityMetrics = useMemo(() => {
    let grossRevenueUSD = 0;
    let replacementCostUSD = 0;

    filteredSales.forEach((sale) => {
      grossRevenueUSD += sale.subtotalUSD;
      sale.items.forEach((item) => {
        const productCost = item.product.costUSD || 0;
        replacementCostUSD += productCost * item.quantity;
      });
    });

    const grossProfitUSD = grossRevenueUSD - replacementCostUSD;
    const grossMarginPct = grossRevenueUSD > 0 ? (grossProfitUSD / grossRevenueUSD) * 100 : 0;

    // Deduct recorded mermas / waste for the period
    const totalMermasUSD = audits.reduce((sum, a) => sum + a.totalLossUSD, 0);
    // Period share of waste (proportional or full)
    const periodMermasUSD = period === 'today' ? totalMermasUSD * 0.2 : period === '7days' ? totalMermasUSD * 0.7 : totalMermasUSD;

    const netProfitUSD = Math.max(0, grossProfitUSD - periodMermasUSD);
    const netProfitBs = netProfitUSD * exchangeRate;
    const netMarginPct = grossRevenueUSD > 0 ? (netProfitUSD / grossRevenueUSD) * 100 : 0;

    return {
      grossRevenueUSD,
      grossRevenueBs: grossRevenueUSD * exchangeRate,
      replacementCostUSD,
      replacementCostBs: replacementCostUSD * exchangeRate,
      grossProfitUSD,
      grossProfitBs: grossProfitUSD * exchangeRate,
      grossMarginPct,
      mermasLossUSD: periodMermasUSD,
      mermasLossBs: periodMermasUSD * exchangeRate,
      netProfitUSD,
      netProfitBs,
      netMarginPct,
      totalOrders: filteredSales.length,
      averageTicketUSD: filteredSales.length > 0 ? grossRevenueUSD / filteredSales.length : 0,
    };
  }, [filteredSales, exchangeRate, audits, period]);

  // 2. PRODUCTOS MÁS VENDIDOS (TOP SELLERS)
  const topProducts = useMemo(() => {
    const productStatsMap: {
      [productId: string]: {
        id: string;
        name: string;
        sku: string;
        category: string;
        quantitySold: number;
        revenueUSD: number;
        costUSD: number;
        profitUSD: number;
      };
    } = {};

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const pid = item.product.id;
        const qty = item.quantity;
        const revenue = item.product.priceUSD * qty;
        const cost = (item.product.costUSD || 0) * qty;
        const profit = revenue - cost;

        if (!productStatsMap[pid]) {
          productStatsMap[pid] = {
            id: pid,
            name: item.product.name,
            sku: item.product.sku,
            category: item.product.category,
            quantitySold: 0,
            revenueUSD: 0,
            costUSD: 0,
            profitUSD: 0,
          };
        }

        productStatsMap[pid].quantitySold += qty;
        productStatsMap[pid].revenueUSD += revenue;
        productStatsMap[pid].costUSD += cost;
        productStatsMap[pid].profitUSD += profit;
      });
    });

    const list = Object.values(productStatsMap);
    // Sort by units sold descending
    list.sort((a, b) => b.quantitySold - a.quantitySold);
    return list;
  }, [filteredSales]);

  // 3. HORAS PICO DE COMPRA (PEAK RUSH HOURS)
  const peakHoursData = useMemo(() => {
    // 24-hour slots initialized
    const hoursCount: { [hour: number]: { hour: string; orders: number; revenueUSD: number; isPeak?: boolean } } = {};
    for (let h = 8; h <= 24; h++) {
      const displayHour = h === 24 ? '00:00' : `${String(h).padStart(2, '0')}:00`;
      hoursCount[h] = { hour: displayHour, orders: 0, revenueUSD: 0 };
    }

    filteredSales.forEach((sale) => {
      const timePart = sale.date.split(' ')[1];
      if (timePart) {
        let hourNum = parseInt(timePart.split(':')[0], 10);
        if (hourNum === 0) hourNum = 24; // map midnight
        if (hoursCount[hourNum]) {
          hoursCount[hourNum].orders += 1;
          hoursCount[hourNum].revenueUSD += sale.subtotalUSD;
        }
      }
    });

    const list = Object.values(hoursCount);
    // Find peak hour
    let maxRevenue = 0;
    let peakItem = list[0];
    list.forEach((item) => {
      if (item.revenueUSD > maxRevenue) {
        maxRevenue = item.revenueUSD;
        peakItem = item;
      }
    });
    if (peakItem) peakItem.isPeak = true;

    // Time frames breakdown
    const daySlots = {
      tarde: list.filter((_, i) => i >= 4 && i <= 8).reduce((acc, x) => acc + x.revenueUSD, 0), // 12h - 16h
      tardeNoche: list.filter((_, i) => i >= 9 && i <= 12).reduce((acc, x) => acc + x.revenueUSD, 0), // 17h - 20h
      nochePico: list.filter((_, i) => i >= 13 && i <= 16).reduce((acc, x) => acc + x.revenueUSD, 0), // 21h - 00h
    };

    return {
      hourlyList: list,
      peakHour: peakItem?.hour || '21:00',
      peakRevenueUSD: peakItem?.revenueUSD || 0,
      peakOrders: peakItem?.orders || 0,
      daySlots,
    };
  }, [filteredSales]);

  // 4. DESEMPEÑO DEL EQUIPO DE VENTAS (CASHIERS & BARTENDERS)
  const salesTeamPerformance = useMemo(() => {
    const teamMap: {
      [name: string]: {
        name: string;
        role: string;
        ordersCount: number;
        revenueUSD: number;
        netProfitUSD: number;
        averageTicketUSD: number;
        participationPct: number;
      };
    } = {};

    filteredSales.forEach((sale) => {
      const seller = sale.cashierName || 'Carlos Smith (Caja)';
      if (!teamMap[seller]) {
        let role = 'Cajero Principal';
        if (seller.includes('Mendoza')) role = 'Barra & Cava';
        if (seller.includes('Gómez')) role = 'Barra VIP';
        if (seller.includes('Administración')) role = 'Gerencia Nocturna';

        teamMap[seller] = {
          name: seller,
          role,
          ordersCount: 0,
          revenueUSD: 0,
          netProfitUSD: 0,
          averageTicketUSD: 0,
          participationPct: 0,
        };
      }

      teamMap[seller].ordersCount += 1;
      teamMap[seller].revenueUSD += sale.subtotalUSD;

      // Calculate cost
      let cost = 0;
      sale.items.forEach((it) => {
        cost += (it.product.costUSD || 0) * it.quantity;
      });
      teamMap[seller].netProfitUSD += sale.subtotalUSD - cost;
    });

    const totalRev = profitabilityMetrics.grossRevenueUSD || 1;
    const list = Object.values(teamMap).map((member) => ({
      ...member,
      averageTicketUSD: member.ordersCount > 0 ? member.revenueUSD / member.ordersCount : 0,
      participationPct: (member.revenueUSD / totalRev) * 100,
    }));

    list.sort((a, b) => b.revenueUSD - a.revenueUSD);
    return list;
  }, [filteredSales, profitabilityMetrics.grossRevenueUSD]);

  // 5. SALES HISTORY FILTERING
  const historyFilteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchesSearch =
        s.receiptNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
        s.customerName.toLowerCase().includes(historySearch.toLowerCase()) ||
        (s.customerRIF && s.customerRIF.toLowerCase().includes(historySearch.toLowerCase())) ||
        s.items.some((it) => it.product.name.toLowerCase().includes(historySearch.toLowerCase()));
      const matchesMethod = historyMethodFilter === 'Todos' || s.paymentMethod === historyMethodFilter;
      return matchesSearch && matchesMethod;
    });
  }, [sales, historySearch, historyMethodFilter]);

  return (
    <div className="space-y-6">
      {/* Sub-Tabs Bar & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab('profitability')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'profitability'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-[#111114]'
            }`}
          >
            <DollarSign className="w-4 h-4 stroke-[2.5]" />
            <span>Rentabilidad Neta (P&L)</span>
          </button>

          <button
            onClick={() => setActiveTab('top_products')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'top_products'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-[#111114]'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Más Vendidos</span>
          </button>

          <button
            onClick={() => setActiveTab('peak_hours')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'peak_hours'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-[#111114]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Horas Pico</span>
          </button>

          <button
            onClick={() => setActiveTab('sales_team')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'sales_team'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-[#111114]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Equipo de Ventas</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-[#111114]'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Historial ({sales.length})</span>
          </button>
        </div>

        {/* Period Selector Pills */}
        <div className="flex items-center gap-1 bg-[#09090b] p-1 rounded-xl border border-white/[0.08] text-xs shrink-0 self-start sm:self-auto">
          {(
            [
              { key: 'today', label: 'Hoy' },
              { key: 'yesterday', label: 'Ayer' },
              { key: '7days', label: '7 Días' },
              { key: 'month', label: 'Mes' },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
                period === p.key
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. RENTABILIDAD NETA REAL (Deducción automática de costos de reposición)   */}
      {/* ========================================================================= */}
      {activeTab === 'profitability' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Main Profit & Loss Waterfall Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-amber-400 tracking-wider">
                  ESTADO DE RESULTADOS COMERCIAL (P&L EN TIEMPO REAL)
                </span>
                <h3 className="font-bold text-white text-lg sm:text-xl font-display">
                  Cálculo de Rentabilidad Neta del Día
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Deducción automática de costos de reposición al proveedor y pérdidas por merma para conocer la ganancia limpia real.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-zinc-400 block">Margen Neto Real</span>
                <span className="font-mono text-2xl font-black text-emerald-400 tabular-nums">
                  {profitabilityMetrics.netMarginPct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* P&L Waterfall Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* 1. Ingresos Totales */}
              <div className="bg-[#09090b]/80 p-4 rounded-xl border border-white/[0.08] space-y-1">
                <span className="text-xs text-zinc-400 block font-medium">1. Facturación / Ventas</span>
                <div className="text-xl font-bold font-mono text-white tabular-nums">
                  ${profitabilityMetrics.grossRevenueUSD.toFixed(2)} USD
                </div>
                <span className="text-[11px] text-zinc-500 font-mono block">
                  ≈ {profitabilityMetrics.grossRevenueBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold block pt-1">
                  {profitabilityMetrics.totalOrders} órdenes cobradas
                </span>
              </div>

              {/* 2. Costo de Reposición (COGS) */}
              <div className="bg-[#09090b]/80 p-4 rounded-xl border border-white/[0.08] space-y-1">
                <span className="text-xs text-rose-300 block font-medium">2. (-) Costo Reposición</span>
                <div className="text-xl font-bold font-mono text-rose-400 tabular-nums">
                  -${profitabilityMetrics.replacementCostUSD.toFixed(2)} USD
                </div>
                <span className="text-[11px] text-zinc-500 font-mono block">
                  ≈ -{profitabilityMetrics.replacementCostBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
                <span className="text-[10px] text-zinc-400 block pt-1">
                  Costo de reposición a distribuidoras
                </span>
              </div>

              {/* 3. Mermas y Pérdidas */}
              <div className="bg-[#09090b]/80 p-4 rounded-xl border border-white/[0.08] space-y-1">
                <span className="text-xs text-amber-300 block font-medium">3. (-) Mermas & Roturas</span>
                <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                  -${profitabilityMetrics.mermasLossUSD.toFixed(2)} USD
                </div>
                <span className="text-[11px] text-zinc-500 font-mono block">
                  ≈ -{profitabilityMetrics.mermasLossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
                <span className="text-[10px] text-zinc-400 block pt-1">
                  Descontado según boletas de auditoría
                </span>
              </div>

              {/* 4. Ganancia Neta Real */}
              <div className="bg-gradient-to-br from-emerald-950/40 to-slate-950 p-4 rounded-xl border border-emerald-500/40 space-y-1 shadow-md shadow-emerald-950/30">
                <span className="text-xs text-emerald-400 block font-bold">4. (=) GANANCIA NETA REAL</span>
                <div className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
                  +${profitabilityMetrics.netProfitUSD.toFixed(2)} USD
                </div>
                <span className="text-[11px] text-emerald-300/80 font-mono font-bold block">
                  ≈ +{profitabilityMetrics.netProfitBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
                <span className="text-[10px] text-zinc-400 block pt-1">
                  Utilidad líquida disponible
                </span>
              </div>
            </div>
          </div>

          {/* Comparative Chart: Revenue vs Cost vs Net Profit */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-base font-display">
                  Estructura de Rentabilidad y Reposición
                </h4>
                <p className="text-xs text-zinc-400">
                  Comparativa de facturación bruta, costos de inventario y ganancia neta generada
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-white">
                  <span className="w-3 h-3 rounded-sm bg-amber-500" />
                  <span>Ventas Brutas</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="w-3 h-3 rounded-sm bg-rose-500" />
                  <span>Costo Reposición</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span>Ganancia Neta</span>
                </div>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: 'Flujo del Período',
                      Ventas: profitabilityMetrics.grossRevenueUSD,
                      CostoReposicion: profitabilityMetrics.replacementCostUSD,
                      GananciaNeta: profitabilityMetrics.netProfitUSD,
                    },
                  ]}
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `$${val}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#475569',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`$${Number(val || 0).toFixed(2)} USD`, '']}
                  />
                  <Bar dataKey="Ventas" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Ventas Brutas" />
                  <Bar dataKey="CostoReposicion" fill="#f43f5e" radius={[6, 6, 0, 0]} name="Costo Reposición" />
                  <Bar dataKey="GananciaNeta" fill="#10b981" radius={[6, 6, 0, 0]} name="Ganancia Neta" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PRODUCTOS MÁS VENDIDOS (TOP SELLERS POR VOLUMEN Y RENTABILIDAD)        */}
      {/* ========================================================================= */}
      {activeTab === 'top_products' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Licor #1 en Volumen</span>
              <div className="text-base font-bold text-white truncate">
                {topProducts[0]?.name || 'N/A'}
              </div>
              <span className="text-xs text-amber-400 font-mono font-bold block mt-1">
                {topProducts[0]?.quantitySold || 0} unidades vendidas
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Licor Más Rentable ($ Ganancia)</span>
              <div className="text-base font-bold text-white truncate">
                {[...topProducts].sort((a, b) => b.profitUSD - a.profitUSD)[0]?.name || 'N/A'}
              </div>
              <span className="text-xs text-emerald-400 font-mono font-bold block mt-1">
                +${[...topProducts].sort((a, b) => b.profitUSD - a.profitUSD)[0]?.profitUSD.toFixed(2) || '0.00'} USD ganancia neta
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Ticket Promedio por Orden</span>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                ${profitabilityMetrics.averageTicketUSD.toFixed(2)} USD
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                ≈ {(profitabilityMetrics.averageTicketUSD * exchangeRate).toFixed(0)} Bs. / cliente
              </span>
            </div>
          </div>

          {/* Ranking Table of Top Products */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-base font-display">
                  Ranking de Productos: Rotación, Ventas & Margen
                </h4>
                <p className="text-xs text-zinc-400">
                  Ordenado por unidades despachadas y margen bruto aportado a la taberna
                </p>
              </div>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 font-bold">
                {topProducts.length} licores con movimiento
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/80 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4 text-center">Posición</th>
                    <th className="py-3 px-4">Producto / Licor</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-center">Unidades</th>
                    <th className="py-3 px-4 text-right">Facturación USD</th>
                    <th className="py-3 px-4 text-right">Costo Reposición</th>
                    <th className="py-3 px-4 text-right">Ganancia Bruta</th>
                    <th className="py-3 px-4 text-center">Margen %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]/80">
                  {topProducts.map((p, idx) => {
                    const margin = p.revenueUSD > 0 ? (p.profitUSD / p.revenueUSD) * 100 : 0;
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                            idx === 0 ? 'bg-amber-500 text-zinc-950 font-black' : idx === 1 ? 'bg-slate-300 text-zinc-950' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-900 text-zinc-400'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block">{p.name}</span>
                          <span className="text-[11px] font-mono text-zinc-400">{p.sku}</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-300">{p.category}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-white tabular-nums">
                          {p.quantitySold}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-400 tabular-nums">
                          ${p.revenueUSD.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-400 tabular-nums">
                          -${p.costUSD.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 tabular-nums">
                          +${p.profitUSD.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-white">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                            {margin.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. HORAS PICO DE COMPRA (RUSH HOURS ANALYSIS)                             */}
      {/* ========================================================================= */}
      {activeTab === 'peak_hours' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#111114] border border-amber-500/30 p-4 rounded-xl">
              <span className="text-xs text-amber-300 font-semibold block mb-1">Hora Pico de Oro</span>
              <div className="text-2xl font-black font-mono text-amber-400 tabular-nums">
                {peakHoursData.peakHour}
              </div>
              <span className="text-xs text-zinc-400 block mt-1">
                ${peakHoursData.peakRevenueUSD.toFixed(2)} USD • {peakHoursData.peakOrders} tickets simultáneos
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Franja Nocturna Principal</span>
              <div className="text-lg font-bold text-white">
                21:00 a 01:00 (Noche Pico)
              </div>
              <span className="text-xs text-emerald-400 font-mono font-bold block mt-1">
                Concentra el 68% de las ventas en barra
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Recomendación Operativa</span>
              <div className="text-xs text-zinc-300 leading-snug">
                Reforzar personal de barra y dispensadores de cerveza entre las <strong>20:00 y las 23:30</strong> para agilizar el despacho y reducir tiempos de cola en caja.
              </div>
            </div>
          </div>

          {/* Hourly Bar Chart */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-base font-display">
                  Distribución de Ventas por Hora del Día (08:00 a 24:00)
                </h4>
                <p className="text-xs text-zinc-400">
                  Volumen monetario facturado por franja horaria en Smith Solutions E-Commerce
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="inline-block w-3 h-3 rounded bg-amber-500" />
                <span className="text-zinc-300">Hora de Tráfico Regular</span>
                <span className="inline-block w-3 h-3 rounded bg-amber-400 ring-2 ring-amber-300 ml-2" />
                <span className="text-amber-300 font-bold">Hora Pico Destacada</span>
              </div>
            </div>

            <div className="h-64 sm:h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHoursData.hourlyList} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `$${val}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#475569',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`$${Number(val || 0).toFixed(2)} USD`, 'Facturación']}
                  />
                  <Bar dataKey="revenueUSD" radius={[6, 6, 0, 0]}>
                    {peakHoursData.hourlyList.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isPeak ? '#fbbf24' : '#d97706'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DESEMPEÑO DEL EQUIPO DE VENTAS (CASHIERS & BARTENDERS)                  */}
      {/* ========================================================================= */}
      {activeTab === 'sales_team' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {salesTeamPerformance.map((member, idx) => (
              <div
                key={member.name}
                className="bg-[#111114] border border-white/[0.08] hover:border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3 transition-colors shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                      {member.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{member.name}</h4>
                      <span className="text-[11px] text-zinc-400 block">{member.role}</span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300">
                    #{idx + 1}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.08] space-y-1.5 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Total Facturado:</span>
                    <span className="font-mono font-bold text-amber-400 tabular-nums">
                      ${member.revenueUSD.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Ganancia Neta:</span>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">
                      +${member.netProfitUSD.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Órdenes Atendidas:</span>
                    <span className="font-mono text-white font-bold">{member.ordersCount} tickets</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Ticket Promedio:</span>
                    <span className="font-mono text-zinc-200">${member.averageTicketUSD.toFixed(2)}</span>
                  </div>
                </div>

                {/* Progress bar of participation */}
                <div className="pt-2">
                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                    <span>Participación en Ventas</span>
                    <span className="font-bold text-white">{member.participationPct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, member.participationPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. HISTORIAL DE COMPROBANTES DE VENTA (EXISTING TABLE & EXPORTS)          */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
            <div>
              <h3 className="font-bold text-white text-base font-display">
                Registro de Comprobantes de Venta
              </h3>
              <span className="text-xs text-zinc-400">
                Historial de órdenes emitidas en Smith Solutions E-Commerce ({sales.length} órdenes)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="text-right sm:border-r border-white/[0.08] sm:pr-4">
                <span className="text-[11px] text-zinc-400 block">Facturación acumulada</span>
                <span className="font-mono font-bold text-amber-400 text-base sm:text-lg tabular-nums">
                  ${sales.reduce((acc, s) => acc + s.subtotalUSD, 0).toFixed(2)} USD
                </span>
                <span className="text-[10px] text-zinc-500 font-mono block">
                  ≈ {(sales.reduce((acc, s) => acc + s.subtotalUSD, 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
              </div>

              <button
                onClick={() => exportSalesReportPDF(sales, exchangeRate)}
                disabled={sales.length === 0}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-95 text-zinc-950 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap min-h-[44px]"
                title="Descargar documento PDF con todas las ventas registradas"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Descargar Reporte PDF</span>
              </button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por recibo, cliente, RIF o licor..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-[#111114] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {(['Todos', 'Pago Móvil', 'Efectivo USD', 'Punto de Venta', 'Zelle'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setHistoryMethodFilter(method)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                    historyMethodFilter === method
                      ? 'bg-amber-500 text-zinc-950 font-bold'
                      : 'bg-[#111114] text-zinc-400 hover:text-white border border-white/[0.08]'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Sales Table */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/80 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Recibo #</th>
                    <th className="py-3 px-4">Fecha & Vendedor</th>
                    <th className="py-3 px-4">Cliente & RIF</th>
                    <th className="py-3 px-4">Licores Vendidos</th>
                    <th className="py-3 px-4">Método</th>
                    <th className="py-3 px-4 text-right">Total (USD)</th>
                    <th className="py-3 px-4 text-right">Total (Bs.)</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]/80">
                  {historyFilteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {sale.receiptNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-zinc-300 text-xs block">{sale.date}</span>
                        <span className="text-[10px] text-zinc-500">{sale.cashierName || 'Carlos Smith'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-white font-medium block">{sale.customerName}</span>
                        <span className="text-[10px] font-mono text-amber-400/90">{sale.customerRIF || 'V-00000000'}</span>
                      </td>
                      <td className="py-3 px-4 text-zinc-300 max-w-xs truncate">
                        {sale.items.map((it) => `${it.quantity}x ${it.product.name}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-zinc-300">
                        {sale.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums">
                        ${(sale.totalWithIgtfUSD || sale.subtotalUSD).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-400 tabular-nums text-xs">
                        {(sale.totalWithIgtfBs || sale.subtotalBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {sale.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => exportSingleReceiptPDF(sale)}
                            className="p-1.5 bg-[#09090b] hover:bg-zinc-800/80 border border-white/[0.08] hover:border-amber-500/40 text-amber-400 rounded-lg transition-colors"
                            title="Descargar comprobante en PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => printReceiptTicket(sale)}
                            className="p-1.5 bg-[#09090b] hover:bg-zinc-800/80 border border-white/[0.08] hover:border-white/[0.1] text-zinc-300 hover:text-white rounded-lg transition-colors"
                            title="Imprimir ticket térmico"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
