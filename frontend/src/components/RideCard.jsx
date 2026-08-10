import { MapPin, Clock } from 'lucide-react';
import './RideCard.css';

const statusColors = {
  completed: 'green',
  in_progress: 'blue',
  requested: 'orange',
  cancelled: 'red',
  accepted: 'purple',
};

const statusLabels = {
  completed: 'Completed',
  in_progress: 'In Progress',
  requested: 'Searching',
  cancelled: 'Cancelled',
  accepted: 'Accepted',
  driver_arrived: 'Driver Arrived',
};

export default function RideCard({ ride }) {
  const {
    pickup = 'Unknown Pickup',
    destination = 'Unknown Dropoff',
    fare = 0,
    date = 'Today',
    time = '',
    status = 'completed',
    vehicleType = 'car',
    distance = '0 km',
  } = ride || {};

  const color = statusColors[status] || 'blue';

  return (
    <div className="ride-card">
      <div className="ride-card-top">
        <div className="ride-route">
          <div className="route-point">
            <div className="route-dot pickup" />
            <div className="route-text">
              <span className="route-label">Pickup</span>
              <span className="route-address">{pickup}</span>
            </div>
          </div>
          <div className="route-line" />
          <div className="route-point">
            <div className="route-dot destination" />
            <div className="route-text">
              <span className="route-label">Dropoff</span>
              <span className="route-address">{destination}</span>
            </div>
          </div>
        </div>
        
        <span className={`ride-status badge-${color}`}>
          {statusLabels[status] || status}
        </span>
      </div>

      <div className="ride-card-bottom">
        <div className="ride-meta">
          <span className="ride-meta-item price">
            ₹{fare}
          </span>
          <span className="ride-meta-item">
            <MapPin size={16} /> {distance}
          </span>
          <span className="ride-meta-item">
            <Clock size={16} /> {date} {time}
          </span>
        </div>
        <div className="ride-info-tags">
          <span className="ride-tag">{vehicleType}</span>
        </div>
      </div>
    </div>
  );
}
