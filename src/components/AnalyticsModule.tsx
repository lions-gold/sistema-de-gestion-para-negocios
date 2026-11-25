import React, { useState, useMemo } from 'react';
import { Sale, Product, InventoryAuditLog, StoreTenant } from '../types';
import { useSubsectionTranslation } from './LanguageSettings';
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
  Clock,
  Users,
  Flame,
  Download,
  Printer,
  Search,
  CheckCircle2,
  Receipt,
  Mail,
  RefreshCw,
  AlertTriangle,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon
} from 'lucide-react';
import { exportSingleReceiptPDF, printReceiptTicket, exportSalesReportPDF } from '../utils/pdfExport';
import { dispatchStoreEmail, getLocalStoreEmailConfig } from '../services/emailDeliveryService';
import { translateCategoryLabel } from '../utils/categoryI18n';
import { translatePaymentMethodLabel } from '../utils/platformLabelsI18n';
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

const MONTHS_SHORT_BY_LANG = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};
const MONTHS_FULL_BY_LANG = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  zh: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  'Pago Móvil': '#f59e0b',
  'Efectivo USD': '#10b981',
  'Zelle': '#38bdf8',
  'Punto de Venta': '#a855f7',
  'Efectivo Bs': '#f97316',
  'Fiado (Crédito)': '#f43f5e',
};

const FALLBACK_PIE_COLORS = ['#f59e0b', '#10b981', '#38bdf8', '#a855f7', '#f97316', '#f43f5e'];

