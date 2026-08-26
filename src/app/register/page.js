'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Lock, Zap } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabel = ['', 'Weak', 'Medium', 'Strong'][strength];
  const strengthColor = ['', 'var(--danger)', 'var(--warning)', 'var(--success)'][strength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(name, email, password);
      router.push('/dashboard');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="hero-bg" />
      <div className="auth-card card card-elevated animate-scale">
        <div className="auth-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={22} color="white" />
            </div>
            <span style={{ fontSize: 24, fontWeight: 700 }}>FlowBoard</span>
          </div>
          <h1>Create your account</h1>
          <p>Start managing projects in minutes</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Full Name</label>
            <div className="input-icon-wrapper"><User /><input className="input" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required /></div>
          </div>
          <div className="input-group">
            <label>Email</label>
            <div className="input-icon-wrapper"><Mail /><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          </div>
          <div className="input-group">
            <label>Password</label>
            <div className="input-icon-wrapper"><Lock /><input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            {password && (
              <div>
                <div className="password-strength"><div className="password-strength-bar" style={{ width: `${(strength / 3) * 100}%`, background: strengthColor }} /></div>
                <span style={{ fontSize: 11, color: strengthColor, marginTop: 4, display: 'block' }}>{strengthLabel}</span>
              </div>
            )}
          </div>
          <div className="input-group">
            <label>Confirm Password</label>
            <div className="input-icon-wrapper"><Lock /><input className="input" type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Create Account'}
          </button>
        </form>
        <div className="auth-footer">Already have an account? <Link href="/login">Sign in</Link></div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <AuthProvider><RegisterForm /></AuthProvider>;
}
