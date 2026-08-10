import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Activity, Navigation, CreditCard, Route, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import './Home.css';

const StatCard = ({ icon, title, value }) => (
  <div className="stat-card">
    <div className="stat-icon-wrapper">
      {icon}
    </div>
    <div className="stat-info">
      <div className="stat-label">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  </div>
);

export default function Home() {
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > window.innerHeight * 0.2);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGo = () => {
    if (pickup && destination) {
      navigate('/book', { state: { pickup, destination } });
    } else {
      navigate('/login');
    }
  };

  const scrollToContent = () => {
    document.getElementById('stats').scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="home-modern">
      
      {/* ─── FINTECH HERO ─── */}
      <section className="booking-view-saas">
        <div className="booking-saas-container">
          <motion.h1 
            className="booking-saas-title"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          >
            Plan your journey.
          </motion.h1>
          <motion.p 
            className="booking-saas-subtitle"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          >
            A premium mobility platform engineered for reliability and transparency.
          </motion.p>
          
          <motion.div 
            className="saas-booking-card"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="saas-input-wrapper">
              <MapPin size={22} color="var(--primary)" />
              <input 
                type="text" placeholder="Pickup location" 
                value={pickup} onChange={e => setPickup(e.target.value)}
              />
            </div>

            <div className="saas-input-divider"></div>

            <div className="saas-input-wrapper" style={{ background: 'transparent' }}>
              <Navigation size={22} color="var(--black)" />
              <input 
                type="text" placeholder="Drop-off location" 
                value={destination} onChange={e => setDestination(e.target.value)}
              />
            </div>

            <button className="saas-btn-prices" onClick={handleGo}>
              Calculate Routing
            </button>
          </motion.div>
        </div>

        <div className={`scroll-indicator ${scrolled ? 'hidden' : ''}`} onClick={scrollToContent}>
          <span>Discover Features</span>
          <ChevronDown size={18} />
        </div>
      </section>

      {/* ─── SCROLL REVEAL STATS ─── */}
      <section id="stats" className="stats-section">
        <motion.div 
          className="stats-inner"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2>Platform Scale & Activity</h2>
          <div className="stats-grid">
            <StatCard icon={<Activity size={24} strokeWidth={2.5} />} title="Total Rides" value="48" />
            <StatCard icon={<CreditCard size={24} strokeWidth={2.5} />} title="Total Spent" value="₹12,450" />
            <StatCard icon={<Route size={24} strokeWidth={2.5} />} title="Distance Travelled" value="1,240 km" />
            <StatCard icon={<MapPin size={24} strokeWidth={2.5} />} title="Avg. Ride Cost" value="₹259" />
          </div>
        </motion.div>
      </section>
      
    </div>
  );
}