function parseFlexibleSaleDate(rawDate: string): { dateObj: Date | null; isoDateStr: string } {
  const trimmed = (rawDate || '').trim();
  if (!trimmed) return { dateObj: null, isoDateStr: '' };

  const dmyMatch = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})(?:[\sT](\d{2}:\d{2}(?::\d{2})?))?/);
  if (dmyMatch) {
    const isoDateStr = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    const parsed = new Date(`${isoDateStr}T${dmyMatch[4] || '12:00:00'}`);
    return { dateObj: isNaN(parsed.getTime()) ? null : parsed, isoDateStr };
  }

  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[\sT](\d{2}:\d{2}(?::\d{2})?))?/);
  if (ymdMatch) {
    const isoDateStr = `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
    const parsed = new Date(`${isoDateStr}T${ymdMatch[4] || '12:00:00'}`);
    return { dateObj: isNaN(parsed.getTime()) ? null : parsed, isoDateStr };
  }

  const fallback = new Date(trimmed.replace(' ', 'T'));
  if (!isNaN(fallback.getTime())) {
    return { dateObj: fallback, isoDateStr: getCaracasDateString(fallback) };
  }
  return { dateObj: null, isoDateStr: trimmed.split(' ')[0] };
}

export const AnalyticsModule: React.FC<AnalyticsModuleProps> = ({
  sales,
  products: _products,
  exchangeRate,
  audits = [],
  activeStore = null,
  onOpenEmailConfig,
  onGoToPOS,
}) => {
  const { tr, lang } = useSubsectionTranslation('warehouse');
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
      const { dateObj: saleDate, isoDateStr: saleDateStr } = parseFlexibleSaleDate(s.date);

      if (period === 'today') {
        // If no sales match today, fall back to latest available sale date so data shows
        const hasToday = sales.some((x) => parseFlexibleSaleDate(x.date).isoDateStr === todayStr);
        if (hasToday) return saleDateStr === todayStr;
        const latest = parseFlexibleSaleDate(sales[sales.length - 1]?.date || '').isoDateStr;
        return saleDateStr === latest;
      }
      if (period === 'yesterday') {
        return saleDateStr === yesterdayStr;
      }
      if (period === '7days') {
        return (saleDate ? saleDate >= sevenDaysAgo : false) || sales.length <= 15; // show current window
      }
      if (period === 'month') {
        return (saleDate ? saleDate >= firstDayOfMonth : false) || sales.length <= 25;
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
      const seller = sale.cashierName || tr('Caja Principal', 'Main Cashier', '主收银台');
      if (!teamMap[seller]) {
        let role = tr('Cajero Principal', 'Lead Cashier', '首席收银员');
        if (seller.includes('Mendoza')) role = tr('Despacho & Almacén', 'Dispatch & Warehouse', '配货与仓库');
        if (seller.includes('Gómez')) role = tr('Atención VIP', 'VIP Service', '贵宾专员');
        if (seller.includes('Administración')) role = tr('Gerencia de Turno', 'Shift Management', '值班管理');

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
  }, [filteredSales, profitabilityMetrics.grossRevenueUSD, lang]);

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

    const monthsShort = MONTHS_SHORT_BY_LANG[lang] || MONTHS_SHORT_BY_LANG.es;
    const monthsFull = MONTHS_FULL_BY_LANG[lang] || MONTHS_FULL_BY_LANG.es;

    for (let offset = trendMonthsRange - 1; offset >= 0; offset--) {
      const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const bucket = buckets[key] || { ventasUSD: 0, gananciaUSD: 0, ordenes: 0 };

      points.push({
        monthKey: key,
        label: `${monthsShort[m]} ${String(y).slice(-2)}`,
        fullLabel: `${monthsFull[m]} ${y}`,
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
  }, [sales, trendMonthsRange, lang]);

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

  const methodLabel = (method: string) =>
    method === 'Todos'
      ? tr('Todos', 'All', '全部')
      : translatePaymentMethodLabel(method, lang);

  const handleSendSalesReportEmail = async () => {
    const storeId = activeStore?.id || 'default-warehouse';
    const storeName = activeStore?.storeName || tr('Almacén & POS', 'Warehouse & POS', '仓储与 POS');
    const cfg = getLocalStoreEmailConfig(storeId, activeStore?.ownerUid || '');

    const hasCredentials =
      cfg.isEnabled &&
      Boolean(cfg.recipientEmail) &&
      ((cfg.provider === 'resend' && Boolean(cfg.resendApiKey)) ||
        (cfg.provider === 'smtp' && Boolean(cfg.smtpHost && cfg.smtpPass)));

    if (!hasCredentials) {
      setReportFeedback({
        type: 'error',
        text: tr('Configura primero tu servidor SMTP o clave API de Resend en la pestaña "SMTP / Alertas".', 'Configure your SMTP server or Resend API key first in "SMTP / Alerts".', '请先在“SMTP / 通知”选项卡中配置您的 SMTP 服务器或 Resend API 密钥。'),
      });
      return;
    }

    const periodLabels: Record<PeriodFilter, string> = {
      today: tr('Hoy', 'Today', '今天'),
      yesterday: tr('Ayer', 'Yesterday', '昨天'),
      '7days': tr('Últimos 7 días', 'Last 7 days', '最近 7 天'),
      month: tr('Mes actual', 'Current month', '本月'),
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
        triggerEvent: `${tr('Envío manual desde Analítica', 'Manual dispatch from Analytics', '从分析页面手动发送')} (${periodLabels[period]})`,
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
          ? `${tr('Reporte enviado a', 'Report sent to', '报表已发送至')} ${cfg.recipientEmail} (${res.message})`
          : res.message,
      });
    } finally {
      setIsSendingReport(false);
    }
  };

  const renderVisualReportsSection = () => (
    <section aria-label={tr('Reportes Visuales', 'Visual Reports', '可视化报表')} className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-mono font-semibold text-amber-400 tracking-wide">
            {tr('Reportes Visuales · Analítica Gráfica', 'Visual Reports · Chart Analytics', '可视化报表 · 图表分析')}
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-white font-display">
            {tr('Reportes Visuales de Ventas y Cobros', 'Visual Sales & Collections Reports', '销售与收款可视化报表')}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {tr('Tendencia mensual de ingresos frente a ganancia bruta y distribución por método de pago.', 'Monthly revenue vs. gross profit trend and payment method breakdown.', '月度营收与毛利趋势及按收款方式分布。')}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono tabular-nums">
          <span>{sales.length} {tr('ventas totales', 'total sales', '笔总销售')}</span>
          <span aria-hidden="true">·</span>
          <span>{tr('Tasa BCV:', 'BCV Rate:', 'BCV 汇率：')} {exchangeRate.toFixed(2)} Bs/$</span>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4 space-y-1">
          <span className="text-xs text-zinc-400 block">
            {tr('Facturación', 'Revenue', '营业额')} ({trendMonthsRange} {tr('meses', 'months', '个月')})
          </span>
          <div className="text-xl font-bold font-mono text-white tabular-nums">
            ${monthlySalesTrend.totalRangeUSD.toFixed(2)} USD
          </div>
          <span className="text-[11px] text-zinc-400 font-mono tabular-nums block">
            {tr('Promedio mensual activo:', 'Active monthly avg:', '月均活跃营收：')} ${monthlySalesTrend.avgActiveMonthUSD.toFixed(2)} USD
          </span>
        </div>

        <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4 space-y-1">
          <span className="text-xs text-zinc-400 block">{tr('Mes con Mayor Facturación', 'Top Revenue Month', '最高营收月份')}</span>
          <div className="text-xl font-bold font-mono text-amber-400 tabular-nums truncate">
            {monthlySalesTrend.bestMonth && monthlySalesTrend.bestMonth.ventasUSD > 0
              ? monthlySalesTrend.bestMonth.fullLabel
              : tr('Sin ventas aún', 'No sales yet', '暂无销售')}
          </div>
          <span className="text-[11px] text-zinc-400 font-mono tabular-nums block">
            {monthlySalesTrend.bestMonth && monthlySalesTrend.bestMonth.ventasUSD > 0
              ? `$${monthlySalesTrend.bestMonth.ventasUSD.toFixed(2)} USD · ${monthlySalesTrend.bestMonth.ordenes} ${tr('órdenes', 'orders', '笔订单')}`
              : tr('Registra tu primera venta en POS', 'Log your first sale in POS', '请在 POS 登记第一笔销售')}
          </span>
        </div>

        <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4 space-y-1">
          <span className="text-xs text-zinc-400 block">{tr('Método de Pago Principal', 'Top Payment Method', '主要收款方式')}</span>
          <div className="text-xl font-bold font-mono text-emerald-400 truncate">
            {paymentMethodsBreakdown.items[0]?.method ? methodLabel(paymentMethodsBreakdown.items[0].method) : tr('Sin registros', 'No records', '暂无记录')}
          </div>
          <span className="text-[11px] text-zinc-400 font-mono tabular-nums block">
            {paymentMethodsBreakdown.items[0]
              ? `${paymentMethodsBreakdown.items[0].percentage.toFixed(1)}% ${tr('del volumen', 'of volume', '占比')} · $${paymentMethodsBreakdown.items[0].valueUSD.toFixed(2)} USD`
              : tr('Esperando transacciones', 'Awaiting transactions', '等待交易')}
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
                {tr('Tendencia de Ventas Diarias · Últimos 30 Días', 'Daily Sales Trend · Last 30 Days', '每日销售趋势 · 近 30 天')}
              </h4>
              <p className="text-xs text-zinc-400">
                {tr('Evolución diaria continua integrando las ventas registradas', 'Continuous daily trend of recorded sales', '已登记销售的每日连续变化')} ({dailySalesTrend30Days.total30DaysOrders} {tr('órdenes en', 'orders across', '笔订单，活跃')} {dailySalesTrend30Days.activeDaysCount} {tr('días activos', 'active days', '天')})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <div className="text-right font-mono tabular-nums hidden sm:block pr-2 border-r border-white/[0.08]">
              <span className="text-[11px] text-zinc-400 block">{tr('Acumulado 30 días', '30-Day Total', '30 天累计')}</span>
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
                {tr('Montos (USD)', 'Amounts (USD)', '金额 (USD)')}
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
                {tr('Órdenes', 'Orders', '订单数')}
              </button>
            </div>
          </div>
        </div>

        {/* 30-Day Micro KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#09090b] border border-white/[0.06] rounded-xl p-3">
            <span className="text-zinc-400 block text-[11px]">{tr('Ventas 30 Días', '30-Day Sales', '30 天销售额')}</span>
            <span className="text-sm sm:text-base font-bold font-mono text-white tabular-nums">
              ${dailySalesTrend30Days.total30DaysUSD.toFixed(2)}
            </span>
          </div>
          <div className="bg-[#09090b] border border-white/[0.06] rounded-xl p-3">
            <span className="text-zinc-400 block text-[11px]">{tr('Ganancia Bruta 30d', '30-Day Gross Profit', '30 天毛利')}</span>
            <span className="text-sm sm:text-base font-bold font-mono text-emerald-400 tabular-nums">
              ${dailySalesTrend30Days.total30DaysProfitUSD.toFixed(2)}
            </span>
          </div>
          <div className="bg-[#09090b] border border-white/[0.06] rounded-xl p-3">
            <span className="text-zinc-400 block text-[11px]">{tr('Promedio Diario', 'Daily Average', '日均营收')}</span>
            <span className="text-sm sm:text-base font-bold font-mono text-amber-400 tabular-nums">
              ${dailySalesTrend30Days.dailyAvgUSD.toFixed(2)}{tr('/día', '/day', '/天')}
            </span>
          </div>
          <div className="bg-[#09090b] border border-white/[0.06] rounded-xl p-3">
            <span className="text-zinc-400 block text-[11px]">{tr('Mejor Día (30d)', 'Best Day (30d)', '最佳单日 (30天)')}</span>
            <span className="text-sm sm:text-base font-bold font-mono text-white tabular-nums truncate block">
              {dailySalesTrend30Days.peakDay && dailySalesTrend30Days.peakDay.ventasUSD > 0
                ? `${dailySalesTrend30Days.peakDay.label} · $${dailySalesTrend30Days.peakDay.ventasUSD.toFixed(2)}`
                : tr('Sin ventas', 'No sales', '暂无销售')}
            </span>
          </div>
        </div>

        {sales.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center px-4 space-y-3">
            <TrendingUp className="w-10 h-10 text-zinc-600" />
            <div className="space-y-1 max-w-sm">
              <p className="text-sm font-semibold text-zinc-200">
                {tr('Sin ventas registradas en los últimos 30 días', 'No sales recorded in the last 30 days', '最近 30 天暂无销售记录')}
              </p>
              <p className="text-xs text-zinc-400">
                {tr('Al completar ventas en el POS o recibir pedidos web, aquí verás la curva diaria de los últimos 30 días.', 'Once you complete POS sales or receive web orders, the 30-day curve will appear here.', '完成 POS 销售或收到线上订单后，此处将显示近 30 天日销售曲线。')}
              </p>
            </div>
            {onGoToPOS && (
              <button
                type="button"
                onClick={onGoToPOS}
                className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors"
              >
                {tr('Ir al Punto de Venta POS', 'Go to POS', '前往 POS 收银台')}
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
                          {point.ordenes === 1 ? tr('orden', 'order', '笔订单') : tr('órdenes', 'orders', '笔订单')}
                        </div>
                        <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
                          <span className="text-amber-400">{tr('Ventas del día:', 'Daily Sales:', '当日销售额：')}</span>
                          <span className="font-bold text-white">
                            ${point.ventasUSD.toFixed(2)} USD
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
                          <span className="text-emerald-400">{tr('Ganancia bruta:', 'Gross Profit:', '毛利润：')}</span>
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
                      name={tr('Ventas Diarias (USD)', 'Daily Sales (USD)', '每日销售 (USD)')}
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={{ r: 2.5, fill: '#f59e0b', stroke: '#09090b', strokeWidth: 1.5 }}
                      activeDot={{ r: 6, fill: '#fbbf24' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="gananciaUSD"
                      name={tr('Ganancia Bruta (USD)', 'Gross Profit (USD)', '毛利润 (USD)')}
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
                    name={tr('Órdenes por Día', 'Orders per Day', '每日订单数')}
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
        <div className="xl:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex items-start gap-2.5">
              <LineChartIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white text-base font-display">
                  {tr('Tendencia de Ventas Mensuales', 'Monthly Sales Trend', '月度销售趋势')}
                </h4>
                <p className="text-xs text-zinc-400">
                  {tr('Comparativa mensual entre ventas facturadas y ganancia bruta (USD)', 'Monthly comparison between billed sales and gross profit (USD)', '每月营业额与毛利润对比 (USD)')}
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
                  {months} {tr('Meses', 'Months', '个月')}
                </button>
              ))}
            </div>
          </div>

          {sales.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center px-4 space-y-3">
              <LineChartIcon className="w-10 h-10 text-zinc-600" />
              <div className="space-y-1 max-w-sm">
                <p className="text-sm font-semibold text-zinc-200">
                  {tr('Sin datos de ventas mensuales todavía', 'No monthly sales data yet', '暂无月度销售数据')}
                </p>
                <p className="text-xs text-zinc-400">
                  {tr('Cuando registres ventas en el Punto de Venta, aquí verás la curva mensual de facturación y ganancia bruta.', 'When you log POS sales, the monthly revenue & profit curve will show here.', '在 POS 登记销售后，此处将显示月度营收与毛利曲线。')}
                </p>
              </div>
              {onGoToPOS && (
                <button
                  type="button"
                  onClick={onGoToPOS}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors"
                >
                  {tr('Registrar Primera Venta en POS', 'Log First Sale in POS', '在 POS 登记第一笔销售')}
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
                            {point.fullLabel} · {point.ordenes} {tr('órdenes', 'orders', '笔订单')}
                          </div>
                          <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
                            <span className="text-amber-400">{tr('Ventas Totales:', 'Total Sales:', '销售总额：')}</span>
                            <span className="font-bold text-white">
                              ${point.ventasUSD.toFixed(2)} USD
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
                            <span className="text-emerald-400">{tr('Ganancia Bruta:', 'Gross Profit:', '毛利润：')}</span>
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
                    name={tr('Ventas Mensuales (USD)', 'Monthly Sales (USD)', '月销售额 (USD)')}
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#f59e0b', stroke: '#09090b', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#fbbf24' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="gananciaUSD"
                    name={tr('Ganancia Bruta (USD)', 'Gross Profit (USD)', '毛利润 (USD)')}
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
        <div className="xl:col-span-5 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex items-start gap-2.5">
              <PieChartIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white text-base font-display">
                  {tr('Métodos de Pago', 'Payment Methods', '支付方式')}
                </h4>
                <p className="text-xs text-zinc-400">
                  {tr('Desglose porcentual por canal', 'Share by channel', '各渠道占比')} ({paymentMethodsBreakdown.totalOrders} {tr('transacciones', 'transactions', '笔交易')})
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
                {tr('Período', 'Period', '当期')}
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
                {tr('Histórico', 'All Time', '历史')}
              </button>
            </div>
          </div>

          {paymentMethodsBreakdown.items.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center px-4 space-y-3">
              <PieChartIcon className="w-10 h-10 text-zinc-600" />
              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-semibold text-zinc-200">
                  {tr('Sin cobros registrados en este filtro', 'No payments recorded for this filter', '该筛选条件下暂无收款记录')}
                </p>
                <p className="text-xs text-zinc-400">
                  {sales.length > 0
                    ? tr('No hubo ventas en el período seleccionado. Puedes consultar el histórico acumulado.', 'No sales in selected period. You can view all-time history.', '所选周期内无销售。可切换查看累计历史记录。')
                    : tr('Completa una venta en el POS para visualizar el desglose de métodos de pago.', 'Complete a POS sale to see the payment breakdown.', '完成一笔 POS 销售后即可查看支付方式明细。')}
                </p>
              </div>
              {sales.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPaymentChartScope('all')}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors"
                >
                  {tr('Ver Histórico', 'View History', '查看历史')} ({sales.length} {tr('ventas', 'sales', '笔销售')})
                </button>
              ) : onGoToPOS ? (
                <button
                  type="button"
                  onClick={onGoToPOS}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors"
                >
                  {tr('Ir al POS', 'Go to POS', '前往 POS')}
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
                              <span>{methodLabel(item.method)}</span>
                            </div>
                            <div className="font-mono tabular-nums text-amber-400 font-bold">
                              ${item.valueUSD.toFixed(2)} USD ({item.percentage.toFixed(1)}%)
                            </div>
                            <div className="font-mono tabular-nums text-[11px] text-zinc-400">
                              {item.count} {item.count === 1 ? tr('operación', 'op', '笔') : tr('operaciones', 'ops', '笔')} · ≈{' '}
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
                      <span className="text-zinc-200 font-medium truncate">{methodLabel(item.method)}</span>
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
              {tr('Configurar SMTP / Resend', 'Configure SMTP / Resend', '配置 SMTP / Resend')}
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
            <span>{tr('Rentabilidad Neta (P&L)', 'Net Profitability (P&L)', '净利润 (P&L)')}</span>
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
            <span>{tr('Reportes Visuales', 'Visual Reports', '可视化报表')}</span>
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
            <span>{tr('Más Vendidos', 'Top Sellers', '畅销商品')}</span>
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
            <span>{tr('Horas Pico', 'Peak Hours', '高峰时段')}</span>
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
            <span>{tr('Equipo de Ventas', 'Sales Team', '销售团队')}</span>
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
            <span>{tr('Historial', 'History', '历史记录')} ({sales.length})</span>
          </button>
        </div>

        {/* Period Selector Pills */}
        <div className="flex items-center gap-1 bg-[#09090b] p-1 rounded-xl border border-white/[0.08] text-xs shrink-0 self-start sm:self-auto">
          {(
            [
              { key: 'today', label: tr('Hoy', 'Today', '今天') },
              { key: 'yesterday', label: tr('Ayer', 'Yesterday', '昨天') },
              { key: '7days', label: tr('7 Días', '7 Days', '7天') },
              { key: 'month', label: tr('Mes', 'Month', '本月') },
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
                  {tr('ESTADO DE RESULTADOS COMERCIAL (P&L EN TIEMPO REAL)', 'COMMERCIAL INCOME STATEMENT (REAL-TIME P&L)', '商业损益表（实时 P&L）')}
                </span>
                <h3 className="font-bold text-white text-lg sm:text-xl font-display">
                  {tr('Cálculo de Rentabilidad Neta del Día', 'Daily Net Profitability Calculation', '每日净利润计算')}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {tr(
                    'Deducción automática de costos de reposición al proveedor y pérdidas por merma para conocer la ganancia limpia real.',
                    'Automatic deduction of supplier restock costs and shrinkage losses to show true net profit.',
                    '自动扣除供应商补货成本和损耗，计算真实净利润。'
                  )}
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
                  <span>
                    {isSendingReport
                      ? tr('Enviando...', 'Sending...', '发送中...')
                      : tr('Enviar Reporte por Correo', 'Send Report by Email', '邮件发送报表')}
                  </span>
                </button>
                <div className="text-right">
                  <span className="text-[11px] text-zinc-400 block">
                    {tr('Margen Neto Real', 'True Net Margin', '实际净利率')}
                  </span>
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
                <span className="text-xs text-zinc-400 block font-medium">
                  {tr('1. Facturación / Ventas', '1. Billing / Sales', '1. 营业额 / 销售')}
                </span>
                <div className="text-xl font-bold font-mono text-white tabular-nums">
                  ${profitabilityMetrics.grossRevenueUSD.toFixed(2)} USD
                </div>
                <span className="text-[11px] text-zinc-500 font-mono block">
                  ≈ {profitabilityMetrics.grossRevenueBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold block pt-1">
                  {profitabilityMetrics.totalOrders} {tr('órdenes cobradas', 'paid orders', '笔已收款订单')}
                </span>
              </div>

              {/* 2. Costo de Reposición (COGS) */}
              <div className="bg-[#09090b]/80 p-4 rounded-xl border border-white/[0.08] space-y-1">
                <span className="text-xs text-rose-300 block font-medium">
                  {tr('2. (-) Costo Reposición', '2. (-) Restock Cost', '2. (-) 补货成本')}
                </span>
                <div className="text-xl font-bold font-mono text-rose-400 tabular-nums">
                  -${profitabilityMetrics.replacementCostUSD.toFixed(2)} USD
                </div>
                <span className="text-[11px] text-zinc-500 font-mono block">
                  ≈ -{profitabilityMetrics.replacementCostBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
                <span className="text-[10px] text-zinc-400 block pt-1">
                  {tr('Costo de reposición a distribuidoras', 'Distributor restock cost', '分销商补货成本')}
                </span>
              </div>

              {/* 3. Mermas y Pérdidas */}
              <div className="bg-[#09090b]/80 p-4 rounded-xl border border-white/[0.08] space-y-1">
                <span className="text-xs text-amber-300 block font-medium">
                  {tr('3. (-) Mermas & Roturas', '3. (-) Shrinkage & Breakage', '3. (-) 损耗与破损')}
                </span>
                <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                  -${profitabilityMetrics.mermasLossUSD.toFixed(2)} USD
                </div>
                <span className="text-[11px] text-zinc-500 font-mono block">
                  ≈ -{profitabilityMetrics.mermasLossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
                <span className="text-[10px] text-zinc-400 block pt-1">
                  {tr('Descontado según boletas de auditoría', 'Deducted per audit slips', '按审计记录扣除')}
                </span>
              </div>

              {/* 4. Ganancia Neta Real */}
              <div className="bg-gradient-to-br from-emerald-950/40 to-slate-950 p-4 rounded-xl border border-emerald-500/40 space-y-1 shadow-md shadow-emerald-950/30">
                <span className="text-xs text-emerald-400 block font-bold">
                  {tr('4. (=) GANANCIA NETA REAL', '4. (=) TRUE NET PROFIT', '4. (=) 实际净利润')}
                </span>
                <div className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
                  +${profitabilityMetrics.netProfitUSD.toFixed(2)} USD
                </div>
                <span className="text-[11px] text-emerald-300/80 font-mono font-bold block">
                  ≈ +{profitabilityMetrics.netProfitBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
                <span className="text-[10px] text-zinc-400 block pt-1">
                  {tr('Utilidad líquida disponible', 'Net liquid profit', '可用净利润')}
                </span>
              </div>
            </div>
          </div>

          {/* Comparative Chart: Revenue vs Cost vs Net Profit */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-base font-display">
                  {tr('Estructura de Rentabilidad y Reposición', 'Profitability & Restock Structure', '利润与补货结构')}
                </h4>
                <p className="text-xs text-zinc-400">
                  {tr('Comparativa de facturación bruta, costos de inventario y ganancia neta generada', 'Comparison of gross revenue, inventory costs, and net profit', '毛收入、库存成本与净利润对比')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-white">
                  <span className="w-3 h-3 rounded-sm bg-amber-500" />
                  <span>{tr('Ventas Brutas', 'Gross Sales', '总销售额')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="w-3 h-3 rounded-sm bg-rose-500" />
                  <span>{tr('Costo Reposición', 'Restock Cost', '补货成本')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span>{tr('Ganancia Neta', 'Net Profit', '净利润')}</span>
                </div>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: tr('Flujo del Período', 'Period Flow', '周期资金流'),
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
                  <Bar dataKey="Ventas" fill="#f59e0b" radius={[6, 6, 0, 0]} name={tr('Ventas Brutas', 'Gross Sales', '总销售额')} />
                  <Bar dataKey="CostoReposicion" fill="#f43f5e" radius={[6, 6, 0, 0]} name={tr('Costo Reposición', 'Restock Cost', '补货成本')} />
                  <Bar dataKey="GananciaNeta" fill="#10b981" radius={[6, 6, 0, 0]} name={tr('Ganancia Neta', 'Net Profit', '净利润')} />
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
              <span className="text-xs text-zinc-400 block mb-1">
                {tr('Producto #1 en Volumen', '#1 Product by Volume', '销量第一商品')}
              </span>
              <div className="text-base font-bold text-white truncate">
                {topProducts[0]?.name || 'N/A'}
              </div>
              <span className="text-xs text-amber-400 font-mono font-bold block mt-1">
                {topProducts[0]?.quantitySold || 0} {tr('unidades vendidas', 'units sold', '件已售')}
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">
                {tr('Más Rentable ($ Ganancia)', 'Most Profitable ($ Profit)', '最赚钱商品（$利润）')}
              </span>
              <div className="text-base font-bold text-white truncate">
                {[...topProducts].sort((a, b) => b.profitUSD - a.profitUSD)[0]?.name || 'N/A'}
              </div>
              <span className="text-xs text-emerald-400 font-mono font-bold block mt-1">
                +${[...topProducts].sort((a, b) => b.profitUSD - a.profitUSD)[0]?.profitUSD.toFixed(2) || '0.00'} USD {tr('ganancia neta', 'net profit', '净利润')}
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">
                {tr('Ticket Promedio por Orden', 'Average Ticket per Order', '平均客单价')}
              </span>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                ${profitabilityMetrics.averageTicketUSD.toFixed(2)} USD
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                ≈ {(profitabilityMetrics.averageTicketUSD * exchangeRate).toFixed(0)} Bs. / {tr('cliente', 'customer', '顾客')}
              </span>
            </div>
          </div>

          {/* Ranking Table of Top Products */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-white text-base font-display">
                  {tr('Ranking de Productos: Rotación, Ventas & Margen', 'Product Ranking: Turnover, Sales & Margin', '商品排行：周转率、销量与利润率')}
                </h4>
                <p className="text-xs text-zinc-400">
                  {tr('Ordenado por unidades despachadas y margen bruto aportado', 'Sorted by units dispatched and gross margin', '按出货量与毛利排序')}
                </p>
              </div>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 font-bold">
                {topProducts.length} {tr('productos con movimiento', 'products with sales', '个在售商品')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/80 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4 text-center">{tr('Posición', 'Rank', '排名')}</th>
                    <th className="py-3 px-4">{tr('Producto', 'Product', '商品')}</th>
                    <th className="py-3 px-4">{tr('Categoría', 'Category', '分类')}</th>
                    <th className="py-3 px-4 text-center">{tr('Unidades', 'Units', '数量')}</th>
                    <th className="py-3 px-4 text-right">{tr('Facturación USD', 'Revenue USD', '销售额 USD')}</th>
                    <th className="py-3 px-4 text-right">{tr('Costo Reposición', 'Restock Cost', '补货成本')}</th>
                    <th className="py-3 px-4 text-right">{tr('Ganancia Bruta', 'Gross Profit', '毛利润')}</th>
                    <th className="py-3 px-4 text-center">{tr('Margen %', 'Margin %', '利润率 %')}</th>
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
                        <td className="py-3 px-4 text-zinc-300">{translateCategoryLabel(p.category, lang)}</td>
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
              <span className="text-xs text-amber-300 font-semibold block mb-1">
                {tr('Hora Pico de Oro', 'Golden Peak Hour', '黄金高峰时段')}
              </span>
              <div className="text-2xl font-black font-mono text-amber-400 tabular-nums">
                {peakHoursData.peakHour}
              </div>
              <span className="text-xs text-zinc-400 block mt-1">
                ${peakHoursData.peakRevenueUSD.toFixed(2)} USD • {peakHoursData.peakOrders} {tr('tickets simultáneos', 'concurrent tickets', '笔同时订单')}
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">
                {tr('Franja Principal', 'Primary Window', '主力时段')}
              </span>
              <div className="text-lg font-bold text-white">
                {tr('21:00 a 01:00 (Hora Pico)', '21:00 to 01:00 (Peak)', '21:00 至 01:00（高峰期）')}
              </div>
              <span className="text-xs text-emerald-400 font-mono font-bold block mt-1">
                {tr('Concentra el 68% de las ventas', 'Concentrates 68% of sales', '占总销售额的68%')}
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">
                {tr('Recomendación Operativa', 'Operational Tip', '运营建议')}
              </span>
              <div className="text-xs text-zinc-300 leading-snug">
                {tr(
                  'Reforzar personal de atención y caja entre las 20:00 y las 23:30 para agilizar el despacho.',
                  'Reinforce counter and cashier staff between 20:00 and 23:30 to speed up checkout.',
                  '建议在 20:00 至 23:30 期间加强收银与发货人员配置以加快出货。'
                )}
              </div>
            </div>
          </div>

          {/* Hourly Bar Chart */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-white text-base font-display">
                  {tr('Distribución de Ventas por Hora (08:00 a 24:00)', 'Hourly Sales Distribution (08:00 to 24:00)', '每小时销售分布（08:00 至 24:00）')}
                </h4>
                <p className="text-xs text-zinc-400">
                  {tr('Volumen monetario facturado por franja horaria', 'Monetary volume billed per time slot', '各时段成交金额统计')}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="inline-block w-3 h-3 rounded bg-amber-500" />
                <span className="text-zinc-300">{tr('Hora Regular', 'Regular Hour', '常规时段')}</span>
                <span className="inline-block w-3 h-3 rounded bg-amber-400 ring-2 ring-amber-300 ml-2" />
                <span className="text-amber-300 font-bold">{tr('Hora Pico', 'Peak Hour', '高峰时段')}</span>
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
                    formatter={(val: any) => [`$${Number(val || 0).toFixed(2)} USD`, tr('Facturación', 'Revenue', '营业额')]}
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
                    <span>{tr('Total Facturado:', 'Total Billed:', '总营业额：')}</span>
                    <span className="font-mono font-bold text-amber-400 tabular-nums">
                      ${member.revenueUSD.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>{tr('Ganancia Neta:', 'Net Profit:', '净利润：')}</span>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">
                      +${member.netProfitUSD.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>{tr('Órdenes Atendidas:', 'Orders Served:', '服务订单：')}</span>
                    <span className="font-mono text-white font-bold">{member.ordersCount} {tr('tickets', 'tickets', '单')}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>{tr('Ticket Promedio:', 'Average Ticket:', '平均客单价：')}</span>
                    <span className="font-mono text-zinc-200">${member.averageTicketUSD.toFixed(2)}</span>
                  </div>
                </div>

                {/* Progress bar of participation */}
                <div className="pt-2">
                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                    <span>{tr('Participación en Ventas', 'Sales Share', '销售占比')}</span>
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
                {tr('Registro de Comprobantes de Venta', 'Sales Receipts Registry', '销售凭证记录')}
              </h3>
              <span className="text-xs text-zinc-400">
                {tr('Historial de órdenes emitidas en Smith Solutions E-Commerce', 'Order history issued in Smith Solutions E-Commerce', 'Smith Solutions E-Commerce 历史订单记录')} ({sales.length} {tr('órdenes', 'orders', '笔订单')})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="text-right sm:border-r border-white/[0.08] sm:pr-4">
                <span className="text-[11px] text-zinc-400 block">
                  {tr('Facturación acumulada', 'Cumulative revenue', '累计营业额')}
                </span>
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
                title={tr('Enviar resumen de ventas al correo configurado (SMTP / Resend)', 'Send sales summary to configured email (SMTP / Resend)', '将销售汇总发送至已配置邮箱（SMTP / Resend）')}
              >
                {isSendingReport ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                <span>{isSendingReport ? tr('Enviando...', 'Sending...', '发送中...') : tr('Enviar por Correo', 'Send by Email', '邮件发送')}</span>
              </button>

              <button
                onClick={() => exportSalesReportPDF(sales, exchangeRate, lang)}
                disabled={sales.length === 0}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-95 text-zinc-950 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap min-h-[44px]"
                title={tr('Descargar documento PDF con todas las ventas registradas', 'Download PDF report with all recorded sales', '下载包含所有已记录销售的 PDF 报告')}
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>{tr('Descargar Reporte PDF', 'Download PDF Report', '下载 PDF 报告')}</span>
              </button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={tr('Buscar por recibo, cliente, RIF o producto...', 'Search by receipt, customer, tax ID, or product...', '按收据号、客户、税号或商品搜索...')}
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
                  {method === 'Todos' ? tr('Todos', 'All', '全部') : methodLabel(method)}
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
                    <th className="py-3 px-4">{tr('Recibo #', 'Receipt #', '收据号')}</th>
                    <th className="py-3 px-4">{tr('Fecha & Vendedor', 'Date & Seller', '日期与销售员')}</th>
                    <th className="py-3 px-4">{tr('Cliente & RIF', 'Customer & Tax ID', '客户与税号')}</th>
                    <th className="py-3 px-4">{tr('Productos Vendidos', 'Items Sold', '已售商品')}</th>
                    <th className="py-3 px-4">{tr('Método', 'Method', '支付方式')}</th>
                    <th className="py-3 px-4 text-right">{tr('Total (USD)', 'Total (USD)', '总计 (USD)')}</th>
                    <th className="py-3 px-4 text-right">{tr('Total (Bs.)', 'Total (Bs.)', '总计 (Bs.)')}</th>
                    <th className="py-3 px-4 text-center">{tr('Estado', 'Status', '状态')}</th>
                    <th className="py-3 px-4 text-center">{tr('Acciones', 'Actions', '操作')}</th>
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
                        <span className="text-[10px] text-zinc-500">{sale.cashierName || tr('Caja Principal', 'Main Cashier', '主收银台')}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-white font-medium block">{sale.customerName}</span>
                        <span className="text-[10px] font-mono text-amber-400/90">{sale.customerRIF || 'V-00000000'}</span>
                      </td>
                      <td className="py-3 px-4 text-zinc-300 max-w-xs truncate">
                        {sale.items.map((it) => `${it.quantity}x ${it.product.name}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-zinc-300">
                        {methodLabel(sale.paymentMethod)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums">
                        ${(sale.totalWithIgtfUSD || sale.subtotalUSD).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-400 tabular-nums text-xs">
                        {(sale.totalWithIgtfBs || sale.subtotalBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {sale.status === 'Completada'
                            ? tr('Completada', 'Completed', '已完成')
                            : tr('Pendiente (Fiado)', 'Pending (Credit)', '挂账待收')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => exportSingleReceiptPDF(sale, lang)}
                            className="p-1.5 bg-[#09090b] hover:bg-zinc-800/80 border border-white/[0.08] hover:border-amber-500/40 text-amber-400 rounded-lg transition-colors"
                            title={tr('Descargar comprobante en PDF', 'Download receipt PDF', '下载 PDF 收据')}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => printReceiptTicket(sale, lang)}
                            className="p-1.5 bg-[#09090b] hover:bg-zinc-800/80 border border-white/[0.08] hover:border-white/[0.1] text-zinc-300 hover:text-white rounded-lg transition-colors"
                            title={tr('Imprimir ticket térmico', 'Print thermal receipt', '打印热敏小票')}
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
