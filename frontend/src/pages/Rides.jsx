import { useContext, useEffect, useMemo, useState } from 'react';
import { CalendarRange, CarFront, CircleDollarSign, Clock3, Filter, MapPinned, RotateCcw, Ruler, Trash2, UserRound } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import CustomerShell from '../components/dashboard/CustomerShell';
import SkeletonBlock from '../components/SkeletonBlock';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const PAGE_SIZE = 6;

const statusOptions = [
  ['all', 'All statuses'],
  ['requested', 'Requested'],
  ['accepted', 'Accepted'],
  ['arriving', 'Arriving'],
  ['in_progress', 'In progress'],
  ['completed', 'Completed'],
  ['rejected', 'Rejected'],
  ['cancelled', 'Cancelled'],
];

const sortOptions = [
  ['createdAt-desc', 'Latest first'],
  ['createdAt-asc', 'Oldest first'],
  ['fare-asc', 'Price: Low to High'],
  ['fare-desc', 'Price: High to Low'],
  ['distance-asc', 'Distance: Low to High'],
  ['distance-desc', 'Distance: High to Low'],
];

const roleCopy = {
  customer: {
    title: 'Ride history',
    body: 'Review every trip in one place with server-powered sorting, richer filters, and clean pagination built for larger ride volumes.',
    empty: 'No rides match these filters.',
    countLabel: 'rides found',
    totalLabel: 'Total spend',
  },
  driver: {
    title: 'Assigned rides',
    body: 'Track completed, active, and cancelled trips with backend-optimized filters for fare, distance, and dates.',
    empty: 'No driver rides match these filters.',
    countLabel: 'driver rides found',
    totalLabel: 'Total earnings',
  },
  admin: {
    title: 'Platform rides',
    body: 'Inspect the full marketplace ride ledger with the same premium layout and shared filtering controls used across the app.',
    empty: 'No platform rides match these filters.',
    countLabel: 'platform rides found',
    totalLabel: 'Total fare',
  },
};

const initialFilters = {
  status: 'all',
  sort: 'createdAt-desc',
  fromDate: '',
  toDate: '',
  minPrice: '',
  maxPrice: '',
  minDistance: '',
  maxDistance: '',
};

const parseSortValue = (value = 'createdAt-desc') => {
  const [sortBy = 'createdAt', order = 'desc'] = String(value || 'createdAt-desc').split('-');
  return {
    sortBy: ['createdAt', 'fare', 'distance'].includes(sortBy) ? sortBy : 'createdAt',
    order: order === 'asc' ? 'asc' : 'desc',
  };
};

const getRideDate = (ride) => {
  const source = ride?.createdAt || ride?.updatedAt;
  if (!source) return null;
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? null : date;
};

const filterRides = (rides, filters) => (rides || []).filter((ride) => {
  if (filters.status !== 'all' && ride.status !== filters.status) return false;

  const rideDate = getRideDate(ride);
  if (filters.fromDate && rideDate && rideDate < new Date(filters.fromDate)) return false;
  if (filters.toDate && rideDate && rideDate > new Date(`${filters.toDate}T23:59:59.999Z`)) return false;

  const fare = Number(ride?.fare || 0);
  if (filters.minPrice && fare < Number(filters.minPrice)) return false;
  if (filters.maxPrice && fare > Number(filters.maxPrice)) return false;

  const distance = Number(ride?.distance || 0);
  if (filters.minDistance && distance < Number(filters.minDistance)) return false;
  if (filters.maxDistance && distance > Number(filters.maxDistance)) return false;

  return true;
});

