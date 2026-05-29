import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { ShieldCheck, LogIn, UserPlus, Mail, Lock, Clock, Smile } from 'lucide-react';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    target_hours: '40',
    avg_sleep: 'Average',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (authMode === 'login') {
        await login(formData.username, formData.password);
      } else {
        await register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          target_hours: parseInt(formData.target_hours, 10) || 40,
          avg_sleep: formData.avg_sleep,
        });
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="v10-card auth-card">
      <div className="auth-icon" style={{ display: 'flex', justifyContent: 'center', color: 'var(--deep-navy)' }}>
        <ShieldCheck size={48} />
      </div>
      <h1 style={{ fontFamily: 'Tenor Sans', fontSize: '2rem', textAlign: 'center', color: 'var(--deep-navy)', marginBottom: '0.25rem' }}>
        {authMode === 'login' ? 'Welcome Back' : 'Join DigiFatigueBeaters'}
      </h1>
      <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {authMode === 'login'
          ? 'Establish secure connection session'
          : 'Establish your professional baseline'}
      </p>

      {error && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', background: '#fee2e2', color: '#b91c1c', fontSize: '0.875rem', marginBottom: '1rem', fontWeight: 500 }}>
          {error}
        </div>
      )}

      <form className="v10-form" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-input-wrapper" style={{ position: 'relative' }}>
            <input
              name="username"
              type="text"
              placeholder="Username / Identity"
              required
              autoComplete="off"
              value={formData.username}
              onChange={handleChange}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {authMode === 'register' && (
            <>
              <div className="form-input-wrapper" style={{ position: 'relative' }}>
                <input
                  name="email"
                  type="email"
                  placeholder="Secure Email"
                  required
                  autoComplete="off"
                  value={formData.email}
                  onChange={handleChange}
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>

              <div className="profile-setup-label" style={{ fontWeight: 600, color: 'var(--deep-navy)', fontSize: '0.85rem', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Professional Profile Setup
              </div>

              <div className="form-input-wrapper" style={{ position: 'relative' }}>
                <input
                  name="target_hours"
                  type="number"
                  placeholder="Target Weekly Hours (e.g. 40)"
                  required
                  min="1"
                  max="168"
                  value={formData.target_hours}
                  onChange={handleChange}
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>

              <div className="form-input-wrapper" style={{ position: 'relative' }}>
                <select
                  name="avg_sleep"
                  className="v10-select"
                  required
                  value={formData.avg_sleep}
                  onChange={handleChange}
                  style={{ paddingLeft: '2.5rem', width: '100%' }}
                >
                  <option value="Good">Sleep Quality: Good</option>
                  <option value="Average">Sleep Quality: Average</option>
                  <option value="Poor">Sleep Quality: Poor</option>
                </select>
              </div>
            </>
          )}

          <div className="form-input-wrapper" style={{ position: 'relative' }}>
            <input
              name="password"
              type="password"
              placeholder="Passphrase"
              required
              value={formData.password}
              onChange={handleChange}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <button type="submit" className="v10-btn yellow-btn" disabled={isLoading} style={{ marginTop: '0.5rem' }}>
            {isLoading ? (
              <span className="btn-spinner"></span>
            ) : authMode === 'login' ? (
              'Initialize System Session'
            ) : (
              'Commit Configuration'
            )}
          </button>
        </div>
      </form>

      <button
        className="back-btn-ghost mt-4"
        style={{ marginTop: '1.5rem', width: '100%', background: 'none', border: 'none', color: 'var(--deep-navy)', cursor: 'pointer', fontWeight: 500 }}
        onClick={() => setAuthMode((m) => (m === 'login' ? 'register' : 'login'))}
      >
        {authMode === 'login' ? 'No access? Register here' : 'Return to secure login'}
      </button>
    </section>
  );
}
