import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Navbar.css';

const userLinks = [
  { path: '/dashboard', label: 'Home' },
  { path: '/book', label: 'Book Ride' },
  { path: '/history', label: 'Rides' },
  { path: '/profile', label: 'Profile' },
  { path: '/settings', label: 'Settings' },
];

const driverLinks = [
  { path: '/driver', label: 'Dashboard' },
];

const adminLinks = [
  { path: '/admin', label: 'Dashboard' },
];

export default function Navbar({ role = 'user' }) {
  const navigate = useNavigate();
  const { displayName, logout, user: authUser } = useContext(AuthContext);

  const activeRole = authUser?.role || role;
  const links = activeRole === 'admin' ? adminLinks : activeRole === 'driver' ? driverLinks : userLinks;
  
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="topbar-brand">
          <span className="brand-name">RideFlow</span>
        </Link>

        {authUser ? (
          <>
            <nav className="topbar-nav">
              {links.map(link => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) => `topbar-link ${isActive ? 'active' : ''}`}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="topbar-right">
              <div className="topbar-user">
                <div className="topbar-avatar">
                  {displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="topbar-username">{displayName}</span>
              </div>
              <button
                className="topbar-logout"
                onClick={() => { logout(); navigate('/'); }}
                title="Log out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="topbar-right">
            <Link to="/login" className="topbar-link">Log in</Link>
            <Link to="/signup" className="btn-primary" style={{ padding: '8px 16px', marginLeft: '8px'}}>Sign up</Link>
          </div>
        )}
      </div>
    </header>
  );
}
