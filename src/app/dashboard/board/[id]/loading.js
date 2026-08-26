export default function BoardLoading() {
  return (
    <div className="kb-page">
      <div className="kb-header">
        <div className="kb-header-top">
          <div className="skeleton" style={{ width: 150, height: 16 }} />
        </div>
        <div className="kb-header-main">
          <div className="kb-header-title-area">
            <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 10 }} />
            <div>
              <div className="skeleton" style={{ width: 250, height: 26, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: 180, height: 14 }} />
            </div>
          </div>
          <div className="kb-header-actions">
            <div className="skeleton" style={{ width: 100, height: 32, borderRadius: 100 }} />
            <div className="skeleton" style={{ width: 120, height: 32, borderRadius: 100 }} />
          </div>
        </div>
      </div>
      <div className="kb-board">
        <div className="kb-columns-scroll">
          {[1, 2, 3, 4].map((col) => (
            <div key={col} className="kb-column" style={{ border: 'none', background: 'transparent' }}>
              <div className="kb-col-header" style={{ background: 'transparent', borderBottom: 'none' }}>
                <div className="skeleton" style={{ width: 100, height: 20 }} />
                <div className="skeleton" style={{ width: 24, height: 20, borderRadius: 100 }} />
              </div>
              <div className="kb-col-body">
                {[1, 2, 3].map((card) => (
                  <div key={card} className="skeleton" style={{ height: 110, borderRadius: 'var(--radius)' }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
