import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, BadgeCheck, CarFront, Clock3, ShieldCheck, Sparkles, Users, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomerShell from '../components/dashboard/CustomerShell';
import MapView from '../components/dashboard/MapView';
import SkeletonBlock from '../components/SkeletonBlock';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const money = (value) => `Rs ${Math.round(Number(value) || 0)}`;
const statusLabel = (value) => String(value || 'unknown').replaceAll('_', ' ');
const verificationTone = (value) => ({
  approved: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-500',
  pending: 'border-amber-400/20 bg-amber-400/10 text-amber-500',
  under_review: 'border-sky-400/20 bg-sky-400/10 text-sky-500',
  rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-500',
}[value] || 'border-slate-400/20 bg-slate-400/10 text-slate-500');
const accountTone = (value) => ({
  active: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-500',
  inactive: 'border-amber-400/20 bg-amber-400/10 text-amber-500',
  suspended: 'border-rose-400/20 bg-rose-400/10 text-rose-500',
  deleted: 'border-slate-400/20 bg-slate-400/10 text-slate-500',
}[value] || 'border-slate-400/20 bg-slate-400/10 text-slate-500');
const fullName = (entry, fallback = 'Unknown') => {
  const first = entry?.fullname?.firstname || '';
  const last = entry?.fullname?.lastname || '';
  return [first, last].filter(Boolean).join(' ').trim() || fallback;
};
const point = (coordinates) => Array.isArray(coordinates) && coordinates.length === 2
  ? { lng: Number(coordinates[0]), lat: Number(coordinates[1]) }
  : null;
