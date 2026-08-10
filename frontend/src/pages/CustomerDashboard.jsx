import { useContext, useEffect, useMemo, useState } from 'react';
import { CarFront, Clock3, MapPin, Route, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/dashboard/Navbar';
import Sidebar from '../components/dashboard/Sidebar';
import StatCard from '../components/dashboard/StatCard';
import RideCard from '../components/dashboard/RideCard';
import MapView from '../components/dashboard/MapView';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { apiFetch } from '../utils/api';

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'rides', label: 'Rides' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
];

const formatRideTime = (ride) => {
  const source = ride.completedAt || ride.startedAt || ride.acceptedAt || ride.createdAt;
  return source ? new Date(source).toLocaleString() : 'Awaiting update';
};

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { user, displayName, logout } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [activeItem, setActiveItem] = useState('dashboard');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [toast, setToast] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [estimate, setEstimate] = useState(null);

  const firstName = useMemo(() => displayName.split(' ')[0] || 'Customer', [displayName]);
  const totalSpend = useMemo(() => rides.reduce((sum, ride) => sum + (ride.fare || 0), 0), [rides]);
  const completedRides = useMemo(() => rides.filter((ride) => ride.status === 'completed'), [rides]);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const loadRides = async () => {
    if (!user?.id) return;
    const response = await apiFetch(`/rides/user/${user.id}`);
    const payload = response.data || {};
    setRides(payload.rides || []);
    setActiveRide(payload.activeRide || null);
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await loadRides();
      } catch (error) {
        showToast(error?.message || 'Unable to load rides.');
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

    const handleRideRequested = ({ ride }) => {
      if (ride?.customerId === user.id) {
        setActiveRide(ride);
        setRides((current) => [ride, ...current.filter((entry) => entry.id !== ride.id)]);
      }
    };

    const handleRideAccepted = ({ ride }) => {
      if (ride?.customerId === user.id) {
        setActiveRide(ride);
        setRides((current) => current.map((entry) => (entry.id === ride.id ? ride : entry)));
        socket.emit('join_ride', ride.id);
        showToast('A driver accepted your ride.');
      }
    };

    const handleRideStatus = ({ ride }) => {
      if (ride?.customerId === user.id) {
        setActiveRide(['completed', 'cancelled'].includes(ride.status) ? null : ride);
        setRides((current) => {
          const exists = current.some((entry) => entry.id === ride.id);
          if (!exists) return [ride, ...current];
          return current.map((entry) => (entry.id === ride.id ? ride : entry));
        });
      }
    };

    socket.on('ride:requested', handleRideRequested);
    socket.on('ride:accepted', handleRideAccepted);
    socket.on('ride:status', handleRideStatus);

    return () => {
      socket.off('ride:requested', handleRideRequested);
      socket.off('ride:accepted', handleRideAccepted);
      socket.off('ride:status', handleRideStatus);
    };
  }, [socket, user?.id]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleBookRide = async () => {
    if (!pickup.trim() || !dropoff.trim()) {
      showToast('Enter pickup and drop-off locations to request a ride.');
      return;
    }

    setIsBooking(true);

    try {
      const response = await apiFetch('/rides/book', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          pickup: pickup.trim(),
          drop: dropoff.trim(),
        }),
      });

      const ride = response.data;
      setEstimate({ fare: ride.fareDisplay, eta: 'Searching nearby drivers', vehicle: ride.vehicleType });
      setActiveRide(ride);
      setRides((current) => [ride, ...current.filter((entry) => entry.id !== ride.id)]);
      if (socket) {
        socket.emit('join_ride', ride.id);
      }
      showToast('Ride requested successfully.');
      setPickup('');
      setDropoff('');
    } catch (error) {
      showToast(error?.message || 'Unable to request ride.');
    } finally {
      setIsBooking(false);
    }
  };

  const renderContent = () => {
    if (activeItem === 'rides') {
      return (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              {rides.length ? rides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={{
                    pickup: ride.pickup,
                    dropoff: ride.dropoff,
                    fare: ride.fareDisplay,
                    time: formatRideTime(ride),
                    status: ride.status,
                    live: activeRide?.id === ride.id,
                  }}
                  statusTone={ride.status === 'completed' ? 'emerald' : ride.status === 'cancelled' ? 'rose' : 'cyan'}
                />
              )) : (
                <div className="rounded-[28px] border border-white/10 bg-white/8 p-8 text-center text-slate-400 backdrop-blur-2xl">
                  No rides yet. Book your first trip from the dashboard tab.
                </div>
              )}
            </div>
            <MapView title="Trip activity map" subtitle="Live and historical ride movement, ready for Google Maps overlays." />
          </div>
        </div>
      );
    }

    if (activeItem === 'profile') {
      return (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[30px] border border-white/10 bg-white/8 p-6 shadow-[0_20px_70px_rgba(2,6,23,0.26)] backdrop-blur-2xl">
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/75">Profile</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Account identity</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Name</p><p className="mt-2 text-lg font-semibold text-white">{displayName}</p></div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Email</p><p className="mt-2 text-lg font-semibold text-white">{user?.email}</p></div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Role</p><p className="mt-2 text-lg font-semibold text-white">{user?.role}</p></div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Lifetime rides</p><p className="mt-2 text-lg font-semibold text-white">{rides.length}</p></div>
            </div>
          </section>
          <MapView title="Saved places" subtitle="Hook home, work, and favorites into geocoding and map search next." />
        </div>
      );
    }

    if (activeItem === 'settings') {
      return (
        <section className="grid gap-5 xl:grid-cols-2">
          {[
            ['Notifications', 'Trip updates, ETA shifts, and pricing alerts'],
            ['Payment methods', 'Cards, wallets, and invoicing controls'],
            ['Privacy', 'Location preferences and session trust settings'],
            ['Support', 'Priority support, receipts, and dispute history'],
          ].map(([title, text]) => (
            <div key={title} className="rounded-[28px] border border-white/10 bg-white/8 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.24)] backdrop-blur-2xl">
              <p className="text-lg font-semibold text-white">{title}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
            </div>
          ))}
        </section>
      );
    }

    return (
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-4">
          <StatCard icon={CarFront} label="Completed rides" value={completedRides.length.toString()} trend={`${rides.length} total trips`} accent="cyan" />
          <StatCard icon={Wallet} label="Total spend" value={`Rs ${totalSpend}`} trend="Across all booked rides" accent="emerald" />
          <StatCard icon={Route} label="Live status" value={activeRide ? activeRide.status : 'Idle'} trend={activeRide ? 'Real-time socket updates enabled' : 'No active ride right now'} accent="violet" />
          <StatCard icon={Clock3} label="Latest ETA" value={estimate?.eta || (activeRide ? activeRide.status : 'Awaiting booking')} trend="Updated after booking" accent="amber" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[30px] border border-white/10 bg-white/8 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.28)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/75">Book ride</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">Request a live trip</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-cyan-200">
                <MapPin className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Pickup</span>
                <input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Enter pickup location" className="h-14 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Drop-off</span>
                <input value={dropoff} onChange={(event) => setDropoff(event.target.value)} placeholder="Enter drop-off location" className="h-14 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40" />
              </label>
              <button type="button" disabled={isBooking} onClick={handleBookRide} className="mt-2 inline-flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-5 text-sm font-semibold text-slate-950 shadow-[0_18px_50px_rgba(56,189,248,0.3)] transition hover:translate-y-[-1px] disabled:opacity-60">
                {isBooking ? 'Booking ride...' : 'Book ride'}
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ['Estimated fare', estimate?.fare || (activeRide ? activeRide.fareDisplay : 'Awaiting request')],
                ['Ride status', activeRide ? activeRide.status : 'Idle'],
                ['Vehicle tier', estimate?.vehicle || (activeRide?.vehicleType || 'car')],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-5">
            {activeRide ? (
              <RideCard ride={{ pickup: activeRide.pickup, dropoff: activeRide.dropoff, fare: activeRide.fareDisplay, time: formatRideTime(activeRide), status: activeRide.status, live: true }} statusTone="cyan" compact />
            ) : (
              <div className="rounded-[30px] border border-white/10 bg-white/8 p-8 text-center text-slate-400 backdrop-blur-2xl">
                No active ride. Book a trip to watch the live status flow here.
              </div>
            )}
            <MapView title="Live city map" subtitle="Ready for Google Maps integration with pickup pins, route lines, and driver ETA overlays." />
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative isolate min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="aurora-bg" />
      <div className="dashboard-grid-glow" />
      <div className="dashboard-orb left-[6%] top-[10%] h-48 w-48 bg-cyan-300/18" />
      <div className="dashboard-orb right-[8%] top-[24%] h-56 w-56 bg-indigo-400/16" />

      {toast ? <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100 shadow-[0_16px_45px_rgba(56,189,248,0.18)] backdrop-blur-2xl">{toast}</div> : null}

      <div className="relative mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row">
        <Sidebar roleLabel="Customer" items={sidebarItems} activeItem={activeItem} onSelect={setActiveItem} />
        <div className="flex-1 space-y-5">
          <Navbar title={`Welcome back, ${firstName}`} subtitle="Track rides, book premium trips, and manage your profile in a polished rider workspace." userName={displayName} userEmail={user?.email} onLogout={handleLogout} />
          {loading ? <div className="grid gap-5 xl:grid-cols-3">{[0,1,2].map((item) => <div key={item} className="h-40 animate-pulse rounded-[30px] border border-white/10 bg-white/8" />)}</div> : renderContent()}
        </div>
      </div>
    </motion.main>
  );
}
