import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Overriding default Leaflet icon paths to prevent 404s in Vite React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// Custom icons to differentiate pickup and destination
const pickupIcon = new L.Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'pickup-marker', 
});

const dropoffIcon = new L.Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'dropoff-marker',
});

// Component to dynamically alter the Leaflet view based on props
const ChangeView = ({ center, pickupCoords, destCoords }) => {
  const map = useMap();
  useEffect(() => {
    if (pickupCoords && destCoords) {
      // Intelligently fit both markers on the screen with 50px padding so lines don't clip
      map.fitBounds([pickupCoords, destCoords], { padding: [50, 50] });
    } else if (center && center[0] && center[1]) {
      map.setView(center, 12);
    }
  }, [center, pickupCoords, destCoords, map]);
  return null;
};

export default function LeafletMap({ pickupStr, destinationStr, nearbyDrivers = [], onRouteCalculated }) {
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [routeLayer, setRouteLayer] = useState([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Default bounds pointing exactly to Bangalore given it's used in the placeholders
  const defaultCenter = [12.9716, 77.5946]; 

  useEffect(() => {
    if (!pickupStr || !destinationStr) {
      setPickupCoords(null);
      setDestCoords(null);
      setRouteLayer([]);
      return;
    }

    const getCoordinates = async (place) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&countrycodes=in`, {
          headers: { "User-Agent": "RideFlow-App" }
        });
        const data = await res.json();
        if (data && data.length > 0) {
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
        return null;
      } catch (e) {
        console.error("Geocoding failed for", place, e);
        return null;
      }
    };

    const computeRealGeocodingAndRouting = async () => {
      setIsGeocoding(true);
      try {
        const pCoords = await getCoordinates(pickupStr);
        // Important: Short delay to respect Nominatim API rate limits perfectly
        await new Promise(resolve => setTimeout(resolve, 600));
        const dCoords = await getCoordinates(destinationStr);

        if (!pCoords || !dCoords) {
          console.error("Could not find locations");
          return;
        }

        setPickupCoords(pCoords);
        setDestCoords(dCoords);

        // Fetching real driving street-route via the free OSRM Public API
        const lng1 = pCoords[1];
        const lat1 = pCoords[0];
        const lng2 = dCoords[1];
        const lat2 = dCoords[0];

        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`);
        
        if (!response.ok) throw new Error("Routing failed");
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          // OSRM returns coordinates as [lng, lat], but Leaflet native Polyline expects [lat, lng]
          const mappedRoute = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          setRouteLayer(mappedRoute);

          // Extract metrics from OSRM
          const distanceKm = data.routes[0].distance / 1000;
          const durationMin = data.routes[0].duration / 60;
          
          if (onRouteCalculated) {
             onRouteCalculated({ distanceKm, durationMin, pCoords, dCoords });
          }

        } else {
          setRouteLayer([pCoords, dCoords]);
        }
      } catch (err) {
        console.error("Error fetching Leaflet real route, falling back", err);
        // Fallback to straight line if router errors but geocoding succeeded
        if (pickupCoords && destCoords) {
           setRouteLayer([pickupCoords, destCoords]);
        }
      } finally {
        setIsGeocoding(false);
      }
    };

    computeRealGeocodingAndRouting();
  }, [pickupStr, destinationStr]);

  const mapCenter = pickupCoords || defaultCenter;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', backgroundColor: '#e5e5e5', zIndex: 0 }}>
      
      {isGeocoding && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
           <div style={{ width: '32px', height: '32px', border: '3px solid var(--black)', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '16px', animation: 'spin 1s linear infinite' }}></div>
           <p style={{ fontWeight: '600', color: 'var(--black)' }}>Locating coordinates on map...</p>
        </div>
      )}

      <MapContainer center={mapCenter} zoom={12} style={{ width: '100%', height: '100%', minHeight: '500px', zIndex: 1 }}>
        {/* Completely Free OpenStreetMap Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ChangeView center={mapCenter} pickupCoords={pickupCoords} destCoords={destCoords} />

        {pickupCoords && (
          <Marker position={pickupCoords} icon={pickupIcon} />
        )}

        {destCoords && (
          <Marker position={destCoords} icon={dropoffIcon} />
        )}

        {nearbyDrivers.map((drv) => (
          <Marker key={drv._id} position={[drv.location.lat, drv.location.lng]} />
        ))}

        {routeLayer.length > 0 && (
          <Polyline positions={routeLayer} pathOptions={{ color: '#000000', weight: 6, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }} />
        )}
      </MapContainer>
    </div>
  );
}
