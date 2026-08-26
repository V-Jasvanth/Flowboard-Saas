'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Columns3, Users, BarChart3, ArrowRight, Zap } from 'lucide-react';

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    const match = document.cookie.split('; ').find(r => r.startsWith('flowboard-token='));
    const cookieToken = match?.split('=')[1];
    const token = cookieToken || localStorage.getItem('flowboard-token');
    if (token) setIsLoggedIn(true);
  }, []);

  return (
    <div>
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="white" />
          </div>
          FlowBoard
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#stats">About</a>
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn btn-primary btn-sm">Go to Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-orb" style={{ width: 400, height: 400, background: 'var(--primary)', top: '-10%', left: '60%' }} />
        <div className="hero-orb" style={{ width: 300, height: 300, background: 'var(--accent)', bottom: '10%', left: '10%', animationDelay: '2s' }} />
        <div className="hero-orb" style={{ width: 200, height: 200, background: 'var(--cyan)', top: '40%', right: '5%', animationDelay: '4s' }} />
        <h1>Manage Projects<br />Like Never Before</h1>
        <p>The all-in-one project management platform with intuitive Kanban boards, real-time collaboration, and powerful analytics to keep your team shipping.</p>
        <div className="hero-buttons">
          <Link href="/register" className="btn btn-primary btn-lg">
            Get Started Free <ArrowRight size={18} />
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg">See Demo</Link>
        </div>
      </section>

      <section className="features" id="features">
        <h2>Everything you need to ship faster</h2>
        <div className="features-grid">
          {[
            { icon: <Columns3 size={28} />, title: 'Kanban Boards', desc: 'Visualize your workflow with drag-and-drop boards. Move tasks between columns, set WIP limits, and track progress in real-time.' },
            { icon: <Users size={28} />, title: 'Team Collaboration', desc: 'Invite your team, assign tasks, leave comments, and stay in sync with real-time activity tracking and notifications.' },
            { icon: <BarChart3 size={28} />, title: 'Analytics Dashboard', desc: 'Get insights into your team\'s velocity, task distribution, and completion rates with beautiful interactive charts.' },
          ].map((f, i) => (
            <div key={i} className="card feature-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="feature-icon" style={{ color: 'var(--primary-hover)' }}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="stats-section" id="stats">
        <div className="stats-row">
          {[{ n: '10K+', t: 'Teams' }, { n: '1M+', t: 'Tasks Managed' }, { n: '99.9%', t: 'Uptime' }].map((s, i) => (
            <div key={i} className="stat">
              <div className="stat-number">{s.n}</div>
              <div className="stat-text">{s.t}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to transform your workflow?</h2>
        <p>Join thousands of teams already shipping faster with FlowBoard.</p>
        <Link href="/register" className="btn btn-primary btn-lg">Start Free Today <ArrowRight size={18} /></Link>
      </section>

      <footer className="landing-footer">
        <p>© 2026 FlowBoard. Built with ❤️ for productive teams.</p>
      </footer>
    </div>
  );
}
