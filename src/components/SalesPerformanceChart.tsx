import React, { useState, useMemo } from 'react';
import { Sale } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { TrendingUp, Calendar, DollarSign, Award, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface SalesPerformanceChartProps {
  sales: Sale[];
  exchangeRate: number;
}

interface DayData {
  rawDate: string;
  label: string;
  fullDate: string;
  totalUSD: number;
  totalBs: number;
  ordersCount: number;
  isToday: boolean;
}

export const SalesPerformanceChart: React.FC<SalesPerformanceChartProps> = ({
  sales,
  exchangeRate,
}) => {
  const { lang, tr } = useLanguage();
  const [viewCurrency, setViewCurrency] = useState<'USD' | 'Bs'>('USD');

  const chartData: DayData[] = useMemo(() => {
    let anchor = new Date();
    if (sales.length > 0) {
      const latestTimestamp = Math.max(
        ...sales.map((s) => {
          const d = new Date(s.date);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        })
      );
      if (latestTimestamp > 0) {
        anchor = new Date(latestTimestamp);
      }
    }

    const days: DayData[] = [];
    const dayNames =
      lang === 'zh'
        ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        : lang === 'en'
          ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          : ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthNames =
      lang === 'zh'
        ? ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
        : lang === 'en'
          ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;

      const matchingSales = sales.filter((s) => s.date.startsWith(dateKey));
      const dayTotalUSD = matchingSales.reduce((sum, s) => sum + s.subtotalUSD, 0);
      const dayTotalBs = dayTotalUSD * exchangeRate;

      const dayName = dayNames[d.getDay()];
      const monthName = monthNames[d.getMonth()];
      const isToday = i === 0;

      days.push({
        rawDate: dateKey,
        label: `${dayName} ${dd}`,
        fullDate:
          lang === 'zh'
            ? `${yyyy}年${monthName}${dd}日 ${dayName}`
            : `${dayName}, ${dd} ${monthName} ${yyyy}`,
        totalUSD: Math.round(dayTotalUSD * 100) / 100,
        totalBs: Math.round(dayTotalBs * 100) / 100,
        ordersCount: matchingSales.length,
        isToday,
      });
    }

    return days;
  }, [sales, exchangeRate, lang]);

  const stats = useMemo(() => {
    const totalUSD = chartData.reduce((acc, d) => acc + d.totalUSD, 0);
    const totalBs = chartData.reduce((acc, d) => acc + d.totalBs, 0);
    const totalOrders = chartData.reduce((acc, d) => acc + d.ordersCount, 0);
    const dailyAverageUSD = totalUSD / (chartData.length || 1);

    let bestDay = chartData[0];
    for (const d of chartData) {
      if (d.totalUSD > (bestDay?.totalUSD || 0)) {
        bestDay = d;
      }
    }

    return {
      totalUSD,
      totalBs,
      totalOrders,
      dailyAverageUSD,
      bestDay,
    };
  }, [chartData]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: DayData }> }) => {
    if (active && payload && payload.length) {
      const data: DayData = payload[0].payload;
      return (
        <div className="bg-[#111114]/95 backdrop-blur-md border border-amber-500/40 p-3 rounded-xl shadow-xl text-xs space-y-1.5 z-50 min-w-[180px]">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              {data.fullDate}
            </span>
            {data.isToday && (
              <span className="text-[10px] bg-amber-500 text-zinc-950 px-1.5 py-0.5 rounded font-bold">
                {tr('Hoy', 'Today', '今天')}
              </span>
            )}
          </div>

          <div className="pt-1 space-y-1">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-zinc-400">{tr('Total USD:', 'Total USD:', '美元合计：')}</span>
              <span className="font-mono font-bold text-amber-400 text-sm tabular-nums">
                ${data.totalUSD.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-zinc-400">{tr('Total Bs.:', 'Total Bs.:', '玻利瓦尔合计：')}</span>
              <span className="font-mono text-zinc-300 tabular-nums">
                {data.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>
            <div className="flex justify-between items-baseline gap-2 pt-1 border-t border-white/[0.08]">
              <span className="text-zinc-400">{tr('Órdenes:', 'Orders:', '订单数：')}</span>
              <span className="font-mono font-semibold text-emerald-400">
                {data.ordersCount}{' '}
                {tr(
                  data.ordersCount === 1 ? 'ticket' : 'tickets',
                  data.ordersCount === 1 ? 'ticket' : 'tickets',
                  '笔订单'
                )}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const maxValue = Math.max(
    ...chartData.map((d) => (viewCurrency === 'USD' ? d.totalUSD : d.totalBs)),
    10
  );

  return (
    <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 shadow-lg space-y-5">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg font-display flex items-center gap-2">
                {tr(
                  'Rendimiento Comercial (Últimos 7 Días)',
                  'Commercial Performance (Last 7 Days)',
                  '经营销售表现（近 7 天）'
                )}
              </h3>
              <p className="text-xs text-zinc-400">
                {tr(
                  'Gráfica interactiva de facturación diaria en Smith Solutions E-Commerce',
                  'Interactive daily revenue chart on Smith Solutions E-Commerce',
                  'Smith Solutions E-Commerce 每日营业额交互图表'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Currency Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-zinc-400 hidden sm:inline">
            {tr('Visualizar en:', 'Display in:', '显示币种：')}
          </span>
          <div className="inline-flex rounded-xl bg-[#09090b] p-1 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setViewCurrency('USD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewCurrency === 'USD'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              $ USD
            </button>
            <button
              type="button"
              onClick={() => setViewCurrency('Bs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewCurrency === 'Bs'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Bs. (BCV)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#09090b]/70 border border-white/[0.08] rounded-xl p-3 sm:p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>{tr('Total 7 Días', '7-Day Total', '7 天总计')}</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono font-bold text-base sm:text-lg text-white tabular-nums">
            ${stats.totalUSD.toFixed(2)}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono truncate">
            ≈ {stats.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
          </div>
        </div>

        <div className="bg-[#09090b]/70 border border-white/[0.08] rounded-xl p-3 sm:p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>{tr('Promedio Diario', 'Daily Average', '日均销售额')}</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono font-bold text-base sm:text-lg text-emerald-400 tabular-nums">
            ${stats.dailyAverageUSD.toFixed(2)}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono truncate">
            {tr('Por jornada comercial', 'Per business day', '每个营业日')}
          </div>
        </div>

        <div className="bg-[#09090b]/70 border border-white/[0.08] rounded-xl p-3 sm:p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>{tr('Día Récord', 'Record Day', '峰值日期')}</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono font-bold text-base sm:text-lg text-amber-400 tabular-nums">
            ${stats.bestDay ? stats.bestDay.totalUSD.toFixed(2) : '0.00'}
          </div>
          <div className="text-[11px] text-zinc-400 truncate">
            {stats.bestDay?.label || 'N/A'} ({stats.bestDay?.ordersCount || 0}{' '}
            {tr('ventas', 'sales', '笔销售')})
          </div>
        </div>

        <div className="bg-[#09090b]/70 border border-white/[0.08] rounded-xl p-3 sm:p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>{tr('Órdenes 7 Días', '7-Day Orders', '7 天订单数')}</span>
            <ShoppingBag className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-mono font-bold text-base sm:text-lg text-blue-400 tabular-nums">
            {stats.totalOrders}
          </div>
          <div className="text-[11px] text-zinc-500 truncate">
            {tr('Comprobantes emitidos', 'Receipts issued', '已开具小票')}
          </div>
        </div>
      </div>

      {/* Main Bar Chart */}
      <div className="h-[280px] sm:h-[320px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={false}
              opacity={0.4}
            />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(val) =>
                viewCurrency === 'USD' ? `$${val}` : `${(val / 1000).toFixed(0)}k`
              }
              domain={[0, Math.ceil(maxValue * 1.15)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }} />
            <Bar
              dataKey={viewCurrency === 'USD' ? 'totalUSD' : 'totalBs'}
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            >
              {chartData.map((entry, index) => {
                const isBest = entry.rawDate === stats.bestDay?.rawDate && entry.totalUSD > 0;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isToday ? '#fbbf24' : isBest ? '#f59e0b' : '#b45309'}
                    fillOpacity={entry.totalUSD === 0 ? 0.3 : entry.isToday ? 1 : 0.85}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Legend & Notes */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/[0.08] text-[11px] text-zinc-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block"></span>
            {tr('Hoy / Activo', 'Today / Active', '今日 / 活跃')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
            {tr('Día Pico', 'Peak Day', '峰值日')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-700 inline-block"></span>
            {tr('Días Anteriores', 'Previous Days', '前几日')}
          </span>
        </div>

        <span className="text-zinc-500 font-mono text-[10px]">
          {tr('Tasa referencial BCV:', 'BCV reference rate:', 'BCV 参考汇率：')}{' '}
          {exchangeRate.toFixed(2)} Bs/USD • Smith Bussines Solutions 2026
        </span>
      </div>
    </div>
  );
};