const mapUser = (account) => ({
  id: account?._id,
  name: fullName(account, 'Unnamed customer'),
  email: account?.email || 'No email provided',
  phone: account?.phone || 'Phone not added',
  status: account?.status || 'active',
});
const mapDriver = (driver) => ({
  id: driver?._id,
  name: fullName(driver, 'Unnamed driver'),
  email: driver?.email || 'No email provided',
  vehicle: [driver?.vehicle?.color, driver?.vehicle?.model || driver?.vehicle?.vehicleType].filter(Boolean).join(' ') || 'Vehicle details pending',
  verificationStatus: driver?.verificationStatus || 'pending',
  status: driver?.status || 'active',
  isOnline: Boolean(driver?.isOnline),
});
const mapRide = (ride) => ({
  id: ride?._id,
  pickup: ride?.pickup?.address || 'Pickup unavailable',
  dropoff: ride?.destination?.address || 'Drop-off unavailable',
  pickupPoint: point(ride?.pickup?.location?.coordinates),
  dropoffPoint: point(ride?.destination?.location?.coordinates),
  status: ride?.status || 'requested',
  fare: ride?.fare?.actualFare || ride?.fare?.estimatedFare || 0,
  fareDisplay: money(ride?.fare?.actualFare || ride?.fare?.estimatedFare || 0),
  distanceDisplay: ride?.distance ? `${Number(ride.distance).toFixed(1)} km` : 'Distance pending',
  createdAt: ride?.createdAt ? new Date(ride.createdAt).toLocaleString() : 'Awaiting update',
  customerName: fullName(ride?.user, 'Unknown rider'),
  driverName: ride?.driver ? fullName(ride.driver, 'Assigned driver') : 'Awaiting assignment',
});
const blockButtonClass = 'inline-flex h-12 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/15 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-60';
const unblockButtonClass = 'inline-flex h-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/25 disabled:opacity-60';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const approvalRef = useRef(null);
  const accessRef = useRef(null);
  const { user, displayName } = useContext(AuthContext);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('info');
  const [loading, setLoading] = useState(true);
  const [busyDriverId, setBusyDriverId] = useState('');
  const [busyAccountKey, setBusyAccountKey] = useState('');
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [rides, setRides] = useState([]);
  const [overview, setOverview] = useState({ totalUsers: 0, totalDrivers: 0, activeDrivers: 0, totalRides: 0, completedRides: 0, cancelledRides: 0, revenue: 0 });

  const firstName = displayName?.split(' ')[0] || 'Admin';
  const showToast = (message, type = 'info') => { setToastType(type); setToast(message); };

  const loadAdminData = async () => {
    const [analyticsRes, usersRes, driversRes, ridesRes] = await Promise.all([
      apiFetch('/admin/analytics'),
      apiFetch('/admin/users'),
      apiFetch('/admin/drivers'),
      apiFetch('/admin/rides'),
    ]);
    const nextUsers = (usersRes.data || []).map(mapUser);
    const nextDrivers = (driversRes.data || []).map(mapDriver);
    const nextRides = (ridesRes.data || []).map(mapRide);
    setUsers(nextUsers);
    setDrivers(nextDrivers);
    setRides(nextRides);
    setOverview({
      totalUsers: analyticsRes.data?.totalUsers || nextUsers.length,
      totalDrivers: analyticsRes.data?.totalDrivers || nextDrivers.length,
      activeDrivers: analyticsRes.data?.activeDrivers || nextDrivers.filter((driver) => driver.isOnline).length,
      totalRides: analyticsRes.data?.totalRides || nextRides.length,
      completedRides: analyticsRes.data?.completedRides || nextRides.filter((ride) => ride.status === 'completed').length,
      cancelledRides: analyticsRes.data?.cancelledRides || nextRides.filter((ride) => ride.status === 'cancelled').length,
      revenue: analyticsRes.data?.revenue || nextRides.reduce((sum, ride) => sum + ride.fare, 0),
    });
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        await loadAdminData();
      } catch (error) {
        if (mounted) showToast(error?.message || 'Unable to load admin dashboard.', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    bootstrap();
    return () => { mounted = false; };
  }, []);

  const pendingDrivers = useMemo(() => drivers.filter((driver) => driver.verificationStatus !== 'approved'), [drivers]);
  const approvedDrivers = useMemo(() => drivers.filter((driver) => driver.verificationStatus === 'approved'), [drivers]);
  const blockedCustomers = useMemo(() => users.filter((account) => account.status === 'suspended'), [users]);
  const blockedDrivers = useMemo(() => drivers.filter((account) => account.status === 'suspended'), [drivers]);
  const latestRide = rides[0] || null;
  const completionRate = overview.totalRides ? Math.round((overview.completedRides / overview.totalRides) * 100) : 0;
  const avgFare = overview.totalRides ? Math.round(overview.revenue / overview.totalRides) : 0;
  const queue = (pendingDrivers.length ? pendingDrivers : drivers).slice(0, 4);
  const customerAccessList = users.slice(0, 4);
  const driverAccessList = drivers.slice(0, 4);
  const cards = [
    ['Customers', String(overview.totalUsers || users.length), `${blockedCustomers.length} blocked accounts`, Users],
    ['Drivers', String(overview.totalDrivers || drivers.length), `${blockedDrivers.length} blocked drivers`, CarFront],
    ['Revenue', money(overview.revenue), 'Recorded platform fare', Wallet],
    ['Completion', `${completionRate}%`, `${overview.completedRides} completed rides`, Activity],
  ];
  const quickActions = [
    ['Jump to approvals', 'Scroll straight to the verification queue.', () => approvalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })],
    ['Open access controls', 'Review who is active or blocked across customers and drivers.', () => accessRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })],
    ['Review platform rides', 'Open the shared rides workspace for full ride history.', () => navigate('/dashboard/admin/rides')],
  ];

  const updateDriverStatus = async (driver) => {
    const nextStatus = driver.verificationStatus === 'approved' ? 'pending' : 'approved';
    setBusyDriverId(driver.id);
    try {
      await apiFetch(`/admin/driver/${driver.id}/approve`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      await loadAdminData();
      showToast(`Driver verification updated to ${statusLabel(nextStatus)}.`, 'success');
    } catch (error) {
      showToast(error?.message || 'Unable to update driver approval.', 'error');
    } finally {
      setBusyDriverId('');
    }
  };

  const toggleAccountStatus = async (type, account) => {
    const nextStatus = account.status === 'suspended' ? 'active' : 'suspended';
    const accountKey = `${type}:${account.id}`;
    setBusyAccountKey(accountKey);
    try {
      await apiFetch(`/admin/accounts/${type}/${account.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadAdminData();
      showToast(`${type === 'driver' ? 'Driver' : 'Customer'} ${nextStatus === 'suspended' ? 'blocked' : 'unblocked'} successfully.`, 'success');
    } catch (error) {
      showToast(error?.message || 'Unable to update account access.', 'error');
    } finally {
      setBusyAccountKey('');
    }
  };

  return (
    <CustomerShell toast={toast} toastType={toastType} onDismissToast={() => setToast('')}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-1 py-2 sm:px-2 lg:px-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading ? Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-36 rounded-[28px]" />) : cards.map(([label, value, helper, Icon], index) => (
            <motion.article key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ scale: 1.03, y: -3 }} className="rounded-[28px] border border-white/20 bg-white/10 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
              <div className="flex items-center justify-between gap-3">
                <div><p className="theme-label text-[11px] uppercase tracking-[0.28em]">{label}</p><p className="theme-heading mt-3 text-3xl font-bold tracking-[-0.05em]">{value}</p></div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-cyan-100 dark:bg-white/10"><Icon className="h-5 w-5" /></span>
              </div>
              <p className="theme-copy mt-4 text-sm leading-6">{helper}</p>
            </motion.article>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
              <div ref={approvalRef} />
              <p className="theme-kicker">Operations desk</p>
              <h3 className="theme-heading mt-4 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">Driver verification queue</h3>
              <p className="theme-copy mt-3 max-w-2xl text-sm leading-7">Approvals and access control now sit together, so the admin can review a driver and block them from the same workspace if needed.</p>
              {loading ? <div className="mt-7 space-y-4"><SkeletonBlock className="h-24" /><SkeletonBlock className="h-24" /><SkeletonBlock className="h-24" /></div> : <>
                <div className="mt-7 grid gap-4 sm:grid-cols-4">
                  {[['Awaiting review', pendingDrivers.length], ['Approved drivers', approvedDrivers.length], ['Blocked drivers', blockedDrivers.length], ['Active drivers', overview.activeDrivers]].map(([label, value]) => <div key={label} className="theme-soft-card rounded-2xl p-4"><p className="theme-label text-xs uppercase tracking-[0.2em]">{label}</p><p className="theme-heading mt-2 text-2xl font-bold">{value}</p></div>)}
                </div>
                <div className="mt-6 space-y-3">
                  {queue.length ? queue.map((driver, index) => {
                    const accountKey = `driver:${driver.id}`;
                    const isBlocking = busyAccountKey === accountKey;
                    const isUpdatingVerification = busyDriverId === driver.id;

                    return (
                      <motion.div key={driver.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ y: -4 }} className="flex flex-col gap-4 rounded-[24px] border border-white/15 bg-white/10 p-5">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="theme-heading text-base font-semibold">{driver.name}</p>
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${verificationTone(driver.verificationStatus)}`}>{statusLabel(driver.verificationStatus)}</span>
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accountTone(driver.status)}`}>{statusLabel(driver.status)}</span>
                          </div>
                          <p className="theme-copy text-sm">{driver.email}</p>
                          <p className="theme-copy text-sm">{driver.vehicle}{driver.isOnline ? ' - Online now' : ' - Offline'}</p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button type="button" disabled={isUpdatingVerification || isBlocking} onClick={() => updateDriverStatus(driver)} className={`${driver.verificationStatus === 'approved' ? 'theme-secondary-button' : 'theme-primary-button'} inline-flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-semibold disabled:opacity-60`}>
                            {isUpdatingVerification ? 'Updating...' : driver.verificationStatus === 'approved' ? 'Move to pending' : 'Approve driver'}
                          </button>
                          <button type="button" disabled={isUpdatingVerification || isBlocking} onClick={() => toggleAccountStatus('driver', driver)} className={driver.status === 'suspended' ? unblockButtonClass : blockButtonClass}>
                            {isBlocking ? 'Saving...' : driver.status === 'suspended' ? 'Unblock driver' : 'Block driver'}
                          </button>
                        </div>
                      </motion.div>
                    );
                  }) : <div className="theme-soft-card rounded-[24px] p-5"><p className="theme-heading text-base font-semibold">Queue is clear</p><p className="theme-copy mt-2 text-sm leading-7">No drivers need review right now.</p></div>}
                </div>
              </>}
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
              <p className="theme-kicker">Marketplace pulse</p>
              <h3 className="theme-heading mt-4 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">Current platform status</h3>
              <p className="theme-copy mt-3 max-w-2xl text-sm leading-7">Recent ride state, revenue, and review health in the same visual language riders already see.</p>
              {loading ? <div className="mt-7 grid gap-4 sm:grid-cols-3"><SkeletonBlock className="h-24" /><SkeletonBlock className="h-24" /><SkeletonBlock className="h-24" /></div> : <>
                {latestRide ? <div className="mt-7 grid gap-4 sm:grid-cols-3">{[['Pickup', latestRide.pickup], ['Destination', latestRide.dropoff], ['Status', statusLabel(latestRide.status)]].map(([label, value]) => <div key={label} className="theme-soft-card rounded-2xl p-4"><p className="theme-label text-xs uppercase tracking-[0.2em]">{label}</p><p className="theme-heading mt-2 break-words text-sm font-semibold">{value}</p></div>)}</div> : <div className="theme-soft-card mt-7 rounded-2xl p-5"><p className="theme-copy text-sm leading-7">No platform rides yet. The latest trip snapshot will appear here once activity starts.</p></div>}
                <div className="mt-6 grid gap-4 sm:grid-cols-3">{[['Average fare', money(avgFare)], ['Cancelled rides', String(overview.cancelledRides)], ['Workspace owner', displayName || user?.email || 'Admin']].map(([label, value]) => <div key={label} className="theme-subtle rounded-2xl p-4"><p className="theme-label text-xs uppercase tracking-[0.2em]">{label}</p><p className="theme-heading mt-2 break-words text-sm font-semibold">{value}</p></div>)}</div>
              </>}
            </motion.section>
          </div>

          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }} className="rounded-[32px] border border-white/20 bg-white/10 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
            <MapView pickupPoint={latestRide?.pickupPoint || null} dropoffPoint={latestRide?.dropoffPoint || null} routeMeta={latestRide ? `${latestRide.distanceDisplay} - ${statusLabel(latestRide.status)}` : `${blockedCustomers.length + blockedDrivers.length} blocked accounts`} summary={{ pickup: latestRide?.pickup || '', dropoff: latestRide?.dropoff || '' }} title="Marketplace view" subtitle={`Latest ride routing and account health context for ${firstName}.`} />
          </motion.div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
            <div ref={accessRef} />
            <div className="flex items-center justify-between gap-4">
              <div><p className="theme-kicker">Access control</p><h3 className="theme-heading mt-3 text-2xl font-bold tracking-[-0.04em]">Block customers or drivers</h3><p className="theme-copy mt-2 text-sm leading-7">Admins can now suspend either side of the marketplace and restore access later when an issue is resolved.</p></div>
              <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => navigate('/dashboard/admin/settings')} className="theme-secondary-button rounded-2xl px-4 py-3 text-sm font-semibold">Admin settings</motion.button>
            </div>
            {loading ? <div className="mt-6 grid gap-4 lg:grid-cols-2"><SkeletonBlock className="h-72 rounded-[24px]" /><SkeletonBlock className="h-72 rounded-[24px]" /></div> : <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="theme-heading text-lg font-semibold">Customers</p><p className="theme-copy mt-1 text-sm">{blockedCustomers.length} blocked customers right now.</p></div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-100">{users.length} total</span>
                </div>
                <div className="mt-5 space-y-3">
                  {customerAccessList.length ? customerAccessList.map((account) => {
                    const accountKey = `customer:${account.id}`;
                    const isBusy = busyAccountKey === accountKey;
                    return (
                      <div key={account.id} className="rounded-[20px] border border-white/15 bg-white/10 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="theme-heading text-sm font-semibold">{account.name}</p>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accountTone(account.status)}`}>{statusLabel(account.status)}</span>
                        </div>
                        <p className="theme-copy mt-2 text-sm">{account.email}</p>
                        <p className="theme-copy mt-1 text-sm">{account.phone}</p>
                        <button type="button" disabled={isBusy} onClick={() => toggleAccountStatus('customer', account)} className={`${account.status === 'suspended' ? unblockButtonClass : blockButtonClass} mt-4 w-full`}>
                          {isBusy ? 'Saving...' : account.status === 'suspended' ? 'Unblock customer' : 'Block customer'}
                        </button>
                      </div>
                    );
                  }) : <div className="theme-soft-card rounded-[20px] p-4"><p className="theme-copy text-sm leading-7">Customer accounts will appear here once riders sign up.</p></div>}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="theme-heading text-lg font-semibold">Drivers</p><p className="theme-copy mt-1 text-sm">{blockedDrivers.length} blocked drivers right now.</p></div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-100">{drivers.length} total</span>
                </div>
                <div className="mt-5 space-y-3">
                  {driverAccessList.length ? driverAccessList.map((account) => {
                    const accountKey = `driver:${account.id}`;
                    const isBusy = busyAccountKey === accountKey;
                    return (
                      <div key={account.id} className="rounded-[20px] border border-white/15 bg-white/10 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="theme-heading text-sm font-semibold">{account.name}</p>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accountTone(account.status)}`}>{statusLabel(account.status)}</span>
                        </div>
                        <p className="theme-copy mt-2 text-sm">{account.email}</p>
                        <p className="theme-copy mt-1 text-sm">{account.vehicle}</p>
                        <button type="button" disabled={isBusy} onClick={() => toggleAccountStatus('driver', account)} className={`${account.status === 'suspended' ? unblockButtonClass : blockButtonClass} mt-4 w-full`}>
                          {isBusy ? 'Saving...' : account.status === 'suspended' ? 'Unblock driver' : 'Block driver'}
                        </button>
                      </div>
                    );
                  }) : <div className="theme-soft-card rounded-[20px] p-4"><p className="theme-copy text-sm leading-7">Driver accounts will appear here once onboarding begins.</p></div>}
                </div>
              </div>
            </div>}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="space-y-6">
            <div className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
              <div className="flex items-center justify-between gap-4">
                <div><p className="theme-kicker">Recent rides</p><h3 className="theme-heading mt-3 text-2xl font-bold tracking-[-0.04em]">Latest platform activity</h3><p className="theme-copy mt-2 text-sm leading-7">A cleaner operational feed for rides, customers, drivers, and fare movement.</p></div>
                <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => navigate('/dashboard/admin/rides')} className="theme-secondary-button rounded-2xl px-4 py-3 text-sm font-semibold">View all rides</motion.button>
              </div>
              <div className="mt-6 space-y-3">
                <AnimatePresence mode="popLayout">
                  {loading ? Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-24 rounded-[22px]" />) : rides.length ? rides.slice(0, 4).map((ride, index) => <motion.div key={ride.id || index} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ delay: index * 0.05 }} whileHover={{ y: -5 }} className="flex flex-col gap-4 rounded-[24px] border border-white/15 bg-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2"><p className="theme-heading text-base font-semibold">{ride.pickup}</p><p className="theme-copy text-sm">{ride.dropoff}</p><p className="theme-copy text-sm">Customer: {ride.customerName} - Driver: {ride.driverName}</p></div>
                    <div className="flex flex-wrap items-center gap-3 text-sm"><span className={`rounded-full border px-3 py-1 font-semibold capitalize ${accountTone(ride.status === 'cancelled' ? 'suspended' : ride.status === 'completed' ? 'active' : 'inactive')}`}>{statusLabel(ride.status)}</span><span className="theme-copy">{ride.fareDisplay}</span><span className="theme-copy">{ride.createdAt}</span></div>
                  </motion.div>) : <div className="rounded-[24px] border border-white/15 bg-white/10 p-6"><p className="theme-copy text-sm leading-7">Platform rides will appear here once customers begin booking trips.</p></div>}
                </AnimatePresence>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
              <p className="theme-kicker">Shortcuts</p>
              <h3 className="theme-heading mt-3 text-2xl font-bold tracking-[-0.04em]">Move faster</h3>
              <p className="theme-copy mt-2 text-sm leading-7">The same quick-action pattern from the customer dashboard, adapted for admin workflows.</p>
              <div className="mt-6 grid gap-4">{quickActions.map(([title, body, action], index) => <motion.button key={title} type="button" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.05 }} whileHover={{ scale: 1.02, y: -3 }} whileTap={{ scale: 0.97 }} onClick={action} className="rounded-[24px] border border-white/15 bg-white/10 p-5 text-left"><div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-100 dark:text-cyan-200"><Sparkles className="h-4 w-4" /></span><div><p className="theme-heading text-base font-semibold">{title}</p><p className="theme-copy mt-2 text-sm leading-6">{body}</p></div></div></motion.button>)}</div>
              {!loading ? <div className="mt-6 grid gap-3">{[['Security posture', blockedCustomers.length + blockedDrivers.length ? 'Restrictions applied' : 'Healthy', ShieldCheck], ['Review focus', pendingDrivers.length ? `${pendingDrivers.length} driver approvals` : 'Marketplace monitoring', BadgeCheck], ['Live ride count', String(overview.totalRides), Clock3]].map(([label, value, Icon]) => <div key={label} className="theme-soft-card flex items-center gap-3 rounded-2xl p-4"><div className="theme-subtle flex h-11 w-11 items-center justify-center rounded-2xl"><Icon className="h-4 w-4" /></div><div><p className="theme-label text-xs uppercase tracking-[0.22em]">{label}</p><p className="theme-heading mt-2 text-sm font-semibold">{value}</p></div></div>)}</div> : null}
            </div>
          </motion.div>
        </section>
      </div>
    </CustomerShell>
  );
}