const mapAdminRide = (ride) => ({
  id: ride?._id,
  pickup: ride?.pickup?.address || ride?.pickup || 'Pickup unavailable',
  dropoff: ride?.destination?.address || ride?.dropoff || 'Drop-off unavailable',
  status: ride?.status || 'requested',
  fare: ride?.fare?.actualFare || ride?.fare?.estimatedFare || 0,
  fareDisplay: `Rs ${Math.round(ride?.fare?.actualFare || ride?.fare?.estimatedFare || 0)}`,
  distance: ride?.distance || 0,
  distanceDisplay: ride?.distance ? `${Number(ride.distance).toFixed(1)} km` : 'Distance pending',
  paymentMethod: ride?.payment?.method || 'cash',
  createdAt: ride?.createdAt,
  updatedAt: ride?.updatedAt,
  customer: ride?.user
    ? {
        name: `${ride.user.fullname?.firstname || ''} ${ride.user.fullname?.lastname || ''}`.trim(),
      }
    : null,
  driver: ride?.driver
    ? {
        name: `${ride.driver.fullname?.firstname || ''} ${ride.driver.fullname?.lastname || ''}`.trim(),
        vehicle: ride.driver.vehicle
          ? `${ride.driver.vehicle.color || ''} ${ride.driver.vehicle.model || ride.driver.vehicle.vehicleType || ''}`.trim()
          : null,
      }
    : null,
});

