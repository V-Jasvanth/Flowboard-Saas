'use client';
import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      color: 'var(--text)'
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
        <h1 style={{
          fontSize: 120,
          fontWeight: 800,
          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 16,
          lineHeight: 1
        }}>
          404
        </h1>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Page not found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
          We couldn't find the page you're looking for. It might have been moved, deleted, or perhaps you mistyped the URL.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={() => router.back()}>
            <ArrowLeft size={16} /> Go Back
          </button>
          <Link href="/dashboard" className="btn btn-primary">
            <Home size={16} /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
