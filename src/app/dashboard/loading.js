export default function DashboardLoading() {
  return (
    <div className="dashboard-content">
      <div className="section-title">
        <div className="skeleton" style={{ width: 200, height: 28 }} />
      </div>
      <div className="stats-grid">
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
      </div>
      <div className="dashboard-grid">
        <div className="skeleton" style={{ height: 350, borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: 350, borderRadius: 'var(--radius-lg)' }} />
      </div>
    </div>
  );
}
