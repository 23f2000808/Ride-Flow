import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CarFront, Clock3, DollarSign, MapPin, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BookingPanel from '../components/dashboard/BookingPanel';
import CustomerShell from '../components/dashboard/CustomerShell';
import MapView from '../components/dashboard/MapView';
import SkeletonBlock from '../components/SkeletonBlock';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { apiFetch } from '../utils/api';

const vehicleOptions = [
  { id: 'mini', label: 'Mini', eta: '3 min', description: 'Compact city ride for everyday trips.' },
  { id: 'sedan', label: 'Sedan', eta: '4 min', description: 'Balanced comfort with premium cabin space.' },
  { id: 'suv', label: 'SUV', eta: '6 min', description: 'Extra room for groups, luggage, and longer rides.' },
];

const rideStatusClass = (status = 'requested') => ({
  requested: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100',
  accepted: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100',
  arriving: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100',
  in_progress: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-300/20 dark:bg-indigo-300/10 dark:text-indigo-100',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-100',
  rejected: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-100',
}[status] || 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100');

const reverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    const data = await response.json();
    return data?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

const geocodeLocation = async (query) => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return null;

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmedQuery)}&format=json`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error('Unable to fetch location coordinates.');
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return {
    lat: Number.parseFloat(data[0].lat),
    lng: Number.parseFloat(data[0].lon),
    label: data[0].display_name,
  };
};

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [isLoadingRide, setIsLoadingRide] = useState(true);
  const [recentRides, setRecentRides] = useState([]);
  const [rideSummary, setRideSummary] = useState({
    totalRides: 0,
    totalFare: 0,
    avgDistance: 0,
  });
  const [booking, setBooking] = useState({
    pickup: '',
    dropoff: '',
    timing: 'now',
    scheduledAt: '',
  });
  const [selectedVehicle, setSelectedVehicle] = useState('mini');
  const [pickupPoint, setPickupPoint] = useState(null);
  const [dropoffPoint, setDropoffPoint] = useState(null);
  const [distance, setDistance] = useState(null);
  const [farePreview, setFarePreview] = useState({});
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);
  const [isResolvingLocations, setIsResolvingLocations] = useState(false);
  const [locationError, setLocationError] = useState('');
  const bookingSectionRef = useRef(null);
  const geocodeTimersRef = useRef({ pickup: null, dropoff: null });
  const geocodeRequestRef = useRef({ pickup: 0, dropoff: 0 });
  const lastResolvedQueryRef = useRef({ pickup: '', dropoff: '' });

  const showToast = (message) => {
    setToast(message);
  };

  useEffect(() => {
    let mounted = true;
    const loadRides = async () => {
      if (!user?.id) return;
      try {
        const response = await apiFetch(`/rides/user/${user.id}?page=1&limit=4&sortBy=createdAt&order=desc`);
        if (!mounted) return;
        setActiveRide(response.data?.activeRide || null);
        setRecentRides(response.data?.rides || []);
        setRideSummary({
          totalRides: response.data?.summary?.totalRides || response.data?.totalRides || 0,
          totalFare: response.data?.summary?.totalFare || 0,
          avgDistance: response.data?.summary?.avgDistance || 0,
        });
      } catch (error) {
        console.error(error);
        if (mounted) showToast('Unable to load active ride.');
      } finally {
        if (mounted) setIsLoadingRide(false);
      }
    };
    loadRides();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!socket || !user?.id) return undefined;

    const syncRide = ({ ride }) => {
      if (ride?.customerId === user.id) {
        setActiveRide(['completed', 'cancelled'].includes(ride.status) ? null : ride);
        setRecentRides((current) => {
          const existing = (current || []).filter((item) => item?.id !== ride?.id);
          return [ride, ...existing].slice(0, 4);
        });
      }
    };

    socket.on('ride:requested', syncRide);
    socket.on('ride:accepted', syncRide);
    socket.on('ride:status', syncRide);

    return () => {
      socket.off('ride:requested', syncRide);
      socket.off('ride:accepted', syncRide);
      socket.off('ride:status', syncRide);
    };
  }, [socket, user?.id]);

  const routeMeta = useMemo(() => {
    if (!distance) return '';
    return `${Number(distance).toFixed(1)} km estimated route`;
  }, [distance]);

  const calculatedFare = useMemo(() => {
    const preview = Number(farePreview?.[selectedVehicle]);
    return Number.isFinite(preview) ? preview : null;
  }, [farePreview, selectedVehicle]);

  const canSubmitBooking = Boolean(
    pickupPoint
    && dropoffPoint
    && selectedVehicle
    && calculatedFare !== null
    && !isResolvingLocations
    && !isCalculatingFare,
  );

  const mapCreateRideResponse = (ride) => ({
    id: ride._id,
    customerId: ride.user,
    driverId: ride.driver || null,
    pickup: ride.pickup?.address,
    dropoff: ride.destination?.address,
    status: ride.status,
    fare: ride.fare?.actualFare || ride.fare?.estimatedFare || 0,
    fareDisplay: `Rs ${Math.round(ride.fare?.actualFare || ride.fare?.estimatedFare || 0)}`,
    vehicleType: ride.vehicleType,
    distance: ride.distance || 0,
    distanceDisplay: ride.distance ? `${Number(ride.distance).toFixed(1)} km` : 'Distance pending',
    paymentMethod: ride.payment?.method || 'cash',
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
    acceptedAt: ride.acceptedAt,
    startedAt: ride.startedAt,
    completedAt: ride.completedAt,
  });

  useEffect(() => {
    let active = true;

    const loadFarePreview = async () => {
      if (!pickupPoint || !dropoffPoint || !user?.id) {
        setDistance(null);
        setFarePreview({});
        return;
      }

      setIsCalculatingFare(true);
      try {
        const response = await apiFetch('/rides/calculate-fare', {
          method: 'POST',
          body: JSON.stringify({
            pickupCoords: [pickupPoint.lng, pickupPoint.lat],
            dropoffCoords: [dropoffPoint.lng, dropoffPoint.lat],
          }),
        });

        if (!active) return;

        setDistance(response.data?.distance || null);
        setFarePreview(response.data?.fares || {});
      } catch (error) {
        console.error(error);
        if (active) {
          setDistance(null);
          setFarePreview({});
          showToast('Unable to calculate fare preview.');
        }
      } finally {
        if (active) {
          setIsCalculatingFare(false);
        }
      }
    };

    loadFarePreview();

    return () => {
      active = false;
    };
  }, [dropoffPoint, pickupPoint, user?.id]);

  const lastRide = recentRides?.[0] || activeRide || null;
  const summaryCards = useMemo(() => [
    {
      label: 'Total rides',
      value: String(rideSummary.totalRides || 0),
      helper: 'Trips booked from your account',
      icon: CarFront,
    },
    {
      label: 'Total spend',
      value: `Rs ${Math.round(rideSummary.totalFare || 0)}`,
      helper: 'Lifetime ride spend so far',
      icon: DollarSign,
    },
    {
      label: 'Avg distance',
      value: `${Number(rideSummary.avgDistance || 0).toFixed(1)} km`,
      helper: 'Average trip length',
      icon: MapPin,
    },
    {
      label: 'Last ride',
      value: lastRide?.status ? lastRide.status.replace('_', ' ') : 'No rides yet',
      helper: lastRide?.dropoff || 'Book your next trip to see updates here',
      icon: Clock3,
    },
  ], [lastRide, rideSummary]);

  const scrollToBooking = () => {
    bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleBookingChange = (field, value) => {
    if (field === 'pickup' || field === 'dropoff') {
      setLocationError('');
      lastResolvedQueryRef.current[field] = '';
      if (!value.trim()) {
        if (field === 'pickup') {
          setPickupPoint(null);
          setDropoffPoint(null);
        } else {
          setDropoffPoint(null);
        }
      }
    }

    setBooking((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    const syncTypedLocation = (field, value, setPoint, clearDependentPoint = false) => {
      if (geocodeTimersRef.current[field]) {
        window.clearTimeout(geocodeTimersRef.current[field]);
      }

      if (!value.trim()) {
        setIsResolvingLocations(false);
        return;
      }

      geocodeTimersRef.current[field] = window.setTimeout(async () => {
        const normalizedValue = value.trim();
        if (lastResolvedQueryRef.current[field] === normalizedValue) {
          return;
        }

        const requestId = geocodeRequestRef.current[field] + 1;
        geocodeRequestRef.current[field] = requestId;
        setIsResolvingLocations(true);

        try {
          const coords = await geocodeLocation(normalizedValue);

          if (geocodeRequestRef.current[field] !== requestId) {
            return;
          }

          if (!coords) {
            setLocationError(`${field === 'pickup' ? 'Pickup' : 'Destination'} location not found.`);
            setPoint(null);
            if (clearDependentPoint) {
              setDropoffPoint(null);
            }
            return;
          }

          lastResolvedQueryRef.current[field] = normalizedValue;
          setLocationError('');
          setPoint({ lat: coords.lat, lng: coords.lng });
          if (field === 'pickup' && clearDependentPoint && !booking.dropoff.trim()) {
            setDropoffPoint(null);
          }
        } catch (error) {
          if (geocodeRequestRef.current[field] !== requestId) {
            return;
          }
          console.error(error);
          setLocationError(`Unable to resolve ${field === 'pickup' ? 'pickup' : 'destination'} location.`);
          setPoint(null);
          if (clearDependentPoint) {
            setDropoffPoint(null);
          }
        } finally {
          if (geocodeRequestRef.current.pickup === requestId || geocodeRequestRef.current.dropoff === requestId) {
            const pickupPending = booking.pickup.trim() && lastResolvedQueryRef.current.pickup !== booking.pickup.trim();
            const dropoffPending = booking.dropoff.trim() && lastResolvedQueryRef.current.dropoff !== booking.dropoff.trim();
            setIsResolvingLocations(Boolean(pickupPending || dropoffPending));
          }
        }
      }, 500);
    };

    syncTypedLocation('pickup', booking.pickup, setPickupPoint, true);

    return () => {
      if (geocodeTimersRef.current.pickup) {
        window.clearTimeout(geocodeTimersRef.current.pickup);
      }
    };
  }, [booking.pickup, booking.dropoff]);

  useEffect(() => {
    const field = 'dropoff';

    if (geocodeTimersRef.current[field]) {
      window.clearTimeout(geocodeTimersRef.current[field]);
    }

    if (!booking.dropoff.trim()) {
      setIsResolvingLocations(false);
      return () => {};
    }

    geocodeTimersRef.current[field] = window.setTimeout(async () => {
      const normalizedValue = booking.dropoff.trim();
      if (lastResolvedQueryRef.current[field] === normalizedValue) {
        return;
      }

      const requestId = geocodeRequestRef.current[field] + 1;
      geocodeRequestRef.current[field] = requestId;
      setIsResolvingLocations(true);

      try {
        const coords = await geocodeLocation(normalizedValue);

        if (geocodeRequestRef.current[field] !== requestId) {
          return;
        }

        if (!coords) {
          setLocationError('Destination location not found.');
          setDropoffPoint(null);
          return;
        }

        lastResolvedQueryRef.current[field] = normalizedValue;
        setLocationError('');
        setDropoffPoint({ lat: coords.lat, lng: coords.lng });
      } catch (error) {
        if (geocodeRequestRef.current[field] !== requestId) {
          return;
        }
        console.error(error);
        setLocationError('Unable to resolve destination location.');
        setDropoffPoint(null);
      } finally {
        const pickupPending = booking.pickup.trim() && lastResolvedQueryRef.current.pickup !== booking.pickup.trim();
        const dropoffPending = booking.dropoff.trim() && lastResolvedQueryRef.current.dropoff !== booking.dropoff.trim();
        setIsResolvingLocations(Boolean(pickupPending || dropoffPending));
      }
    }, 500);

    return () => {
      if (geocodeTimersRef.current[field]) {
        window.clearTimeout(geocodeTimersRef.current[field]);
      }
    };
  }, [booking.dropoff, booking.pickup]);

  const handleMapSelect = async (latlng) => {
    const label = await reverseGeocode(latlng.lat, latlng.lng);
    setLocationError('');

    if (!pickupPoint || (pickupPoint && dropoffPoint)) {
      setPickupPoint(latlng);
      setDropoffPoint(null);
      lastResolvedQueryRef.current.pickup = label;
      lastResolvedQueryRef.current.dropoff = '';
      setBooking((current) => ({ ...current, pickup: label, dropoff: dropoffPoint ? '' : current.dropoff }));
      showToast('Pickup point selected.');
      return;
    }

    setDropoffPoint(latlng);
    lastResolvedQueryRef.current.dropoff = label;
    setBooking((current) => ({ ...current, dropoff: label }));
    showToast('Destination selected.');
  };

  const handleBookRide = async () => {
    if (!booking.pickup.trim() || !booking.dropoff.trim()) {
      showToast('Add pickup and destination before booking.');
      return;
    }

    if (isResolvingLocations) {
      showToast('Please wait while we locate your pickup and destination.');
      return;
    }

    if (!pickupPoint || !dropoffPoint) {
      showToast(locationError || 'Enter valid pickup and destination locations first.');
      return;
    }

    if (!selectedVehicle) {
      showToast('Select a vehicle before booking.');
      return;
    }

    if (calculatedFare === null) {
      showToast('Wait for fare calculation before booking.');
      return;
    }

    if (booking.timing === 'schedule' && !booking.scheduledAt) {
      showToast('Choose a scheduled time to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        userId: user.id,
        pickup: {
          address: booking.pickup.trim(),
          location: {
            type: 'Point',
            coordinates: [pickupPoint.lng, pickupPoint.lat],
          },
        },
        destination: {
          address: booking.dropoff.trim(),
          location: {
            type: 'Point',
            coordinates: [dropoffPoint.lng, dropoffPoint.lat],
          },
        },
        vehicleType: selectedVehicle,
        fare: {
          estimatedFare: calculatedFare,
        },
        paymentMethod: 'cash',
      };

      console.log('BOOKING PAYLOAD:', payload);

      const response = await apiFetch('/rides', {
        method: 'POST',
        headers: {
          'Idempotency-Key': `ride-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response?.success || !response?.data?.ride) {
        throw new Error(response?.message || 'Unable to create ride.');
      }
      const ride = response.data?.ride ? mapCreateRideResponse(response.data.ride) : response.data;
      setActiveRide(ride);
      setRecentRides((current) => [ride, ...(current || []).filter((item) => item?.id !== ride?.id)].slice(0, 4));
      setRideSummary((current) => ({
        ...current,
        totalRides: (current.totalRides || 0) + 1,
      }));
      if (socket) socket.emit('join_ride', ride.id);
      showToast('Ride created successfully.');
    } catch (error) {
      console.error('BOOKING ERROR:', error);
      showToast(error?.message || 'Unable to create ride.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CustomerShell toast={toast} toastType="info" onDismissToast={() => setToast(null)}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-1 py-2 sm:px-2 lg:px-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoadingRide
            ? Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-36 rounded-[28px]" />)
            : summaryCards.map((card, index) => (
              <motion.article
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.03, y: -3 }}
                className="rounded-[28px] border border-white/20 bg-white/10 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="theme-label text-[11px] uppercase tracking-[0.28em]">{card.label}</p>
                    <p className="theme-heading mt-3 text-3xl font-bold tracking-[-0.05em]">{card.value}</p>
                  </div>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-cyan-100 dark:bg-white/10">
                    <card.icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="theme-copy mt-4 text-sm leading-6">{card.helper}</p>
              </motion.article>
            ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div ref={bookingSectionRef} className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-[32px] border border-white/20 bg-white/10 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg"
            >
              <BookingPanel
                booking={booking}
                onChange={handleBookingChange}
                onSelectVehicle={setSelectedVehicle}
                onSubmit={handleBookRide}
                vehicles={vehicleOptions}
                selectedVehicle={selectedVehicle}
                isSubmitting={isSubmitting}
                distance={distance}
                farePreview={farePreview}
                isCalculatingFare={isCalculatingFare}
                isResolvingLocations={isResolvingLocations}
                locationError={locationError}
                canSubmit={canSubmitBooking}
              />
            </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg"
          >
            <div className="relative">
              <p className="theme-kicker">Live trip</p>
              <h3 className="theme-heading mt-4 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">Current ride status</h3>
              <p className="theme-copy mt-3 max-w-2xl text-sm leading-7">
                Keep the essentials in one place. The panel updates as your ride moves from request to pickup and beyond.
              </p>
            </div>

            {isLoadingRide ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                <SkeletonBlock className="h-24" />
                <SkeletonBlock className="h-24" />
                <SkeletonBlock className="h-24" />
              </div>
            ) : activeRide ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                <motion.div whileHover={{ y: -3 }} className="theme-soft-card rounded-2xl p-4">
                  <p className="theme-label text-xs uppercase tracking-[0.2em]">Pickup</p>
                  <p className="theme-heading mt-2 break-words text-sm font-semibold">{activeRide.pickup}</p>
                </motion.div>
                <motion.div whileHover={{ y: -3 }} className="theme-soft-card rounded-2xl p-4">
                  <p className="theme-label text-xs uppercase tracking-[0.2em]">Destination</p>
                  <p className="theme-heading mt-2 break-words text-sm font-semibold">{activeRide.dropoff}</p>
                </motion.div>
                <motion.div whileHover={{ y: -3 }} className="theme-soft-card rounded-2xl p-4">
                  <p className="theme-label text-xs uppercase tracking-[0.2em]">Status</p>
                  <p className="theme-heading mt-2 text-sm font-semibold capitalize">{activeRide.status}</p>
                </motion.div>
              </div>
            ) : (
              <div className="theme-soft-card mt-7 rounded-2xl p-5">
                <p className="theme-copy text-sm leading-7">No active ride yet. Create a trip from the booking panel to start tracking live status here.</p>
              </div>
            )}
          </motion.section>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-[32px] border border-white/20 bg-white/10 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg"
          >
            <MapView
              pickupPoint={pickupPoint}
              dropoffPoint={dropoffPoint}
              onSelectPoint={handleMapSelect}
              routeMeta={routeMeta}
              summary={{ pickup: booking.pickup, dropoff: booking.dropoff }}
              isResolvingLocations={isResolvingLocations}
              locationError={locationError}
            />
          </motion.div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="theme-kicker">Recent rides</p>
                <h3 className="theme-heading mt-3 text-2xl font-bold tracking-[-0.04em]">Your latest activity</h3>
                <p className="theme-copy mt-2 text-sm leading-7">A cleaner snapshot of recent trips without overwhelming the dashboard.</p>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/dashboard/customer/rides')}
                className="theme-secondary-button rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                View all rides
              </motion.button>
            </div>

            <div className="mt-6 space-y-3">
              <AnimatePresence mode="popLayout">
                {isLoadingRide
                  ? Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-24 rounded-[22px]" />)
                  : recentRides.length
                    ? recentRides.map((ride, index) => (
                      <motion.div
                        key={ride?.id || index}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ y: -5 }}
                        className="flex flex-col gap-4 rounded-[24px] border border-white/15 bg-white/10 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-2">
                          <p className="theme-heading text-base font-semibold">{ride?.pickup || 'Pickup pending'}</p>
                          <p className="theme-copy text-sm">{ride?.dropoff || 'Destination pending'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className={`rounded-full border px-3 py-1 font-semibold capitalize ${rideStatusClass(ride?.status || 'requested')}`}>
                            {(ride?.status || 'requested').replace('_', ' ')}
                          </span>
                          <span className="theme-copy">{ride?.fareDisplay || 'Rs 0'}</span>
                        </div>
                      </motion.div>
                    ))
                    : (
                      <div className="rounded-[24px] border border-white/15 bg-white/10 p-6">
                        <p className="theme-copy text-sm leading-7">Your booked rides will appear here once you start using RideFlow for daily trips.</p>
                      </div>
                    )}
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="rounded-[30px] border border-white/20 bg-white/10 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-lg"
          >
            <p className="theme-kicker">Shortcuts</p>
            <h3 className="theme-heading mt-3 text-2xl font-bold tracking-[-0.04em]">Move faster</h3>
            <p className="theme-copy mt-2 text-sm leading-7">Quick entry points to the actions customers reach for most often.</p>

            <div className="mt-6 grid gap-4">
              {[
                {
                  title: 'Plan your next ride',
                  body: 'Jump back to the booking flow and lock in pickup and drop-off in seconds.',
                  action: scrollToBooking,
                },
                {
                  title: 'Review trip history',
                  body: 'Open the rides page for full history, filters, and ride-by-ride details.',
                  action: () => navigate('/dashboard/customer/rides'),
                },
                {
                  title: 'Explore spending insights',
                  body: 'See trends, peak usage, and favorite routes inside analytics.',
                  action: () => navigate('/dashboard/customer/analytics'),
                },
              ].map((item, index) => (
                <motion.button
                  key={item.title}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={item.action}
                  className="rounded-[24px] border border-white/15 bg-white/10 p-5 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-100 dark:text-cyan-200">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="theme-heading text-base font-semibold">{item.title}</p>
                      <p className="theme-copy mt-2 text-sm leading-6">{item.body}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </section>
      </div>
    </CustomerShell>
  );
}
