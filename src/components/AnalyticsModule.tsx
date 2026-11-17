import React, { useState, useMemo } from 'react';
import { Sale, Product, InventoryAuditLog, StoreTenant } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
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
  BarChart3,
  Receipt,
  ShieldCheck,
  UserCheck,
  Mail,
  RefreshCw,
  AlertTriangle,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon
} from 'lucide-react';
import { exportSingleReceiptPDF, printReceiptTicket, exportSalesReportPDF } from '../utils/pdfExport';
import { dispatchStoreEmail, getLocalStoreEmailConfig } from '../services/emailDeliveryService';
import {
  getCaracasDateString,
  getCaracasYesterdayDateString,
} from '../utils/venezuelaTime';

interface AnalyticsModuleProps {
  sales: Sale[];
  products: Product[];
  exchangeRate: number;
  audits?: InventoryAuditLog[];
  activeStore?: StoreTenant | null;
  onOpenEmailConfig?: () => void;
  onGoToPOS?: () => void;
}

type PeriodFilter = 'today' | 'yesterday' | '7days' | 'month';

const SPANISH_MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const SPANISH_MONTHS_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  'Pago Móvil': '#f59e0b',
  'Efectivo USD': '#10b981',
  'Zelle': '#38bdf8',
  'Punto de Venta': '#a855f7',
  'Efectivo Bs': '#f97316',
  'Fiado (Crédito)': '#f43f5e',
};

const FALLBACK_PIE_COLORS = ['#f59e0b', '#10b981', '#38bdf8', '#a855f7', '#f97316', '#f43f5e'];

