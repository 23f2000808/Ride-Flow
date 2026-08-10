import { startTransition, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, CarFront, CircleDollarSign, Clock3, Download, Gauge, Route, Sparkles, Star, TrendingUp, Wallet } from 'lucide-react';
import CustomerShell from '../components/dashboard/CustomerShell';
import SkeletonBlock from '../components/SkeletonBlock';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { apiFetch } from '../utils/api';

const chartPalette = ['#0f766e', '#2563eb', '#7c3aed', '#f97316', '#f59e0b'];
const rangeOptions = [{ value: 'today', label: 'Today' }, { value: '7d', label: 'Last 7 Days' }, { value: '30d', label: 'Last 30 Days' }, { value: '6m', label: 'Last 6 Months' }];
const heatmapTones = ['bg-slate-100 dark:bg-slate-800/80', 'bg-cyan-100 dark:bg-cyan-950/70', 'bg-cyan-200 dark:bg-cyan-900/70', 'bg-cyan-300 dark:bg-cyan-800/80', 'bg-cyan-500 dark:bg-cyan-700/90'];
const formatCurrency = (value) => `Rs ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
const formatDistance = (value) => `${Number(value || 0).toFixed(1)} km`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const growthTone = (value) => (value > 0 ? 'text-emerald-500 dark:text-emerald-300' : value < 0 ? 'text-amber-500 dark:text-amber-300' : 'text-slate-500 dark:text-slate-300');
const growthLabel = (value) => `${Number(value || 0) > 0 ? '+' : ''}${Number(value || 0).toFixed(1)}% vs previous period`;

function MetricCard({ label, value, hint, growth, icon: Icon }) {
  return <motion.div whileHover={{ y: -4, scale: 1.01 }} className="theme-soft-card rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><div className="flex items-start justify-between gap-3"><div><p className="theme-label text-[11px] uppercase tracking-[0.28em]">{label}</p><p className="theme-heading mt-3 text-3xl font-bold tracking-[-0.05em]">{value}</p></div><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-200"><Icon className="h-5 w-5" /></span></div><p className="theme-copy mt-3 text-sm leading-6">{hint}</p>{growth !== undefined ? <p className={`mt-4 text-sm font-semibold ${growthTone(growth)}`}>{growthLabel(growth)}</p> : null}</motion.div>;
}

function ChartCard({ title, subtitle, children }) {
  return <section className="theme-soft-card rounded-[30px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><h2 className="theme-heading text-xl font-semibold">{title}</h2>{subtitle ? <p className="theme-copy mt-2 text-sm leading-6">{subtitle}</p> : null}<div className="mt-5 h-[320px] w-full">{children}</div></section>;
}

function EmptyState({ title, body }) {
  return <div className="theme-soft-card rounded-[30px] p-8 text-center"><p className="theme-heading text-xl font-semibold">{title}</p><p className="theme-copy mt-3 text-sm leading-7">{body}</p></div>;
}

function Heatmap({ data }) {
  const maxValue = Math.max(...(data || []).map((item) => item?.value || 0), 0);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const grid = days.map((day) => ({ day, hours: Array.from({ length: 24 }, (_, hour) => data.find((item) => item?.day === day && item?.hour === hour) || { day, hour, value: 0 }) }));
  const valueTone = (value) => !value || !maxValue ? heatmapTones[0] : value / maxValue < 0.25 ? heatmapTones[1] : value / maxValue < 0.5 ? heatmapTones[2] : value / maxValue < 0.75 ? heatmapTones[3] : heatmapTones[4];
  return <div className="overflow-x-auto"><div className="min-w-[760px]"><div className="grid grid-cols-[72px_repeat(24,minmax(0,1fr))] gap-2 text-[11px] text-slate-400 dark:text-slate-500"><div />{Array.from({ length: 24 }, (_, hour) => <div key={hour} className="text-center">{hour}</div>)}</div><div className="mt-3 space-y-2">{grid.map((row) => <div key={row.day} className="grid grid-cols-[72px_repeat(24,minmax(0,1fr))] gap-2"><div className="flex items-center text-sm font-medium text-slate-500 dark:text-slate-300">{row.day}</div>{row.hours.map((cell) => <div key={`${row.day}-${cell.hour}`} title={`${row.day} ${String(cell.hour).padStart(2, '0')}:00 - ${cell.value} rides`} className={`h-7 rounded-lg transition-transform hover:scale-105 ${valueTone(cell.value)}`} />)}</div>)}</div></div></div>;
}

export default function Analytics({ forcedScope }) {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const scope = forcedScope || (user?.role === 'driver' ? 'driver' : 'user');
  const isDriver = scope === 'driver';
  const [range, setRange] = useState('7d');
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('info');
  const refreshTimerRef = useRef(null);
  const deferredAnalytics = useDeferredValue(analytics);

  useEffect(() => () => { if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current); }, []);

  useEffect(() => {
    let active = true;
    const loadAnalytics = async (refreshOnly = false) => {
      if (!user?.id) return;
      refreshOnly ? setIsRefreshing(true) : setIsLoading(true);
      try {
        const query = new URLSearchParams({ scope, range });
        query.set(scope === 'driver' ? 'driverId' : 'userId', user.id);
        const response = await apiFetch(`/rides/analytics?${query.toString()}`);
        if (!response?.data || !active) return;
        startTransition(() => setAnalytics(response.data));
      } catch (error) {
        console.error(error);
        if (active) {
          setToastType('error');
          setToast(error?.response?.data?.message || error?.message || 'Unable to load analytics.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };
    loadAnalytics();
    if (!socket) return () => { active = false; };
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => loadAnalytics(true), 700);
    };
    socket.on('ride:requested', scheduleRefresh);
    socket.on('ride:accepted', scheduleRefresh);
    socket.on('ride:status', scheduleRefresh);
    socket.on('ride:rejected', scheduleRefresh);
    return () => {
      active = false;
      socket.off('ride:requested', scheduleRefresh);
      socket.off('ride:accepted', scheduleRefresh);
      socket.off('ride:status', scheduleRefresh);
      socket.off('ride:rejected', scheduleRefresh);
    };
  }, [range, scope, socket, user?.id]);

  const summary = deferredAnalytics?.summary || {};
  const growth = deferredAnalytics?.growth || {};
  const trends = deferredAnalytics?.trends || [];
  const revenue = deferredAnalytics?.revenue || [];
  const peakHours = deferredAnalytics?.peakHours || [];
  const statusDistribution = deferredAnalytics?.statusDistribution || [];
  const rideTypes = deferredAnalytics?.rideTypes || [];
  const heatmap = deferredAnalytics?.heatmap || [];
  const insights = deferredAnalytics?.insights || [];
  const meta = deferredAnalytics?.meta || {};
  const hasData = Boolean((summary?.totalRides || 0) || trends.length || revenue.length || peakHours.length || statusDistribution.length || rideTypes.length);

  const metrics = useMemo(() => {
    const primary = isDriver ? summary?.totalEarnings : summary?.totalSpend;
    const base = [
      { label: 'Total rides', value: String(summary?.totalRides || 0), hint: 'Trips captured in the selected analytics window.', growth: growth?.ridesGrowth, icon: CarFront },
      { label: isDriver ? 'Total earnings' : 'Total spend', value: formatCurrency(primary || 0), hint: isDriver ? 'Revenue recognized from your assigned rides.' : 'Total spend from your bookings in this period.', growth: growth?.revenueGrowth, icon: CircleDollarSign },
      { label: 'Avg ride distance', value: formatDistance(summary?.avgDistance || 0), hint: 'Average distance traveled per ride.', icon: Route },
      { label: 'Completion rate', value: formatPercent(summary?.completionRate || 0), hint: 'Completed rides divided by all rides in range.', growth: growth?.completionGrowth, icon: TrendingUp },
      { label: 'Cancellation rate', value: formatPercent(summary?.cancellationRate || 0), hint: 'Cancelled rides divided by total rides.', growth: growth?.cancellationGrowth, icon: Gauge },
    ];
    if (isDriver) {
      base.push({ label: 'Active rides', value: String(summary?.activeRides || 0), hint: 'Rides currently accepted or in progress.', icon: Activity }, { label: 'Average rating', value: `${Number(summary?.ratingPerformance || 0).toFixed(1)} / 5`, hint: 'Rolling driver rating from your profile and trip feedback.', icon: Star });
    } else {
      base.push({ label: 'Favorite route', value: summary?.favoriteRoute || 'N/A', hint: 'Most repeated pickup to destination pairing.', icon: Wallet }, { label: 'Ride frequency', value: `${Number(summary?.rideFrequency || 0).toFixed(1)} / bucket`, hint: 'Average rides per time bucket in the selected range.', icon: Clock3 });
    }
    return base;
  }, [growth, isDriver, summary]);

  const exportReport = () => {
    try {
      const rows = [['Scope', scope], ['Range', meta?.label || range], ['Total rides', summary?.totalRides || 0], [isDriver ? 'Total earnings' : 'Total spend', isDriver ? summary?.totalEarnings || 0 : summary?.totalSpend || 0], ['Average distance', summary?.avgDistance || 0], ['Completion rate', summary?.completionRate || 0], ['Cancellation rate', summary?.cancellationRate || 0], [], ['Trend label', 'Rides', 'Revenue'], ...trends.map((item, index) => [item?.label || '', item?.value || 0, revenue[index]?.value || 0])];
      const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${scope}-analytics-${range}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setToastType('success');
      setToast('Analytics report downloaded.');
    } catch (error) {
      console.error(error);
      setToastType('error');
      setToast('Unable to export analytics report.');
    }
  };

  if (!user?.id) return <div>Loading analytics...</div>;

  return (
    <CustomerShell toast={toast} toastType={toastType} onDismissToast={() => setToast('')}>
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="theme-panel theme-border rounded-[34px] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="theme-accent text-[11px] font-semibold uppercase tracking-[0.34em]">Analytics</p><h1 className="theme-heading mt-3 text-3xl font-bold tracking-[-0.05em]">{isDriver ? 'Driver analytics and live performance' : 'Ride insights and spending intelligence'}</h1><p className="theme-copy mt-3 max-w-3xl text-sm leading-7">A real-time analytics workspace with premium charting, operational insights, and export-ready reporting designed for RideFlow’s customer and driver experiences.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-slate-900/70"><span className={`h-2.5 w-2.5 rounded-full ${socket ? 'bg-emerald-400' : 'bg-slate-400'}`} /><span className="text-slate-600 dark:text-slate-300">{isRefreshing ? 'Refreshing live data...' : socket ? 'Live sync active' : 'Polling snapshot'}</span></div>
            <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100">{rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <button type="button" onClick={exportReport} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] dark:bg-white dark:text-slate-950"><Download className="h-4 w-4" />Download Report</button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{isLoading ? Array.from({ length: 8 }, (_, index) => <SkeletonBlock key={index} className="h-40" />) : metrics.map((metric) => <MetricCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} growth={metric.growth} icon={metric.icon} />)}</div>

        <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-5">
            <div className="theme-soft-card rounded-[30px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-4"><div><h2 className="theme-heading text-xl font-semibold">Smart insights</h2><p className="theme-copy mt-2 text-sm">Auto-generated observations from ride volume, timing, and revenue patterns.</p></div><span className="inline-flex rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-200">{meta?.label || 'Live range'}</span></div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">{isLoading ? Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-32" />) : insights.length ? insights.map((insight) => <motion.div key={insight.title} whileHover={{ y: -3 }} className="rounded-[24px] border border-slate-200/70 bg-slate-50 p-4 text-slate-900 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /><p className="text-sm font-semibold">{insight.title}</p></div><p className="mt-3 text-sm leading-6 opacity-90">{insight.body}</p></motion.div>) : <EmptyState title="Insights will appear soon" body="RideFlow will surface key patterns here once enough ride activity is available in the selected period." />}</div>
            </div>
            <ChartCard title="Ride activity heatmap" subtitle="Hourly ride intensity by day of week, similar to an operations command center view.">{isLoading ? <SkeletonBlock className="h-full" /> : hasData ? <Heatmap data={heatmap} /> : <div className="flex h-full items-center justify-center"><EmptyState title="No heatmap data yet" body="As more rides are recorded in this period, activity density will appear here." /></div>}</ChartCard>
          </section>

          <section className="space-y-5">
            <div className="theme-soft-card rounded-[30px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><h2 className="theme-heading text-xl font-semibold">Weekly snapshot</h2><div className="mt-5 grid gap-4">{isLoading ? Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} className="h-24" />) : [['Rides in range', String(summary?.ridesThisWeek || 0)], [isDriver ? 'Earnings in range' : 'Spend in range', formatCurrency(summary?.revenueThisWeek || 0)], ['Avg distance', formatDistance(summary?.avgDistanceThisWeek || 0)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/60"><p className="theme-label text-xs uppercase tracking-[0.22em]">{label}</p><p className="theme-heading mt-3 text-2xl font-bold">{value}</p></div>)}</div></div>
            <ChartCard title="Ride status distribution" subtitle="See the mix of completed, cancelled, and ongoing rides.">{isLoading ? <SkeletonBlock className="h-full" /> : hasData ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusDistribution} dataKey="value" nameKey="label" innerRadius={62} outerRadius={100} paddingAngle={3}>{statusDistribution.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={chartPalette[index % chartPalette.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center"><EmptyState title="No status data yet" body="Ride status breakdown appears here once the selected period has rides." /></div>}</ChartCard>
          </section>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <ChartCard title="Rides trend" subtitle="Ride volume over time for the selected range.">{isLoading ? <SkeletonBlock className="h-full" /> : hasData ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trends}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" /><XAxis dataKey="label" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip /><Line type="monotone" dataKey="value" name="Rides" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center"><EmptyState title="No ride trend yet" body="RideFlow will plot trendlines here once rides exist in this time window." /></div>}</ChartCard>
          <ChartCard title={isDriver ? 'Earnings trend' : 'Spend trend'} subtitle="Revenue movement with a smooth area chart for quick pattern recognition.">{isLoading ? <SkeletonBlock className="h-full" /> : hasData ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={revenue}><defs><linearGradient id="analyticsRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f766e" stopOpacity={0.85} /><stop offset="95%" stopColor="#0f766e" stopOpacity={0.08} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" /><XAxis dataKey="label" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip /><Area type="monotone" dataKey="value" name={isDriver ? 'Earnings' : 'Spend'} stroke="#0f766e" fill="url(#analyticsRevenue)" strokeWidth={3} /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center"><EmptyState title="No revenue trend yet" body="Spend and earnings visuals appear here once billing data is available." /></div>}</ChartCard>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <ChartCard title="Peak hours" subtitle="See when demand is strongest across the day.">{isLoading ? <SkeletonBlock className="h-full" /> : hasData ? <ResponsiveContainer width="100%" height="100%"><BarChart data={peakHours}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" /><XAxis dataKey="label" stroke="#64748b" interval={2} /><YAxis stroke="#64748b" /><Tooltip /><Bar dataKey="value" name="Rides" fill="#7c3aed" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center"><EmptyState title="No hourly distribution yet" body="Peak hour behavior will appear here once enough rides exist in the selected period." /></div>}</ChartCard>
          <ChartCard title={isDriver ? 'Vehicle request mix' : 'Ride type distribution'} subtitle={isDriver ? 'Understand which vehicle categories drive your work.' : 'See which ride types you book most often.'}>{isLoading ? <SkeletonBlock className="h-full" /> : hasData ? <ResponsiveContainer width="100%" height="100%"><BarChart data={rideTypes} layout="vertical" margin={{ left: 10, right: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" /><XAxis type="number" stroke="#64748b" /><YAxis dataKey="label" type="category" stroke="#64748b" width={92} /><Tooltip /><Bar dataKey="value" name="Rides" fill="#f97316" radius={[0, 10, 10, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center"><EmptyState title="No ride type data yet" body="Ride type and vehicle mix appear once trips are available in this range." /></div>}</ChartCard>
        </div>
      </motion.section>
    </CustomerShell>
  );
}
