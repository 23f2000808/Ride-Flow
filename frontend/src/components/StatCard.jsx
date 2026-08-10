import './StatCard.css';

export default function StatCard({ icon, label, value, color = 'blue', trend }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-icon-wrap">
        {icon}
      </div>
      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {trend && (
          <span className={`stat-trend ${trend.startsWith('+') ? 'up' : 'down'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
