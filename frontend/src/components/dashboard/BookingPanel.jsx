import { motion } from 'framer-motion';
import { CalendarClock, CarFront, Clock3, MapPin, Navigation2 } from 'lucide-react';

const vehicleIcons = {
  mini: CarFront,
  sedan: Navigation2,
  suv: CarFront,
};

export default function BookingPanel({
  booking,
  onChange,
  onSelectVehicle,
  onSubmit,
  vehicles,
  selectedVehicle,
  isSubmitting,
  distance,
  farePreview,
  isCalculatingFare,
  isResolvingLocations,
  locationError,
  canSubmit,
}) {
  return (
    <section className="glass-shimmer theme-panel-premium theme-border relative overflow-hidden rounded-[34px] p-7">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_38%,transparent_72%,rgba(56,189,248,0.08))]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="theme-kicker">Ride booking</p>
            <h2 className="theme-display mt-4 text-3xl sm:text-4xl">Book your next trip</h2>
            <p className="theme-copy mt-4 max-w-2xl text-sm leading-7 sm:text-[15px]">
              Pick a start and destination, choose whether the ride is now or scheduled, then confirm a vehicle tier.
            </p>
          </div>
          <div className="theme-subtle hidden h-14 w-14 items-center justify-center rounded-[22px] text-blue-600 shadow-lg dark:text-cyan-200 sm:flex">
            <MapPin className="h-5 w-5" />
          </div>
        </div>

        <div className="theme-divider mt-8" />

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Starting location</span>
            <div className="relative">
              <MapPin className="theme-label pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" />
              <input
                value={booking.pickup}
                onChange={(event) => onChange('pickup', event.target.value)}
                placeholder="Tap map or type pickup"
                className="theme-input h-16 w-full rounded-[22px] pl-12 pr-4 text-sm outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Destination</span>
            <div className="relative">
              <Navigation2 className="theme-label pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" />
              <input
                value={booking.dropoff}
                onChange={(event) => onChange('dropoff', event.target.value)}
                placeholder="Tap map or type destination"
                className="theme-input h-16 w-full rounded-[22px] pl-12 pr-4 text-sm outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Time</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onChange('timing', 'now')}
                className={`flex h-16 items-center justify-center gap-2 rounded-[22px] border text-sm font-semibold transition duration-200 ${booking.timing === 'now' ? 'theme-selected-card scale-[1.02]' : 'theme-secondary-button hover:bg-blue-50 hover:scale-[1.02] dark:hover:bg-cyan-950/40'}`}
              >
                <Clock3 className="h-4 w-4" />
                Now
              </button>
              <button
                type="button"
                onClick={() => onChange('timing', 'schedule')}
                className={`flex h-16 items-center justify-center gap-2 rounded-[22px] border text-sm font-semibold transition duration-200 ${booking.timing === 'schedule' ? 'theme-selected-card scale-[1.02]' : 'theme-secondary-button hover:bg-blue-50 hover:scale-[1.02] dark:hover:bg-cyan-950/40'}`}
              >
                <CalendarClock className="h-4 w-4" />
                Schedule
              </button>
            </div>
          </label>
        </div>

        {isResolvingLocations ? (
          <p className="theme-copy mt-4 text-sm">Locating typed addresses on the map...</p>
        ) : null}

        {locationError ? (
          <p className="mt-3 text-sm font-medium text-rose-400">{locationError}</p>
        ) : null}

        {booking.timing === 'schedule' ? (
          <div className="mt-4">
            <label className="block">
              <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Scheduled time</span>
              <input
                type="datetime-local"
                value={booking.scheduledAt}
                onChange={(event) => onChange('scheduledAt', event.target.value)}
                className="theme-input h-16 w-full rounded-[22px] px-4 text-sm outline-none"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-8">
          <p className="theme-label text-[11px] font-semibold uppercase tracking-[0.32em]">Vehicle options</p>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {vehicles.map((vehicle) => {
              const Icon = vehicleIcons[vehicle.id] || CarFront;
              const active = selectedVehicle === vehicle.id;

              return (
                <motion.button
                  key={vehicle.id}
                  type="button"
                  onClick={() => onSelectVehicle(vehicle.id)}
                  whileHover={{ y: -3, scale: active ? 1.05 : 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className={`theme-hover-card text-left rounded-[26px] p-5 transition duration-200 ${active ? 'theme-selected-card ring-2 ring-blue-400/70 dark:ring-cyan-300/50' : 'theme-unselected-card hover:bg-blue-50 dark:hover:bg-cyan-950/30'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${active ? 'border-white/30 bg-white/15 text-white shadow-md dark:border-cyan-200/30 dark:bg-white/10 dark:text-white' : 'border-gray-200 bg-white text-gray-400 dark:border-white/10 dark:bg-white/6 dark:text-slate-300'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`text-xs uppercase tracking-[0.24em] ${active ? 'text-blue-100 dark:text-cyan-100' : 'theme-label'}`}>{vehicle.eta}</span>
                  </div>
                  <p className={`mt-4 text-xl font-bold ${active ? 'text-white' : 'theme-heading'}`}>{vehicle.label}</p>
                  <p className={`mt-1 text-sm ${active ? 'text-blue-50/90 dark:text-cyan-50/90' : 'theme-copy'}`}>{vehicle.description}</p>
                  <div className="mt-5 flex items-center justify-between text-sm">
                    <motion.span
                      key={`${vehicle.id}-${farePreview?.[vehicle.id] ?? 'empty'}-${distance ?? 'no-distance'}-${isCalculatingFare ? 'loading' : 'ready'}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`font-medium ${active ? 'text-white' : 'theme-copy'}`}
                    >
                      {distance
                        ? `Rs ${farePreview?.[vehicle.id] || 0}`
                        : isCalculatingFare
                          ? 'Calculating...'
                          : 'Enter location to see price'}
                    </motion.span>
                    <span className={`font-semibold ${active ? 'text-white' : 'theme-heading'}`}>{active ? 'Selected' : 'Choose'}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="theme-divider mt-8" />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="theme-copy text-sm">Pickup and drop can be set from the map or manually from the form.</p>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !canSubmit}
            className="theme-primary-button inline-flex h-14 items-center justify-center rounded-2xl px-6 text-sm font-semibold transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {isSubmitting ? 'Creating ride...' : isResolvingLocations ? 'Resolving locations...' : 'Book ride'}
          </button>
        </div>
      </div>
    </section>
  );
}
