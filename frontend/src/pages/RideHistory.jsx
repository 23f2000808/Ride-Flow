import { useState, useEffect, useContext } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import RideCard from '../components/RideCard';
import './RideHistory.css';

const filters = ['all', 'completed', 'requested', 'cancelled'];

export default function RideHistory() {
  const { user } = useContext(AuthContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [rides, setRides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submittingRatingId, setSubmittingRatingId] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await apiFetch(`/rides/user/${user._id}`);
        if (data.success) {
          setRides(data.data.rides || []);
        }
      } catch (err) {
        console.error("Failed to fetch rides:", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (user?._id) fetchHistory();
  }, [user]);

  const filteredRides = rides.filter(ride => {
    const matchesSearch =
      ride.pickup.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ride.destination.address.toLowerCase().includes(searchTerm.toLowerCase());

    if (filter === 'all') return matchesSearch;
    return matchesSearch && ride.status === filter;
  });

  const totalSpent = rides
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (r.fare?.estimatedFare || r.fare?.actualFare || (typeof r.fare === 'number' ? r.fare : 0)), 0);

  const handleRateRide = async (rideId, score) => {
    setSubmittingRatingId(rideId);
    try {
      const data = await apiFetch(`/rides/${rideId}/rate`, {
        method: 'PATCH',
        body: JSON.stringify({
          ratedBy: 'user',
          score,
        }),
      });

      if (data.success) {
        setRides(prev => prev.map(ride => (
          ride._id === rideId
            ? {
                ...ride,
                ratings: {
                  ...ride.ratings,
                  userRating: { score },
                },
              }
            : ride
        )));
      }
    } catch (err) {
      console.error('Failed to rate ride:', err);
      alert(`Failed to submit rating: ${err.message}`);
    } finally {
      setSubmittingRatingId(null);
    }
  };

  return (
    <div className="ride-history">
      <div className="history-header">
        <h2>Ride History</h2>
        <p>{rides.length} lifetime trips taken on RideFlow · ₹{Math.round(totalSpent).toLocaleString()} spent overall</p>
      </div>

      <div className="history-controls">
        <div className="filter-tabs">
          {filters.map(f => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search destination..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="history-list">
        {isLoading ? (
          <div className="flex-center p-8 text-muted">
            <Loader2 className="spin" size={28} style={{ marginRight: '12px', color: '#3B82F6' }} /> Loading...
          </div>
        ) : filteredRides.length === 0 ? (
          <div className="empty-state">
            <MapPin size={48} />
            <h3>No trips found</h3>
            <p>We couldn't find any trips matching your current search or filter applied.</p>
          </div>
        ) : (
          filteredRides.map(ride => {
            const fare = ride.fare?.estimatedFare || ride.fare?.actualFare || (typeof ride.fare === 'number' ? ride.fare : 0);
            const hasUserRating = Boolean(ride.ratings?.userRating?.score);
            return (
              <div key={ride._id}>
                <RideCard ride={{
                  pickup: ride.pickup.address,
                  destination: ride.destination.address,
                  fare: Math.round(fare),
                  date: new Date(ride.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                  time: new Date(ride.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                  status: ride.status,
                  vehicleType: ride.vehicleType,
                  driver: ride.driver ? 'Assigned' : 'Searching...',
                  distance: ride.distance ? `${ride.distance.toFixed(1)} km` : '—'
                }} />

                {ride.status === 'completed' && (
                  <div style={{ marginTop: '10px', marginLeft: '6px', marginBottom: '16px' }}>
                    {hasUserRating ? (
                      <p style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                        Your rating: {ride.ratings.userRating.score}/5
                      </p>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Rate this ride:</span>
                        {[1, 2, 3, 4, 5].map(score => (
                          <button
                            key={score}
                            onClick={() => handleRateRide(ride._id, score)}
                            disabled={submittingRatingId === ride._id}
                            className="filter-tab"
                            style={{ padding: '6px 10px' }}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
