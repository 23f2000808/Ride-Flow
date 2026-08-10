import { useContext, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { MapPinned } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { ThemeContext } from '../../context/ThemeContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function ClickHandler({ onSelectPoint }) {
  useMapEvents({
    click(event) {
      onSelectPoint(event.latlng);
    },
  });

  return null;
}

function ChangeView({ pickupPoint, dropoffPoint, center }) {
  const map = useMap();

  useEffect(() => {
    if (pickupPoint && dropoffPoint) {
      map.fitBounds(
        [
          [pickupPoint.lat, pickupPoint.lng],
          [dropoffPoint.lat, dropoffPoint.lng],
        ],
        { padding: [50, 50] },
      );
      return;
    }

    if (pickupPoint) {
      map.setView([pickupPoint.lat, pickupPoint.lng], 13);
      return;
    }

    if (dropoffPoint) {
      map.setView([dropoffPoint.lat, dropoffPoint.lng], 13);
      return;
    }

    map.setView(center, 13);
  }, [center, dropoffPoint, map, pickupPoint]);

  return null;
}

const defaultCenter = [12.9716, 77.5946];

export default function MapView({
  pickupPoint = null,
  dropoffPoint = null,
  onSelectPoint,
  routeMeta = '',
  summary = {},
  title = 'Live map',
  subtitle = 'Select ride points on the map',
  isResolvingLocations = false,
  locationError = '',
}) {
  const { isDark } = useContext(ThemeContext);
  const [routePath, setRoutePath] = useState([]);

  const center = useMemo(() => {
    if (pickupPoint) return [pickupPoint.lat, pickupPoint.lng];
    return defaultCenter;
  }, [pickupPoint]);

  const tileConfig = useMemo(() => (
    isDark
      ? {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        }
      : {
          attribution: '&copy; OpenStreetMap contributors',
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        }
  ), [isDark]);

  useEffect(() => {
    let ignore = false;

    const fetchRoute = async () => {
      if (!pickupPoint || !dropoffPoint) {
        setRoutePath([]);
        return;
      }

      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${pickupPoint.lng},${pickupPoint.lat};${dropoffPoint.lng},${dropoffPoint.lat}?overview=full&geometries=geojson`);
        const data = await response.json();
        const coordinates = data?.routes?.[0]?.geometry?.coordinates || [];
        if (!ignore) {
          setRoutePath(coordinates.map((coord) => [coord[1], coord[0]]));
        }
      } catch {
        if (!ignore) {
          setRoutePath([
            [pickupPoint.lat, pickupPoint.lng],
            [dropoffPoint.lat, dropoffPoint.lng],
          ]);
        }
      }
    };

    fetchRoute();
    return () => {
      ignore = true;
    };
  }, [pickupPoint, dropoffPoint]);

  return (
    <motion.section whileHover={{ y: -4, scale: 1.01 }} className="glass-shimmer theme-panel theme-border theme-hover-card relative overflow-hidden rounded-[34px] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_30%)]" />
      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-4 px-2 pt-2">
          <div>
            <p className="theme-accent text-[11px] font-semibold uppercase tracking-[0.34em]">Live map</p>
            <h3 className="theme-heading mt-2 text-2xl font-bold tracking-[-0.04em]">{title}</h3>
            <p className="theme-copy mt-2 text-sm leading-6">{subtitle}</p>
          </div>
          <div className="theme-subtle flex h-12 w-12 items-center justify-center rounded-[18px] text-blue-600 dark:text-cyan-200">
            <MapPinned className="h-5 w-5" />
          </div>
        </div>

        <div className="theme-map-frame overflow-hidden rounded-[28px]">
          <div className="relative h-[420px] w-full">
            {isResolvingLocations ? (
              <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-white/70 text-slate-900 backdrop-blur-sm dark:bg-slate-950/60 dark:text-white">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-current border-t-transparent" />
                <p className="mt-4 text-sm font-semibold">Updating map from typed location...</p>
              </div>
            ) : null}
            <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
              <TileLayer attribution={tileConfig.attribution} url={tileConfig.url} />
              <ChangeView pickupPoint={pickupPoint} dropoffPoint={dropoffPoint} center={center} />
              {onSelectPoint ? <ClickHandler onSelectPoint={onSelectPoint} /> : null}
              {pickupPoint ? <Marker position={[pickupPoint.lat, pickupPoint.lng]} /> : null}
              {dropoffPoint ? <Marker position={[dropoffPoint.lat, dropoffPoint.lng]} /> : null}
              {routePath.length > 0 ? <Polyline positions={routePath} pathOptions={{ color: '#38bdf8', weight: 5, opacity: 0.82 }} /> : null}
            </MapContainer>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="theme-soft-card rounded-2xl p-4">
            <p className="theme-label text-xs uppercase tracking-[0.22em]">Pickup</p>
            <p className="theme-heading mt-2 break-words text-sm font-medium">{summary.pickup || 'Click map to choose pickup'}</p>
          </div>
          <div className="theme-soft-card rounded-2xl p-4">
            <p className="theme-label text-xs uppercase tracking-[0.22em]">Destination</p>
            <p className="theme-heading mt-2 break-words text-sm font-medium">{summary.dropoff || 'Click map again to choose destination'}</p>
          </div>
          <div className="theme-soft-card rounded-2xl p-4">
            <p className="theme-label text-xs uppercase tracking-[0.22em]">Estimated path</p>
            <p className="theme-heading mt-2 break-words text-sm font-medium">
              {locationError || routeMeta || 'Route will appear after both points are selected.'}
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
