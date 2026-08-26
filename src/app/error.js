'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('App Error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      color: 'var(--text)'
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 32, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-soft)', color: 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
        }}>
          <AlertTriangle size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Something went wrong!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
          We're sorry, but an unexpected error occurred. You can try refreshing the page or contact support if the issue persists.
        </p>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => reset()}>
          <RefreshCcw size={16} /> Try again
        </button>
      </div>
    </div>
  );
}
