import { useContext, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CarFront,
  CircleDollarSign,
  Clock3,
  MapPin,
  Power,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomerShell from '../components/dashboard/CustomerShell';
import MapView from '../components/dashboard/MapView';
import SkeletonBlock from '../components/SkeletonBlock';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { apiFetch } from '../utils/api';

const activeRideStatuses = ['accepted', 'arriving', 'in_progress'];

const statusClasses = {
  requested: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100',
  accepted: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100',
  arriving: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100',
  in_progress: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-100',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-100',
};

const statusText = (status = 'requested') => String(status || 'requested').replaceAll('_', ' ');

const rideTime = (ride = {}) => {
  const source = ride?.completedAt || ride?.startedAt || ride?.acceptedAt || ride?.createdAt || ride?.updatedAt;
  if (!source) return 'Awaiting update';
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? 'Awaiting update' : date.toLocaleString();
};

const rideFare = (ride = {}) => {
  if (typeof ride?.fare === 'number' && Number.isFinite(ride.fare)) return ride.fare;
  const parsed = Number(String(ride?.fareDisplay || '0').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRides, setIncomingRides] = useState([]);
  const [rideHistory, setRideHistory] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyRideId, setBusyRideId] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('info');

  const showToast = (message, type = 'info') => {
    setToastType(type);
    setToast(message);
  };

  const loadDriverData = async () => {
    if (!user?.id) return;

    const [driverResponse, ridesResponse] = await Promise.all([
      apiFetch(`/drivers/${user.id}`),
      apiFetch(`/rides/driver/${user.id}?page=1&limit=6&requestLimit=6&sortBy=createdAt&order=desc`),
    ]);

    const driverData = driverResponse?.data || {};
    const ridesData = ridesResponse?.data || {};

    setIsOnline(Boolean(driverData?.isOnline));
    setIncomingRides([...(ridesData?.incomingRequests || [])]);
    setActiveRide(ridesData?.activeRide || null);
    setRideHistory([...(ridesData?.assignedRides || [])]);
    setLoadError('');
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      if (!user?.id) return;

      try {
        await loadDriverData();
      } catch (error) {
        if (mounted) {
          setLoadError(error?.message || 'Unable to load driver dashboard.');
          showToast(error?.message || 'Unable to load driver dashboard.', 'error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!socket || !user?.id) return undefined;

    const handleRequested = ({ ride }) => {
      if (!ride) return;
      setIncomingRides((current) => (current.some((entry) => entry?.id === ride?.id) ? current : [ride, ...current]));
    };

    const handleTaken = ({ rideId }) => {
      setIncomingRides((current) => current.filter((entry) => entry?.id !== rideId));
    };

    const handleAccepted = ({ ride }) => {
      if (ride?.driverId !== user.id) return;
      setActiveRide(ride || null);
      setIncomingRides((current) => current.filter((entry) => entry?.id !== ride?.id));
      setRideHistory((current) => [ride, ...current.filter((entry) => entry?.id !== ride?.id)]);
    };

    const handleStatus = ({ ride }) => {
      if (ride?.driverId !== user.id) return;
      setRideHistory((current) => {
        if (!current.some((entry) => entry?.id === ride?.id)) return [ride, ...current];
        return current.map((entry) => (entry?.id === ride?.id ? ride : entry));
      });
      setActiveRide(activeRideStatuses.includes(ride?.status) ? ride : null);
    };

    socket.on('ride:requested', handleRequested);
    socket.on('ride_taken', handleTaken);
    socket.on('ride:accepted', handleAccepted);
    socket.on('ride:status', handleStatus);

    return () => {
      socket.off('ride:requested', handleRequested);
      socket.off('ride_taken', handleTaken);
      socket.off('ride:accepted', handleAccepted);
      socket.off('ride:status', handleStatus);
    };
  }, [socket, user?.id]);

  const prioritizedRequests = useMemo(
    () => [...incomingRides].sort((a, b) => new Date(b?.createdAt || b?.updatedAt || 0).getTime() - new Date(a?.createdAt || a?.updatedAt || 0).getTime()),
    [incomingRides],
  );

  const recentRides = useMemo(
    () => [...rideHistory].sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime()).slice(0, 4),
    [rideHistory],
  );

  const totalEarnings = useMemo(() => Math.round(rideHistory.reduce((sum, ride) => sum + rideFare(ride), 0)), [rideHistory]);
  const completedRides = useMemo(() => rideHistory.filter((ride) => ride?.status === 'completed').length, [rideHistory]);
  const focusRide = activeRide || prioritizedRequests[0] || null;

  const summaryCards = useMemo(
    () => [
      { label: 'Completed rides', value: String(completedRides), helper: 'Trips completed from your account', icon: CarFront },
      { label: 'Total earnings', value: `Rs ${totalEarnings}`, helper: 'Estimated from assigned ride history', icon: CircleDollarSign },
      { label: 'Incoming queue', value: String(prioritizedRequests.length), helper: isOnline ? 'Fresh dispatch requests waiting' : 'Go online to receive rides', icon: Zap },
      { label: 'Driver status', value: activeRide ? statusText(activeRide.status) : (isOnline ? 'online' : 'offline'), helper: activeRide ? (activeRide.dropoff || 'Current trip in progress') : (isOnline ? 'Available for dispatches' : 'Currently paused'), icon: ShieldCheck },
    ],
    [activeRide, completedRides, isOnline, prioritizedRequests.length, totalEarnings],
  );

  const routeMeta = focusRide?.distanceDisplay
    ? `${focusRide.distanceDisplay} • ${statusText(focusRide.status)}`
    : focusRide
      ? `Focused on ${statusText(focusRide.status)}`
      : 'Route preview will appear when active rides or requests are available.';

  const runRideAction = async ({ rideId, path, body, successMessage, onSuccess }) => {
    if (!rideId || busyRideId === rideId) return;
    setBusyRideId(rideId);
    try {
      const response = await apiFetch(path, {
        method: 'PATCH',
        body: JSON.stringify({ driverId: user?.id, ...body }),
      });
      onSuccess(response?.data || null);
      showToast(successMessage, 'success');
    } catch (error) {
      showToast(error?.message || 'Action failed.', 'error');
    } finally {
      setBusyRideId('');
    }
  };

  const toggleOnline = async () => {
    setStatusBusy(true);
    try {
      const response = await apiFetch('/driver/status', {
        method: 'PATCH',
        body: JSON.stringify({ driverId: user?.id, isOnline: !isOnline }),
      });
      const nextOnline = Boolean(response?.data?.isOnline);
      setIsOnline(nextOnline);
      showToast(response?.message || `Driver is now ${nextOnline ? 'online' : 'offline'}.`, 'success');
    } catch (error) {
      showToast(error?.message || 'Unable to update driver status.', 'error');
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <CustomerShell toast={toast} toastType={toastType} onDismissToast={() => setToast('')}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-1 py-2 sm:px-2 lg:px-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-36 rounded-[28px]" />)
            : summaryCards.map((card, index) => (
              <motion.article key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ scale: 1.03, y: -3 }} className="rounded-[28px] border border-white/20 bg-white/10 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="theme-label text-[11px] uppercase tracking-[0.28em]">{card.label}</p>
                    <p className="theme-heading mt-3 text-3xl font-bold tracking-[-0.05em] capitalize">{card.value}</p>
                  </div>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-cyan-100 dark:bg-white/10">
                    <card.icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="theme-copy mt-4 text-sm leading-6">{card.helper}</p>
              </motion.article>
            ))}
        </section>

        {loadError && !loading ? (
          <section className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
            <p className="theme-kicker">Driver dashboard</p>
            <h2 className="theme-heading mt-3 text-2xl font-bold tracking-[-0.04em]">Unable to load live data</h2>
            <p className="theme-copy mt-3 max-w-2xl text-sm leading-7">{loadError}</p>
            <button type="button" onClick={async () => { setLoading(true); try { await loadDriverData(); showToast('Driver dashboard refreshed.', 'success'); } catch (error) { setLoadError(error?.message || 'Unable to load driver dashboard.'); showToast(error?.message || 'Unable to load driver dashboard.', 'error'); } finally { setLoading(false); } }} className="theme-primary-button mt-6 inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold">
              Retry
            </button>
          </section>
        ) : null}

        {!loadError && !loading ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-6">
                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="theme-kicker">Dispatch</p>
                      <h2 className="theme-heading mt-3 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">Incoming ride requests</h2>
                      <p className="theme-copy mt-3 max-w-2xl text-sm leading-7">The driver home now follows the same clean dashboard language as the customer workspace while keeping dispatch actions close.</p>
                    </div>
                    <button type="button" disabled={statusBusy} onClick={toggleOnline} className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition disabled:opacity-60 ${isOnline ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100' : 'theme-secondary-button'}`}>
                      <Power className="h-4 w-4" />
                      {statusBusy ? 'Updating...' : isOnline ? 'Go offline' : 'Go online'}
                    </button>
                  </div>

                  <div className="mt-6 space-y-4">
                    {prioritizedRequests.length ? prioritizedRequests.map((ride, index) => (
                      <motion.article key={ride?.id || index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} whileHover={{ y: -4 }} className="theme-soft-card rounded-[26px] p-5">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="theme-label text-xs uppercase tracking-[0.22em]">Dispatch request</p>
                              <p className="theme-heading mt-2 text-lg font-semibold">{ride?.pickup || 'Pickup unavailable'}</p>
                              <p className="theme-copy mt-1 text-sm">to {ride?.dropoff || 'Destination unavailable'}</p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClasses[ride?.status] || statusClasses.requested}`}>
                              {statusText(ride?.status)}
                            </span>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="theme-subtle rounded-2xl p-4">
                              <div className="flex items-center gap-2"><CircleDollarSign className="theme-accent h-4 w-4" /><p className="theme-label text-xs uppercase tracking-[0.22em]">Fare</p></div>
                              <p className="theme-heading mt-2 text-base font-semibold">{ride?.fareDisplay || 'Rs 0'}</p>
                            </div>
                            <div className="theme-subtle rounded-2xl p-4">
                              <div className="flex items-center gap-2"><MapPin className="theme-accent h-4 w-4" /><p className="theme-label text-xs uppercase tracking-[0.22em]">Distance</p></div>
                              <p className="theme-heading mt-2 text-base font-semibold">{ride?.distanceDisplay || 'Distance pending'}</p>
                            </div>
                            <div className="theme-subtle rounded-2xl p-4">
                              <div className="flex items-center gap-2"><Clock3 className="theme-accent h-4 w-4" /><p className="theme-label text-xs uppercase tracking-[0.22em]">Requested</p></div>
                              <p className="theme-heading mt-2 text-base font-semibold">{rideTime(ride)}</p>
                            </div>
                            <div className="theme-subtle rounded-2xl p-4">
                              <div className="flex items-center gap-2"><UserRound className="theme-accent h-4 w-4" /><p className="theme-label text-xs uppercase tracking-[0.22em]">Rider</p></div>
                              <p className="theme-heading mt-2 text-base font-semibold">{ride?.customer?.name || 'Customer pending'}</p>
                              <p className="theme-copy mt-1 text-sm">{ride?.customer?.email || 'Contact details available after acceptance'}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row">
                            <button type="button" disabled={busyRideId === ride?.id} onClick={() => runRideAction({ rideId: ride?.id, path: `/rides/${ride?.id}/accept`, successMessage: 'Ride accepted successfully.', onSuccess: (nextRide) => { if (!nextRide) return; setIncomingRides((current) => current.filter((entry) => entry?.id !== ride?.id)); setActiveRide(nextRide); setRideHistory((current) => [nextRide, ...current.filter((entry) => entry?.id !== nextRide?.id)]); } })} className="theme-primary-button inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold disabled:opacity-60">
                              {busyRideId === ride?.id ? 'Processing...' : 'Accept ride'}
                            </button>
                            <button type="button" disabled={busyRideId === ride?.id} onClick={() => runRideAction({ rideId: ride?.id, path: `/rides/${ride?.id}/reject`, successMessage: 'Ride rejected.', onSuccess: () => setIncomingRides((current) => current.filter((entry) => entry?.id !== ride?.id)) })} className="theme-secondary-button inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-rose-600 disabled:opacity-60">
                              {busyRideId === ride?.id ? 'Processing...' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      </motion.article>
                    )) : (
                      <div className="theme-soft-card rounded-[24px] p-6">
                        <p className="theme-heading text-base font-semibold">No incoming rides right now</p>
                        <p className="theme-copy mt-2 text-sm leading-7">{isOnline ? 'You are visible to riders. Fresh dispatches will appear here as soon as they arrive.' : 'Turn on driver availability to start receiving new ride requests.'}</p>
                      </div>
                    )}
                  </div>
                </motion.section>

                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
                  <p className="theme-kicker">Active trip</p>
                  <h3 className="theme-heading mt-3 text-2xl font-bold tracking-[-0.04em]">Current ride status</h3>
                  <p className="theme-copy mt-3 max-w-2xl text-sm leading-7">Track the ride you are handling without leaving the home dashboard.</p>

                  {activeRide ? (
                    <div className="mt-6 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="theme-soft-card rounded-2xl p-4"><p className="theme-label text-xs uppercase tracking-[0.2em]">Pickup</p><p className="theme-heading mt-2 break-words text-sm font-semibold">{activeRide.pickup}</p></div>
                        <div className="theme-soft-card rounded-2xl p-4"><p className="theme-label text-xs uppercase tracking-[0.2em]">Destination</p><p className="theme-heading mt-2 break-words text-sm font-semibold">{activeRide.dropoff}</p></div>
                        <div className="theme-soft-card rounded-2xl p-4"><p className="theme-label text-xs uppercase tracking-[0.2em]">Fare</p><p className="theme-heading mt-2 text-sm font-semibold">{activeRide.fareDisplay || 'Rs 0'}</p></div>
                        <div className="theme-soft-card rounded-2xl p-4"><p className="theme-label text-xs uppercase tracking-[0.2em]">Status</p><p className="theme-heading mt-2 text-sm font-semibold capitalize">{statusText(activeRide.status)}</p><p className="theme-copy mt-1 text-sm">{rideTime(activeRide)}</p></div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {activeRide.status === 'accepted' ? (
                          <button type="button" disabled={busyRideId === activeRide.id} onClick={() => runRideAction({ rideId: activeRide.id, path: `/rides/${activeRide.id}/start`, successMessage: 'Ride started.', onSuccess: (nextRide) => { if (!nextRide) return; setActiveRide(nextRide); setRideHistory((current) => current.map((entry) => (entry?.id === activeRide.id ? nextRide : entry))); } })} className="theme-primary-button inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold disabled:opacity-60">
                            {busyRideId === activeRide.id ? 'Updating...' : 'Start ride'}
                          </button>
                        ) : null}
                        {['accepted', 'arriving', 'in_progress'].includes(activeRide.status) ? (
                          <button type="button" disabled={busyRideId === activeRide.id} onClick={() => runRideAction({ rideId: activeRide.id, path: `/rides/${activeRide.id}/complete`, successMessage: 'Ride completed.', onSuccess: (nextRide) => { if (nextRide) setRideHistory((current) => current.map((entry) => (entry?.id === activeRide.id ? nextRide : entry))); setActiveRide(null); } })} className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 disabled:opacity-60">
                            {busyRideId === activeRide.id ? 'Updating...' : 'Complete ride'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="theme-soft-card mt-6 rounded-2xl p-5">
                      <p className="theme-copy text-sm leading-7">Accept a request from the dispatch queue to activate live trip controls here.</p>
                    </div>
                  )}
                </motion.section>
              </div>

              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }} className="rounded-[32px] border border-white/20 bg-white/10 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
                <MapView title="Live route map" subtitle="Follow your active ride or preview the next request directly from the driver dashboard." routeMeta={routeMeta} summary={{ pickup: focusRide?.pickup || 'Waiting for a live ride request', dropoff: focusRide?.dropoff || 'Accept a trip to preview the route' }} />
              </motion.div>
            </div>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="theme-kicker">Recent rides</p>
                    <h3 className="theme-heading mt-3 text-2xl font-bold tracking-[-0.04em]">Latest assigned trips</h3>
                    <p className="theme-copy mt-2 text-sm leading-7">A cleaner snapshot of the rides you have already handled.</p>
                  </div>
                  <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => navigate('/dashboard/driver/rides')} className="theme-secondary-button rounded-2xl px-4 py-3 text-sm font-semibold">
                    View all rides
                  </motion.button>
                </div>

                <div className="mt-6 space-y-3">
                  {recentRides.length ? recentRides.map((ride, index) => (
                    <motion.div key={ride?.id || index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} whileHover={{ y: -4 }} className="theme-soft-card flex flex-col gap-4 rounded-[24px] p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2">
                        <p className="theme-heading text-base font-semibold">{ride?.pickup || 'Pickup unavailable'}</p>
                        <p className="theme-copy text-sm">to {ride?.dropoff || 'Destination unavailable'}</p>
                        <p className="theme-copy text-sm">{rideTime(ride)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className={`rounded-full border px-3 py-1 font-semibold capitalize ${statusClasses[ride?.status] || statusClasses.accepted}`}>{statusText(ride?.status)}</span>
                        <span className="theme-copy">{ride?.fareDisplay || 'Rs 0'}</span>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="theme-soft-card rounded-[24px] p-6">
                      <p className="theme-copy text-sm leading-7">Accepted and completed trips will appear here as you start driving with RideFlow.</p>
                    </div>
                  )}
                </div>
              </motion.section>

              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg">
                <p className="theme-kicker">Driver tools</p>
                <h3 className="theme-heading mt-3 text-2xl font-bold tracking-[-0.04em]">Move faster</h3>
                <p className="theme-copy mt-2 text-sm leading-7">Quick entry points for the actions drivers reach for most often.</p>

                <div className="mt-6 grid gap-4">
                  {[
                    {
                      title: isOnline ? 'Pause new dispatches' : 'Start receiving rides',
                      body: isOnline ? 'Switch offline when you need to pause incoming requests without leaving the dashboard.' : 'Go online and immediately return to the dispatch queue for fresh requests.',
                      action: toggleOnline,
                      icon: Power,
                    },
                    {
                      title: 'Open ride history',
                      body: 'Jump into the rides page for filters, sorting, and full trip records.',
                      action: () => navigate('/dashboard/driver/rides'),
                      icon: CarFront,
                    },
                    {
                      title: 'Review performance',
                      body: 'Head into analytics to inspect earnings, ride totals, and distance trends.',
                      action: () => navigate('/dashboard/driver/analytics'),
                      icon: Sparkles,
                    },
                  ].map((item, index) => (
                    <motion.button key={item.title} type="button" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.05 }} whileHover={{ scale: 1.02, y: -3 }} whileTap={{ scale: 0.97 }} onClick={item.action} className="rounded-[24px] border border-white/15 bg-white/10 p-5 text-left">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-100 dark:text-cyan-200"><item.icon className="h-4 w-4" /></span>
                        <div>
                          <p className="theme-heading text-base font-semibold">{item.title}</p>
                          <p className="theme-copy mt-2 text-sm leading-6">{item.body}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.section>
            </section>
          </>
        ) : null}
      </div>
    </CustomerShell>
  );
}

