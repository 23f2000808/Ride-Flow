import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { MapPin, Navigation, Activity, CreditCard, Route, CheckCircle, Clock } from 'lucide-react';
import RideCard from '../components/RideCard';
import { motion } from 'framer-motion';
import './UserDashboard.css';

const StatCardModern = ({ icon, label, value }) => (
  <div className="stat-card-modern">
    <div className="stat-icon-wrapper">{icon}</div>
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  </div>
);

export default function UserDashboard() {
  console.log('UserDashboard render');

  const { displayName } = useContext(AuthContext);
  const navigate = useNavigate();
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');

  const handleBook = () => {
    if (pickup && destination) {
      navigate('/book', { state: { pickup, destination } });
    } else {
      navigate('/book');
    }
  };

  return (
    <div className="user-dashboard-modern">
      <main className="dashboard-content-below">
        <div className="dashboard-header-simple">
          <h1>Welcome back, {displayName.split(' ')[0]}</h1>
          <p>Here is an overview of your platform activity.</p>
        </div>

        <motion.div 
          className="stats-grid"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        >
          <StatCardModern icon={<Activity size={24} />} label="Total Rides" value="48" />
          <StatCardModern icon={<CreditCard size={24} />} label="Total Spent" value="₹12,450" />
          <StatCardModern icon={<Route size={24} />} label="Distance" value="1,240 km" />
          <StatCardModern icon={<CheckCircle size={24} />} label="Completion" value="99%" />
        </motion.div>

        <div className="dashboard-grid">
          {/* Main Content Area */}
          <div className="main-feed animate-fade-in-up">
            
            <div className="plan-journey-card">
              <div className="section-head"><h3 style={{marginBottom: '16px'}}>Plan your journey</h3></div>
              
              <div className="saas-input-wrapper">
                <MapPin size={20} color="var(--primary)" />
                <input 
                  type="text" placeholder="Pickup location" 
                  value={pickup} onChange={e => setPickup(e.target.value)}
                />
              </div>

              <div className="saas-input-wrapper">
                <Navigation size={20} color="var(--black)" />
                <input 
                  type="text" placeholder="Drop-off location" 
                  value={destination} onChange={e => setDestination(e.target.value)}
                />
              </div>

              <button className="saas-btn-prices" onClick={handleBook}>
                Continue calculation
              </button>
            </div>

            <div className="section-head" style={{ marginTop: '48px'}}>
              <h3>Recent Rides</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <RideCard ride={{
                  pickup: "Koramangala 5th Block",
                  destination: "Whitefield Tech Park",
                  fare: 450,
                  date: "Mar 22, 2026", time: "09:30 AM",
                  status: 'completed', vehicleType: 'Prime (Car)', distance: '12.4 km'
                }} 
              />
              <RideCard ride={{
                  pickup: "Indiranagar 100ft Road",
                  destination: "MG Road Metro",
                  fare: 120,
                  date: "Mar 18, 2026", time: "06:15 PM",
                  status: 'completed', vehicleType: 'Urban (Auto)', distance: '4.2 km'
                }} 
              />
            </div>
          </div>

          {/* Right Sidebar */}
          <aside className="dashboard-aside animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="quick-book-card">
              <h4>Saved Locations</h4>
              <p className="text-muted" style={{ fontSize: '14px', marginBottom: '24px'}}>Quick route calculation</p>
              
              <div className="saved-loc" onClick={() => navigate('/book')}>
                <div className="loc-icon"><MapPin size={20} /></div>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>Home</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Koramangala 5th Block</div>
                </div>
              </div>
              
              <div className="saved-loc" onClick={() => navigate('/book')}>
                <div className="loc-icon"><Clock size={20} /></div>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>Work</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Whitefield Tech Park</div>
                </div>
              </div>
            </div>

            <div className="promo-card">
              <h3>RideFlow Corporate</h3>
              <p style={{ opacity: 0.9, marginBottom: '24px', fontSize: '14px'}}>
                Unlock dedicated expense tracking and priority fleet routing for your team.
              </p>
              <button className="promo-btn" onClick={() => navigate('/profile')}>View plans</button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
