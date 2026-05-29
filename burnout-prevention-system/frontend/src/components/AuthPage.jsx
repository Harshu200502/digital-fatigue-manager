import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Shield, Key, Mail, User, Phone, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [authMode, setAuthMode] = useState('login');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Target config for registration baseline
  const [targetHours, setTargetHours] = useState('40');
  const [sleepQuality, setSleepQuality] = useState('Average');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (authMode === 'login') {
        const identifier = username || email;
        if (!identifier || !password) {
          setError('Please fill in all fields.');
          setIsLoading(false);
          return;
        }
        await login(identifier, password);
      } else {
        if (!username || !email || !password) {
          setError('Please fill in all required fields.');
          setIsLoading(false);
          return;
        }
        const formData = {
          username: username.trim(),
          email: email.trim().lower(),
          password,
          phone_number: phone.trim() || undefined,
          target_hours: parseInt(targetHours) || 40,
          avg_sleep: sleepQuality
        };
        await register(formData);
      }
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="v10-auth-screen">
      <section className="v10-card auth-card glass">
        <div className="auth-icon">🛡️</div>
        <h1>{authMode === 'login' ? 'Guardian Access' : 'Initial Registration'}</h1>
        <p className="auth-subtitle">
          {authMode === 'login' 
            ? 'Initialize Cognitive Shield Session' 
            : 'Establish Your Professional Baseline'}
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        <form className="v10-form" onSubmit={handleSubmit}>
          {authMode === 'login' ? (
            <>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Username or Email" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required 
                  autoComplete="username" 
                />
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type="password" 
                  placeholder="Passphrase" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  autoComplete="current-password" 
                />
              </div>
            </>
          ) : (
            <>
              <input 
                type="text" 
                placeholder="Username / Identity" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required 
                autoComplete="username" 
              />
              <input 
                type="email" 
                placeholder="Secure Email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                autoComplete="email" 
              />
              <input 
                type="tel" 
                placeholder="Phone Number (Optional)" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel" 
              />
              
              <div className="profile-setup-label">Baseline Settings</div>
              <input 
                type="number" 
                placeholder="Target Weekly Hours (e.g. 40)" 
                value={targetHours}
                onChange={(e) => setTargetHours(e.target.value)}
                required 
              />
              <select 
                value={sleepQuality}
                onChange={(e) => setSleepQuality(e.target.value)}
                className="v10-select" 
                required
              >
                <option value="Good">Sleep Quality: Good</option>
                <option value="Average">Sleep Quality: Average</option>
                <option value="Poor">Sleep Quality: Poor</option>
              </select>

              <input 
                type="password" 
                placeholder="Passphrase (Min 8 chars, 1 number, 1 special)" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                autoComplete="new-password" 
              />
            </>
          )}

          <button type="submit" className="v10-btn yellow-btn" disabled={isLoading}>
            {isLoading ? (
              <span className="btn-spinner"></span>
            ) : (
              <>
                {authMode === 'login' ? 'Initialize System Session' : 'Commit Configuration'}
                <ArrowRight size={16} style={{ marginLeft: '8px' }} />
              </>
            )}
          </button>
        </form>

        <button 
          className="back-btn-ghost mt-4"
          onClick={() => {
            setError('');
            setAuthMode(authMode === 'login' ? 'register' : 'login');
          }}
          type="button"
        >
          {authMode === 'login' ? 'Establish New Profile baseline' : 'Return to Secure Session Sign-in'}
        </button>
      </section>
    </div>
  );
}