export default function Rides() {
  const { user } = useContext(AuthContext);
  const role = user?.role || 'customer';
  const copy = roleCopy[role] || roleCopy.customer;
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('info');
  const [rides, setRides] = useState([]);
  const [summary, setSummary] = useState({ totalRides: 0, avgFare: 0, totalFare: 0, avgDistance: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: PAGE_SIZE });
  const [filters, setFilters] = useState(initialFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [busyRideId, setBusyRideId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { sortBy, order } = useMemo(() => parseSortValue(filters.sort), [filters.sort]);
  const showSkeleton = isLoading && !(rides || []).length;
  const canResetFilters = useMemo(
    () => pagination.page !== 1 || Object.entries(initialFilters).some(([key, value]) => filters[key] !== value),
    [filters, pagination.page],
  );

  useEffect(() => {
    const abortController = new AbortController();
    let mounted = true;

    const load = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);

        if (role === 'admin') {
          const response = await apiFetch('/admin/rides', { signal: abortController.signal });
          const adminRides = filterRides((response.data || []).map(mapAdminRide), filters);
          const pages = Math.max(Math.ceil(adminRides.length / PAGE_SIZE), 1);
          const currentPage = Math.min(pagination.page, pages);
          const start = (currentPage - 1) * PAGE_SIZE;

          if (mounted) {
            setRides(adminRides.slice(start, start + PAGE_SIZE));
            setPagination({
              page: currentPage,
              pages,
              total: adminRides.length,
              limit: PAGE_SIZE,
            });
            setSummary({
              totalRides: adminRides.length,
              avgFare: Math.round(adminRides.reduce((sum, ride) => sum + Number(ride?.fare || 0), 0) / Math.max(adminRides.length, 1)),
              totalFare: Math.round(adminRides.reduce((sum, ride) => sum + Number(ride?.fare || 0), 0)),
              avgDistance: Number((adminRides.reduce((sum, ride) => sum + Number(ride?.distance || 0), 0) / Math.max(adminRides.length, 1)).toFixed(1)),
            });
          }
          return;
        }

        const query = new URLSearchParams({
          page: String(pagination.page),
          limit: String(pagination.limit || PAGE_SIZE),
          sortBy,
          order,
        });
        if (filters.status !== 'all') query.set('status', filters.status);
        if (filters.fromDate) query.set('fromDate', filters.fromDate);
        if (filters.toDate) query.set('toDate', filters.toDate);
        if (filters.minPrice) query.set('minPrice', filters.minPrice);
        if (filters.maxPrice) query.set('maxPrice', filters.maxPrice);
        if (filters.minDistance) query.set('minDistance', filters.minDistance);
        if (filters.maxDistance) query.set('maxDistance', filters.maxDistance);

        const endpoint = role === 'driver'
          ? `/rides/driver/${user.id}?${query.toString()}`
          : `/rides/user/${user.id}?${query.toString()}`;
        const response = await apiFetch(endpoint, { signal: abortController.signal });
        const payload = response.data || {};

        if (mounted) {
          setRides(role === 'driver' ? payload.assignedRides || [] : payload.rides || []);
          setSummary(payload.summary || { totalRides: 0, avgFare: 0, totalFare: 0, avgDistance: 0 });
          setPagination((current) => ({
            ...current,
            ...(payload.pagination || current),
          }));
        }
      } catch (error) {
        if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
          return;
        }

        if (mounted) {
          setToastType('error');
          setToast(error?.message || 'Unable to load rides.');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [
    filters.status,
    filters.fromDate,
    filters.toDate,
    filters.minPrice,
    filters.maxPrice,
    filters.minDistance,
    filters.maxDistance,
    order,
    pagination.limit,
    pagination.page,
    refreshKey,
    role,
    sortBy,
    user?.id,
  ]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPagination((current) => (current.page === 1 ? current : { ...current, page: 1 }));
  };

  const handleSortChange = (value) => {
    setFilters((current) => ({ ...current, sort: value }));
    setPagination((current) => (current.page === 1 ? current : { ...current, page: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({ ...initialFilters });
    setPagination((current) => (current.page === 1 ? current : { ...current, page: 1 }));
  };

  const handleCancelRide = async (rideId) => {
    setBusyRideId(rideId);
    try {
      await apiFetch(`/rides/${rideId}`, { method: 'DELETE' });
      setToastType('success');
      setToast('Ride cancelled successfully.');
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setToastType('error');
      setToast(error?.message || 'Unable to cancel ride.');
    } finally {
      setBusyRideId('');
    }
  };

  const summaryCards = [
    { label: 'Total rides', value: summary?.totalRides || 0, icon: Filter },
    { label: 'Average fare', value: `Rs ${summary?.avgFare || 0}`, icon: CircleDollarSign },
    { label: copy.totalLabel, value: `Rs ${summary?.totalFare || 0}`, icon: CarFront },
    { label: 'Average distance', value: `${summary?.avgDistance || 0} km`, icon: Ruler },
  ];

  return (
    <CustomerShell toast={toast} toastType={toastType} onDismissToast={() => setToast('')}>
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="theme-panel theme-border rounded-[34px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="theme-accent text-[11px] font-semibold uppercase tracking-[0.34em]">Rides</p>
            <h1 className="theme-heading mt-3 text-3xl font-bold tracking-[-0.05em]">{copy.title}</h1>
            <p className="theme-copy mt-3 max-w-2xl text-sm leading-7">{copy.body}</p>
          </div>
          <div className="theme-soft-card inline-flex items-center gap-3 rounded-2xl px-4 py-3">
            <Filter className="theme-accent h-4 w-4" />
            <span className="theme-copy text-sm font-medium">{isLoading && rides.length ? 'Updating results...' : `${pagination.total} ${copy.countLabel}`}</span>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="theme-soft-card rounded-[24px] p-4">
              <div className="flex items-center gap-2">
                <Icon className="theme-accent h-4 w-4" />
                <p className="theme-label text-xs uppercase tracking-[0.22em]">{label}</p>
              </div>
              <p className="theme-heading mt-3 text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleResetFilters}
            disabled={!canResetFilters}
            className="theme-secondary-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold disabled:opacity-60 sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            Reset filters
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Status</span>
            <select value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none">
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Sort</span>
            <select value={filters.sort} onChange={(event) => handleSortChange(event.target.value)} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none">
              {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">From date</span>
            <input type="date" value={filters.fromDate} onChange={(event) => handleFilterChange('fromDate', event.target.value)} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">To date</span>
            <input type="date" value={filters.toDate} onChange={(event) => handleFilterChange('toDate', event.target.value)} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Min price</span>
            <input type="number" min="0" value={filters.minPrice} onChange={(event) => handleFilterChange('minPrice', event.target.value)} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none" placeholder="0" />
          </label>
          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Max price</span>
            <input type="number" min="0" value={filters.maxPrice} onChange={(event) => handleFilterChange('maxPrice', event.target.value)} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none" placeholder="5000" />
          </label>
          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Min distance</span>
            <input type="number" min="0" step="0.1" value={filters.minDistance} onChange={(event) => handleFilterChange('minDistance', event.target.value)} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none" placeholder="0 km" />
          </label>
          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Max distance</span>
            <input type="number" min="0" step="0.1" value={filters.maxDistance} onChange={(event) => handleFilterChange('maxDistance', event.target.value)} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none" placeholder="50 km" />
          </label>
        </div>

        <AnimatePresence mode="wait">
          {showSkeleton ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 grid gap-4 xl:grid-cols-2">
              {[0, 1, 2, 3].map((item) => <SkeletonBlock key={item} className="h-64" />)}
            </motion.div>
          ) : (rides || []).length ? (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: isLoading ? 0.72 : 1 }} className="mt-8 grid gap-4 xl:grid-cols-2">
              {(rides || []).map((ride, index) => {
                const rideDate = getRideDate(ride);

                return (
                  <motion.article key={ride?.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} whileHover={{ y: -4, scale: 1.01 }} className="theme-soft-card rounded-[28px] p-5">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="theme-label text-xs uppercase tracking-[0.22em]">Trip route</p>
                        <p className="theme-heading mt-2 break-words text-lg font-bold">{ride?.pickup || 'Pickup unavailable'}</p>
                        <p className="theme-copy mt-1 break-words text-sm">to {ride?.dropoff || 'Drop-off unavailable'}</p>
                      </div>
                      <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100">
                        {(ride?.status || 'unknown').replaceAll('_', ' ')}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="theme-subtle rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                          <CircleDollarSign className="theme-accent h-4 w-4" />
                          <p className="theme-label text-xs uppercase tracking-[0.22em]">Fare</p>
                        </div>
                        <p className="theme-heading mt-2 text-base font-semibold">{ride?.fareDisplay || 'Rs 0'}</p>
                      </div>
                      <div className="theme-subtle rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                          <MapPinned className="theme-accent h-4 w-4" />
                          <p className="theme-label text-xs uppercase tracking-[0.22em]">Distance</p>
                        </div>
                        <p className="theme-heading mt-2 text-base font-semibold">{ride?.distanceDisplay || 'Distance pending'}</p>
                      </div>
                      <div className="theme-subtle rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                          <Clock3 className="theme-accent h-4 w-4" />
                          <p className="theme-label text-xs uppercase tracking-[0.22em]">Created</p>
                        </div>
                        <p className="theme-heading mt-2 text-base font-semibold">{rideDate ? rideDate.toLocaleString() : 'Date unavailable'}</p>
                      </div>
                      <div className="theme-subtle rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                          {role === 'admin' ? <UserRound className="theme-accent h-4 w-4" /> : <CarFront className="theme-accent h-4 w-4" />}
                          <p className="theme-label text-xs uppercase tracking-[0.22em]">{role === 'admin' ? 'Customer' : 'Driver'}</p>
                        </div>
                        <p className="theme-heading mt-2 break-words text-base font-semibold">{role === 'admin' ? (ride?.customer?.name || 'Unknown rider') : (ride?.driver?.name || 'Awaiting assignment')}</p>
                        <p className="theme-copy mt-1 break-words text-sm">{role === 'admin' ? (ride?.driver?.name ? `Driver: ${ride.driver.name}` : 'Driver pending') : (ride?.driver?.vehicle || 'Vehicle details will appear after acceptance')}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="theme-copy flex items-center gap-2 text-sm">
                        <CalendarRange className="h-4 w-4" />
                        <span>{ride?.paymentMethod?.toUpperCase() || 'CASH'} payment</span>
                      </div>
                      {role === 'customer' && ride?.status === 'requested' ? (
                        <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => handleCancelRide(ride?.id)} disabled={busyRideId === ride?.id} className="theme-secondary-button inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-rose-600">
                          <Trash2 className="h-4 w-4" />
                          {busyRideId === ride?.id ? 'Cancelling...' : 'Cancel ride'}
                        </motion.button>
                      ) : null}
                    </div>
                  </div>
                  </motion.article>
                );
              })}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="theme-soft-card mt-8 rounded-[28px] p-8 text-center">
              <p className="theme-heading text-lg font-semibold">{copy.empty}</p>
              <p className="theme-copy mt-2 text-sm">Try widening the date range or adjusting fare and distance filters.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="theme-copy text-sm">Page {pagination.page} of {pagination.pages}</p>
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => setPagination((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))} disabled={pagination.page <= 1} className="theme-secondary-button inline-flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-semibold disabled:opacity-50">
              Previous
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.page + 1, current.pages) }))} disabled={pagination.page >= pagination.pages} className="theme-primary-button inline-flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-semibold disabled:opacity-50">
              Next
            </motion.button>
          </div>
        </div>
      </motion.section>
    </CustomerShell>
  );
}
