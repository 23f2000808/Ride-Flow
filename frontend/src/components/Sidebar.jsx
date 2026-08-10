import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Car, MapPin, Clock, User, Settings,
  LogOut, Menu, X
} from 'lucide-react';
import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Sidebar.css';

const userLinks = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/book', label: 'Book a Ride', icon: MapPin },
  { path: '/history', label: 'Ride History', icon: Clock },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const driverLinks = [
  { path: '/driver', label: 'Dashboard', icon: Home },
  { path: '/history', label: 'Ride History', icon: Clock },
];

export default function Sidebar({ role = 'user' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);
  const [collapsed, setCollapsed] = useState(false);
  const links = role === 'driver' ? driverLinks : userLinks;

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <Menu size={20} /> : <X size={20} />}
      </button>

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Car size={22} strokeWidth={2.5} />
          </div>
          {!collapsed && <span className="sidebar-name">RideFlow</span>}
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">
            {!collapsed && (role === 'driver' ? 'DRIVER MENU' : 'MAIN MENU')}
          </div>
          {links.map(link => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                title={link.label}
              >
                <Icon size={19} />
                {!collapsed && <span>{link.label}</span>}
                {location.pathname === link.path && !collapsed && <div className="active-indicator" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="sidebar-link logout-btn"
            title="Log out"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            <LogOut size={19} />
            {!collapsed && <span>Log Out</span>}
          </button>
        </div>
      </aside>

      {!collapsed && (
        <div
          className="sidebar-overlay"
          onClick={() => setCollapsed(true)}
        />
      )}
    </>
  );
}