export const AnalyticsModule: React.FC<AnalyticsModuleProps> = ({
  sales,
  products,
  exchangeRate,
  audits = [],
  activeStore = null,
  onOpenEmailConfig,
  onGoToPOS,
}) => {
  // Navigation Sub-tab
  const [activeTab, setActiveTab] = useState<'profitability' | 'visual_reports' | 'top_products' | 'peak_hours' | 'sales_team' | 'history'>('profitability');
  const [period, setPeriod] = useState<PeriodFilter>('7days');
  const [trendMonthsRange, setTrendMonthsRange] = useState<6 | 12>(6);
  const [dailyChartMetric, setDailyChartMetric] = useState<'usd' | 'orders'>('usd');
  const [paymentChartScope, setPaymentChartScope] = useState<'period' | 'all'>('period');
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('Todos');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Filter sales based on period
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = getCaracasDateString(now);
    const yesterdayStr = getCaracasYesterdayDateString(now);

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

  // 6. REPORTES VISUALES: TENDENCIA DE VENTAS MENSUALES (LineChart)
  const monthlySalesTrend = useMemo(() => {
    const parseSaleYearMonth = (rawDate: string): { year: number; month: number } | null => {
      const isoMatch = rawDate.match(/^(\d{4})-(\d{2})/);
      if (isoMatch) {
        const y = parseInt(isoMatch[1], 10);
        const m = parseInt(isoMatch[2], 10) - 1;
        if (m >= 0 && m <= 11) return { year: y, month: m };
      }
      const parsed = new Date(rawDate.replace(' ', 'T'));
      if (!Number.isNaN(parsed.getTime())) {
        return { year: parsed.getFullYear(), month: parsed.getMonth() };
      }
      return null;
    };

    const buckets: Record<string, { ventasUSD: number; gananciaUSD: number; ordenes: number }> = {};
    let anchorDate = new Date();

    sales.forEach((sale) => {
      const ym = parseSaleYearMonth(sale.date);
      if (!ym) return;
      const key = `${ym.year}-${String(ym.month + 1).padStart(2, '0')}`;
      if (!buckets[key]) {
        buckets[key] = { ventasUSD: 0, gananciaUSD: 0, ordenes: 0 };
      }
      const saleTotal = sale.totalWithIgtfUSD ?? sale.subtotalUSD;
      const saleCost = sale.items.reduce(
        (sum, item) => sum + (item.product.costUSD || 0) * item.quantity,
        0
      );
      buckets[key].ventasUSD += saleTotal;
      buckets[key].gananciaUSD += Math.max(0, sale.subtotalUSD - saleCost);
      buckets[key].ordenes += 1;

      const candidate = new Date(ym.year, ym.month, 1);
      if (candidate > anchorDate) {
        anchorDate = candidate;
      }
    });

    const points: {
      monthKey: string;
      label: string;
      fullLabel: string;
      ventasUSD: number;
      gananciaUSD: number;
      ordenes: number;
    }[] = [];

    for (let offset = trendMonthsRange - 1; offset >= 0; offset--) {
      const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const bucket = buckets[key] || { ventasUSD: 0, gananciaUSD: 0, ordenes: 0 };

      points.push({
        monthKey: key,
        label: `${SPANISH_MONTHS_SHORT[m]} ${String(y).slice(-2)}`,
        fullLabel: `${SPANISH_MONTHS_FULL[m]} ${y}`,
        ventasUSD: Number(bucket.ventasUSD.toFixed(2)),
        gananciaUSD: Number(bucket.gananciaUSD.toFixed(2)),
        ordenes: bucket.ordenes,
      });
    }

    const totalRangeUSD = points.reduce((acc, p) => acc + p.ventasUSD, 0);
    const activeMonthsCount = points.filter((p) => p.ventasUSD > 0).length;
    const bestMonth = points.reduce(
      (best, cur) => (cur.ventasUSD > best.ventasUSD ? cur : best),
      points[0]
    );
    const prevMonth = points[points.length - 2];
    const currentMonth = points[points.length - 1];
    const momGrowthPct =
      prevMonth && prevMonth.ventasUSD > 0
        ? ((currentMonth.ventasUSD - prevMonth.ventasUSD) / prevMonth.ventasUSD) * 100
        : null;

    return {
      points,
      totalRangeUSD,
      avgActiveMonthUSD: activeMonthsCount > 0 ? totalRangeUSD / activeMonthsCount : 0,
      bestMonth,
      momGrowthPct,
    };
  }, [sales, trendMonthsRange]);

  // 6B. REPORTES VISUALES: TENDENCIA DE VENTAS DIARIAS ÚLTIMOS 30 DÍAS (LineChart)
  const dailySalesTrend30Days = useMemo(() => {
    const parseSaleDateKey = (rawDate: string): string | null => {
      if (!rawDate) return null;
      const trimmed = rawDate.trim();
      const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoPrefix) return isoPrefix[1];
      const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
      const parsed = new Date(trimmed.replace(' ', 'T'));
      if (!Number.isNaN(parsed.getTime())) {
        return getCaracasDateString(parsed);
      }
      return null;
    };

    const buckets: Record<string, { ventasUSD: number; gananciaUSD: number; ordenes: number }> = {};
    sales.forEach((sale) => {
      const dateKey = parseSaleDateKey(sale.date);
      if (!dateKey) return;
      if (!buckets[dateKey]) {
        buckets[dateKey] = { ventasUSD: 0, gananciaUSD: 0, ordenes: 0 };
      }
      const saleTotal = sale.totalWithIgtfUSD ?? sale.subtotalUSD;
      const saleCost = sale.items.reduce(
        (sum, item) => sum + (item.product.costUSD || 0) * item.quantity,
        0
      );
      buckets[dateKey].ventasUSD += saleTotal;
      buckets[dateKey].gananciaUSD += Math.max(0, sale.subtotalUSD - saleCost);
      buckets[dateKey].ordenes += 1;
    });

    const todayKey = getCaracasDateString(new Date());
    const [tY, tM, tD] = todayKey.split('-').map((n) => parseInt(n, 10));
    const todayNoonUtc = Date.UTC(tY, tM - 1, tD, 12, 0, 0);

    const points: {
      dateKey: string;
      label: string;
      fullLabel: string;
      ventasUSD: number;
      gananciaUSD: number;
      ordenes: number;
    }[] = [];

    for (let offset = 29; offset >= 0; offset--) {
      const dayUtc = new Date(todayNoonUtc - offset * 86400000);
      const y = dayUtc.getUTCFullYear();
      const m = String(dayUtc.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dayUtc.getUTCDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;
      const bucket = buckets[dateKey] || { ventasUSD: 0, gananciaUSD: 0, ordenes: 0 };

      points.push({
        dateKey,
        label: `${d}/${m}`,
        fullLabel: `${d}/${m}/${y}`,
        ventasUSD: Number(bucket.ventasUSD.toFixed(2)),
        gananciaUSD: Number(bucket.gananciaUSD.toFixed(2)),
        ordenes: bucket.ordenes,
      });
    }

    const total30DaysUSD = points.reduce((sum, p) => sum + p.ventasUSD, 0);
    const total30DaysProfitUSD = points.reduce((sum, p) => sum + p.gananciaUSD, 0);
    const total30DaysOrders = points.reduce((sum, p) => sum + p.ordenes, 0);
    const activeDaysCount = points.filter((p) => p.ordenes > 0).length;
    const peakDay = points.reduce(
      (best, cur) => (cur.ventasUSD > best.ventasUSD ? cur : best),
      points[0]
    );

    return {
      points,
      total30DaysUSD,
      total30DaysProfitUSD,
      total30DaysOrders,
      activeDaysCount,
      dailyAvgUSD: total30DaysUSD / 30,
      peakDay,
    };
  }, [sales]);

  // 7. REPORTES VISUALES: DESGLOSE DE MÉTODOS DE PAGO (PieChart)
  const paymentMethodsBreakdown = useMemo(() => {
    const sourceSales = paymentChartScope === 'all' ? sales : filteredSales;
    const grouped: Record<string, { method: string; valueUSD: number; count: number }> = {};

    sourceSales.forEach((sale) => {
      const method = sale.paymentMethod || 'Otro';
      const amount = sale.totalWithIgtfUSD ?? sale.subtotalUSD;
      if (!grouped[method]) {
        grouped[method] = { method, valueUSD: 0, count: 0 };
      }
      grouped[method].valueUSD += amount;
      grouped[method].count += 1;
    });

    const totalUSD = Object.values(grouped).reduce((sum, g) => sum + g.valueUSD, 0);
    const items = Object.values(grouped)
      .sort((a, b) => b.valueUSD - a.valueUSD)
      .map((entry, idx) => ({
        ...entry,
        valueUSD: Number(entry.valueUSD.toFixed(2)),
        percentage: totalUSD > 0 ? (entry.valueUSD / totalUSD) * 100 : 0,
        color:
          PAYMENT_METHOD_COLORS[entry.method] ||
          FALLBACK_PIE_COLORS[idx % FALLBACK_PIE_COLORS.length],
      }));

    return {
      items,
      totalUSD,
      totalOrders: sourceSales.length,
    };
  }, [sales, filteredSales, paymentChartScope]);

  const handleSendSalesReportEmail = async () => {
    const storeId = activeStore?.id || 'default-warehouse';
    const storeName = activeStore?.storeName || 'Almacén & POS';
    const cfg = getLocalStoreEmailConfig(storeId, activeStore?.ownerUid || '');

    const hasCredentials =
      cfg.isEnabled &&
      Boolean(cfg.recipientEmail) &&
      ((cfg.provider === 'resend' && Boolean(cfg.resendApiKey)) ||
        (cfg.provider === 'smtp' && Boolean(cfg.smtpHost && cfg.smtpPass)));

    if (!hasCredentials) {
      setReportFeedback({
        type: 'error',
        text: 'Configura primero tu servidor SMTP o clave API de Resend en la pestaña "SMTP / Alertas".',
      });
      return;
    }

    const periodLabels: Record<PeriodFilter, string> = {
      today: 'Hoy',
      yesterday: 'Ayer',
      '7days': 'Últimos 7 días',
      month: 'Mes actual',
    };

    const paymentMap: Record<string, { method: string; count: number; totalUSD: number }> = {};
    filteredSales.forEach((s) => {
      if (!paymentMap[s.paymentMethod]) {
        paymentMap[s.paymentMethod] = { method: s.paymentMethod, count: 0, totalUSD: 0 };
      }
      paymentMap[s.paymentMethod].count += 1;
      paymentMap[s.paymentMethod].totalUSD += s.totalWithIgtfUSD || s.subtotalUSD;
    });

    setIsSendingReport(true);
    setReportFeedback(null);
    try {
      const res = await dispatchStoreEmail({
        action: 'sales_report',
        storeId,
        storeName,
        exchangeRate,
        config: cfg,
        triggerEvent: `Envío manual desde Analítica (${periodLabels[period]})`,
        salesSummary: {
          periodLabel: periodLabels[period],
          totalOrders: profitabilityMetrics.totalOrders,
          grossRevenueUSD: profitabilityMetrics.grossRevenueUSD,
          costOfGoodsUSD: profitabilityMetrics.replacementCostUSD,
          mermasLossUSD: profitabilityMetrics.mermasLossUSD,
          netProfitUSD: profitabilityMetrics.netProfitUSD,
          paymentBreakdown: Object.values(paymentMap),
          topItems: topProducts.slice(0, 8).map((p) => ({
            name: p.name,
            quantity: p.quantitySold,
            revenueUSD: p.revenueUSD,
          })),
        },
      });
      setReportFeedback({
        type: res.ok ? 'success' : 'error',
        text: res.ok
          ? `Reporte enviado a ${cfg.recipientEmail} (${res.message})`
          : res.message,
      });
    } finally {
      setIsSendingReport(false);
    }
  };

  const renderVisualReportsSection = () => (
    <section aria-label="Reportes Visuales" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-mono font-semibold text-amber-400 tracking-wide">
            Reportes Visuales · Analítica Gráfica
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-white font-display">
            Reportes Visuales de Ventas y Cobros
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Tendencia mensual de ingresos frente a ganancia bruta y distribución por método de pago.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono tabular-nums">
          <span>{sales.length} ventas totales</span>
          <span aria-hidden="true">·</span>
          <span>Tasa BCV: {exchangeRate.toFixed(2)} Bs/$</span>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4 space-y-1">
          <span className="text-xs text-zinc-400 block">
            Facturación ({trendMonthsRange} meses)
          </span>
          <div className="text-xl font-bold font-mono text-white tabular-nums">
            ${monthlySalesTrend.totalRangeUSD.toFixed(2)} USD
          </div>
          <span className="text-[11px] text-zinc-400 font-mono tabular-nums block">
            Promedio mensual activo: ${monthlySalesTrend.avgActiveMonthUSD.toFixed(2)} USD
          </span>
        </div>

        <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4 space-y-1">
          <span className="text-xs text-zinc-400 block">Mes con Mayor Facturación</span>
          <div className="text-xl font-bold font-mono text-amber-400 tabular-nums truncate">
            {monthlySalesTrend.bestMonth && monthlySalesTrend.bestMonth.ventasUSD > 0
              ? monthlySalesTrend.bestMonth.fullLabel
              : 'Sin ventas aún'}
          </div>
          <span className="text-[11px] text-zinc-400 font-mono tabular-nums block">
            {monthlySalesTrend.bestMonth && monthlySalesTrend.bestMonth.ventasUSD > 0
              ? `$${monthlySalesTrend.bestMonth.ventasUSD.toFixed(2)} USD · ${monthlySalesTrend.bestMonth.ordenes} órdenes`
              : 'Registra tu primera venta en POS'}
          </span>
        </div>

        <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4 space-y-1">
          <span className="text-xs text-zinc-400 block">Método de Pago Principal</span>
          <div className="text-xl font-bold font-mono text-emerald-400 truncate">
            {paymentMethodsBreakdown.items[0]?.method || 'Sin registros'}
          </div>
          <span className="text-[11px] text-zinc-400 font-mono tabular-nums block">
            {paymentMethodsBreakdown.items[0]
              ? `${paymentMethodsBreakdown.items[0].percentage.toFixed(1)}% del volumen · $${paymentMethodsBreakdown.items[0].valueUSD.toFixed(2)} USD`
              : 'Esperando transacciones'}
          </span>
        </div>
      </div>

      {/* Chart 0: 30-Day Daily Sales Trend LineChart (Recharts) */}
      <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex items-start gap-2.5">
            <TrendingUp className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-white text-base font-display">
                Tendencia de Ventas Diarias · Últimos 30 Días
              </h4>
              <p className="text-xs text-zinc-400">
                Evolución diaria continua integrando las ventas registradas ({dailySalesTrend30Days.total30DaysOrders} órdenes en {dailySalesTrend30Days.activeDaysCount} días activos)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <div className="text-right font-mono tabular-nums hidden sm:block pr-2 border-r border-white/[0.08]">
              <span className="text-[11px] text-zinc-400 block">Acumulado 30 días</span>
              <span className="text-sm font-bold text-amber-400">
                ${dailySalesTrend30Days.total30DaysUSD.toFixed(2)} USD
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#09090b] p-1 rounded-xl border border-white/[0.08] text-xs shrink-0">
              <button
                type="button"
                onClick={() => setDailyChartMetric('usd')}
                className={`px-3 py-1.5 min-h-[34px] rounded-lg font-semibold transition-colors whitespace-nowrap ${
                  dailyChartMetric === 'usd'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Montos (USD)
              </button>
              <button
                type="button"
                onClick={() => setDailyChartMetric('orders')}
                className={`px-3 py-1.5 min-h-[34px] rounded-lg font-semibold transition-colors whitespace-nowrap ${
                  dailyChartMetric === 'orders'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Órdenes
              </button>
            </div>
          </div>
        </div>

        {/* 30-Day Micro KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#09090b] border border-white/[0.06] rounded-xl p-3">
            <span className="text-zinc-400 block text-[11px]">Ventas 30 Días</span>
            <span className="text-sm sm:text-base font-bold font-mono text-white tabular-nums">
              ${dailySalesTrend30Days.total30DaysUSD.toFixed(2)}
            </span>
          </div>
          <div className="bg-[#09090b] border border-white/[0.06] rounded-xl p-3">
            <span className="text-zinc-400 block text-[11px]">Ganancia Bruta 30d</span>
            <span className="text-sm sm:text-base font-bold font-mono text-emerald-400 tabular-nums">
              ${dailySalesTrend30Days.total30DaysProfitUSD.toFixed(2)}
            </span>
          </div>
          <div className="bg-[#09090b] border border-white/[0.06] rounded-xl p-3">
            <span className="text-zinc-400 block text-[11px]">Promedio Diario</span>
            <span className="text-sm sm:text-base font-bold font-mono text-amber-400 tabular-nums">
              ${dailySalesTrend30Days.dailyAvgUSD.toFixed(2)}/día
            </span>
          </div>
          <div className="bg-[#09090b] border border-white/[0.06] rounded-xl p-3">
            <span className="text-zinc-400 block text-[11px]">Mejor Día (30d)</span>
            <span className="text-sm sm:text-base font-bold font-mono text-white tabular-nums truncate block">
              {dailySalesTrend30Days.peakDay && dailySalesTrend30Days.peakDay.ventasUSD > 0
                ? `${dailySalesTrend30Days.peakDay.label} · $${dailySalesTrend30Days.peakDay.ventasUSD.toFixed(2)}`
                : 'Sin ventas'}
            </span>
          </div>
        </div>

        {sales.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center px-4 space-y-3">
            <TrendingUp className="w-10 h-10 text-zinc-600" />
            <div className="space-y-1 max-w-sm">
              <p className="text-sm font-semibold text-zinc-200">
                Sin ventas registradas en los últimos 30 días
              </p>
              <p className="text-xs text-zinc-400">
                Al completar ventas en el POS o recibir pedidos web, aquí verás la curva diaria de los últimos 30 días.
              </p>
            </div>
            {onGoToPOS && (
              <button
                type="button"
                onClick={onGoToPOS}
                className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors"
              >
                Ir al Punto de Venta POS
              </button>
            )}
          </div>
        ) : (
          <div className="h-72 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailySalesTrend30Days.points}
                margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.8} />
                <XAxis
                  dataKey="label"
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickLine={false}
                  interval={3}
                  axisLine={{ stroke: '#27272a' }}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#27272a' }}
                  width={56}
                  allowDecimals={dailyChartMetric === 'usd'}
                  tickFormatter={(val) => (dailyChartMetric === 'usd' ? `$${val}` : `${val}`)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const point = payload[0]?.payload as {
                      fullLabel: string;
                      ventasUSD: number;
                      gananciaUSD: number;
                      ordenes: number;
                    };
                    return (
                      <div className="bg-[#09090b] border border-white/[0.14] rounded-xl px-3.5 py-2.5 shadow-xl text-xs space-y-1.5">
                        <div className="font-bold text-white border-b border-white/[0.08] pb-1 font-mono tabular-nums">
                          {point.fullLabel} · {point.ordenes}{' '}
                          {point.ordenes === 1 ? 'orden' : 'órdenes'}
                        </div>
                        <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
                          <span className="text-amber-400">Ventas del día:</span>
                          <span className="font-bold text-white">
                            ${point.ventasUSD.toFixed(2)} USD
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
                          <span className="text-emerald-400">Ganancia bruta:</span>
                          <span className="font-bold text-emerald-300">
                            ${point.gananciaUSD.toFixed(2)} USD
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono tabular-nums pt-0.5">
                          ≈ {(point.ventasUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                {dailyChartMetric === 'usd' ? (
                  <>
                    <Line
                      type="monotone"
                      dataKey="ventasUSD"
                      name="Ventas Diarias (USD)"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={{ r: 2.5, fill: '#f59e0b', stroke: '#09090b', strokeWidth: 1.5 }}
                      activeDot={{ r: 6, fill: '#fbbf24' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="gananciaUSD"
                      name="Ganancia Bruta (USD)"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{ r: 5, fill: '#34d399' }}
                    />
                  </>
                ) : (
                  <Line
                    type="monotone"
                    dataKey="ordenes"
                    name="Órdenes por Día"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#38bdf8', stroke: '#09090b', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: '#7dd3fc' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 2-Column Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Chart 1: LineChart — Tendencia de Ventas Mensuales */}
        <div className="xl:col-span-7 bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex items-start gap-2.5">
              <LineChartIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white text-base font-display">
                  Tendencia de Ventas Mensuales
                </h4>
                <p className="text-xs text-zinc-400">
                  Comparativa mensual entre ventas facturadas y ganancia bruta (USD)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-[#09090b] p-1 rounded-xl border border-white/[0.08] text-xs self-start sm:self-auto shrink-0">
              {([6, 12] as const).map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setTrendMonthsRange(months)}
                  className={`px-3 py-1.5 min-h-[34px] rounded-lg font-semibold transition-colors whitespace-nowrap ${
                    trendMonthsRange === months
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {months} Meses
                </button>
              ))}
            </div>
          </div>

          {sales.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center px-4 space-y-3">
              <LineChartIcon className="w-10 h-10 text-zinc-600" />
              <div className="space-y-1 max-w-sm">
                <p className="text-sm font-semibold text-zinc-200">
                  Sin datos de ventas mensuales todavía
                </p>
                <p className="text-xs text-zinc-400">
                  Cuando registres ventas en el Punto de Venta, aquí verás la curva mensual de facturación y ganancia bruta.
                </p>
              </div>
              {onGoToPOS && (
                <button
                  type="button"
                  onClick={onGoToPOS}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors"
                >
                  Registrar Primera Venta en POS
                </button>
              )}
            </div>
          ) : (
            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlySalesTrend.points}
                  margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.8} />
                  <XAxis
                    dataKey="label"
                    stroke="#a1a1aa"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                  />
                  <YAxis
                    stroke="#a1a1aa"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    width={56}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const point = payload[0]?.payload as {
                        fullLabel: string;
                        ventasUSD: number;
                        gananciaUSD: number;
                        ordenes: number;
                      };
                      return (
                        <div className="bg-[#09090b] border border-white/[0.14] rounded-xl px-3.5 py-2.5 shadow-xl text-xs space-y-1.5">
                          <div className="font-bold text-white border-b border-white/[0.08] pb-1">
                            {point.fullLabel} · {point.ordenes} órdenes
                          </div>
                          <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
                            <span className="text-amber-400">Ventas Totales:</span>
                            <span className="font-bold text-white">
                              ${point.ventasUSD.toFixed(2)} USD
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
                            <span className="text-emerald-400">Ganancia Bruta:</span>
                            <span className="font-bold text-emerald-300">
                              ${point.gananciaUSD.toFixed(2)} USD
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono tabular-nums pt-0.5">
                            ≈ {(point.ventasUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Line
                    type="monotone"
                    dataKey="ventasUSD"
                    name="Ventas Mensuales (USD)"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#f59e0b', stroke: '#09090b', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#fbbf24' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="gananciaUSD"
                    name="Ganancia Bruta (USD)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    strokeDasharray="5 4"
                    dot={{ r: 3.5, fill: '#10b981', stroke: '#09090b', strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: '#34d399' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: PieChart — Desglose de Métodos de Pago */}
        <div className="xl:col-span-5 bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex items-start gap-2.5">
              <PieChartIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white text-base font-display">
                  Métodos de Pago
                </h4>
                <p className="text-xs text-zinc-400">
                  Desglose porcentual por canal ({paymentMethodsBreakdown.totalOrders} transacciones)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-[#09090b] p-1 rounded-xl border border-white/[0.08] text-xs self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setPaymentChartScope('period')}
                className={`px-2.5 py-1.5 min-h-[34px] rounded-lg font-semibold transition-colors whitespace-nowrap ${
                  paymentChartScope === 'period'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Período
              </button>
              <button
                type="button"
                onClick={() => setPaymentChartScope('all')}
                className={`px-2.5 py-1.5 min-h-[34px] rounded-lg font-semibold transition-colors whitespace-nowrap ${
                  paymentChartScope === 'all'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Histórico
              </button>
            </div>
          </div>

          {paymentMethodsBreakdown.items.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center px-4 space-y-3">
              <PieChartIcon className="w-10 h-10 text-zinc-600" />
              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-semibold text-zinc-200">
                  Sin cobros registrados en este filtro
                </p>
                <p className="text-xs text-zinc-400">
                  {sales.length > 0
                    ? 'No hubo ventas en el período seleccionado. Puedes consultar el histórico acumulado.'
                    : 'Completa una venta en el POS para visualizar el desglose de métodos de pago.'}
                </p>
              </div>
              {sales.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPaymentChartScope('all')}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors"
                >
                  Ver Histórico ({sales.length} ventas)
                </button>
              ) : onGoToPOS ? (
                <button
                  type="button"
                  onClick={onGoToPOS}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors"
                >
                  Ir al POS
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-56 sm:h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodsBreakdown.items}
                      dataKey="valueUSD"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={86}
                      paddingAngle={2}
                      stroke="#111114"
                      strokeWidth={2}
                      labelLine={false}
                      label={({ percent }) =>
                        percent && percent >= 0.06 ? `${(percent * 100).toFixed(0)}%` : ''
                      }
                    >
                      {paymentMethodsBreakdown.items.map((entry) => (
                        <Cell key={entry.method} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const item = payload[0]?.payload as {
                          method: string;
                          valueUSD: number;
                          count: number;
                          percentage: number;
                          color: string;
                        };
                        return (
                          <div className="bg-[#09090b] border border-white/[0.14] rounded-xl px-3.5 py-2.5 shadow-xl text-xs space-y-1">
                            <div className="flex items-center gap-2 font-bold text-white">
                              <span
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span>{item.method}</span>
                            </div>
                            <div className="font-mono tabular-nums text-amber-400 font-bold">
                              ${item.valueUSD.toFixed(2)} USD ({item.percentage.toFixed(1)}%)
                            </div>
                            <div className="font-mono tabular-nums text-[11px] text-zinc-400">
                              {item.count} {item.count === 1 ? 'operación' : 'operaciones'} · ≈{' '}
                              {(item.valueUSD * exchangeRate).toLocaleString('es-VE', {
                                minimumFractionDigits: 2,
                              })}{' '}
                              Bs.
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Tabular Payment Breakdown */}
              <div className="border-t border-white/[0.08] pt-3 divide-y divide-white/[0.06] text-xs">
                {paymentMethodsBreakdown.items.map((item) => (
                  <div
                    key={item.method}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-zinc-200 font-medium truncate">{item.method}</span>
                      <span className="text-zinc-500 font-mono tabular-nums shrink-0">
                        ({item.count})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                      <span className="text-zinc-400">{item.percentage.toFixed(1)}%</span>
                      <span className="font-bold text-white w-20 text-right">
                        ${item.valueUSD.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      {reportFeedback && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-xl border text-xs ${
            reportFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {reportFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{reportFeedback.text}</span>
          </div>
          {reportFeedback.type === 'error' && onOpenEmailConfig && (
            <button
              type="button"
              onClick={onOpenEmailConfig}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-xs shrink-0 self-start sm:self-auto"
            >
              Configurar SMTP / Resend
            </button>
          )}
        </div>
      )}
      {/* Sub-Tabs Bar & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab('profitability')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'profitability'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-[#111114]'
            }`}
          >
            <DollarSign className="w-4 h-4 stroke-[2.5]" />
            <span>Rentabilidad Neta (P&L)</span>
          </button>

          <button
            onClick={() => setActiveTab('visual_reports')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'visual_reports'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-[#111114]'
            }`}
          >
            <LineChartIcon className="w-4 h-4" />
            <span>Reportes Visuales</span>
          </button>

          <button
            onClick={() => setActiveTab('top_products')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
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
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
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
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
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
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
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

              <div className="flex items-center gap-4 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleSendSalesReportEmail}
                  disabled={isSendingReport}
                  className="px-3.5 py-2 min-h-[42px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {isSendingReport ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  <span>{isSendingReport ? 'Enviando...' : 'Enviar Reporte por Correo'}</span>
                </button>
                <div className="text-right">
                  <span className="text-[11px] text-zinc-400 block">Margen Neto Real</span>
                  <span className="font-mono text-2xl font-black text-emerald-400 tabular-nums">
                    {profitabilityMetrics.netMarginPct.toFixed(1)}%
                  </span>
                </div>
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

          {/* Reportes Visuales integrados en la vista principal de Ventas */}
          {renderVisualReportsSection()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1B. REPORTES VISUALES (Gráfico de Líneas Mensual & Pastel Métodos Pago)   */}
      {/* ========================================================================= */}
      {activeTab === 'visual_reports' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {renderVisualReportsSection()}
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
                type="button"
                onClick={handleSendSalesReportEmail}
                disabled={isSendingReport}
                className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-amber-500/30 text-amber-300 font-semibold rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-colors disabled:opacity-40 whitespace-nowrap min-h-[44px]"
                title="Enviar resumen de ventas al correo configurado (SMTP / Resend)"
              >
                {isSendingReport ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                <span>{isSendingReport ? 'Enviando...' : 'Enviar por Correo'}</span>
              </button>

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
