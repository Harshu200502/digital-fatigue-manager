import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useAuth } from './AuthContext';

/**
 * AuthPage — Google-style minimalist authentication
 * Supports: Email / Username login, Phone registration field,
 * work_start_time capture, password strength validation,
 * and animated mode toggle.
 */
export default function AuthPage() {
    const { login, register } = useAuth();
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Shared state
    const [identifier, setIdentifier] = useState(''); // email or username
    const [password, setPassword] = useState('');

    // Register-only fields
    const [reg, setReg] = useState({
        username: '',
        email: '',
        phone_number: '',
    });

    const updateReg = (k, v) => setReg(p => ({ ...p, [k]: v }));
    const switchMode = (m) => { setMode(m); setError(''); };

    /* ── Client-side password validation ── */
    const validatePassword = (pw) => {
        if (pw.length < 8) return 'Password must be at least 8 characters.';
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) {
            return 'Password needs at least one special character (!@#$%^&* etc.).';
        }
        return null;
    };

    /* ── LOGIN ── */
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(identifier, password);
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed. Check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    /* ── REGISTER ── */
    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Client-side password check
        const pwError = validatePassword(password);
        if (pwError) {
            setError(pwError);
            setLoading(false);
            return;
        }

        try {
            await register({
                username: reg.username,
                email: reg.email,
                phone_number: reg.phone_number || null,
                password,
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page" style={{minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <motion.div initial={{scale: 0.95, opacity: 0}} animate={{scale: 1, opacity: 1}} transition={{duration: 0.4}} className="auth-card" style={{background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.4)', padding: '2.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%'}}>
                {/* ── Brand ── */}
                <div className="auth-brand" style={{marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.8rem', justifyContent: 'center'}}>
                    <h1 style={{fontFamily: 'Tenor Sans', color: 'var(--deep-navy)', fontSize: '1.8rem', textAlign: 'center'}}><span style={{display: 'inline-flex', verticalAlign: 'middle', marginRight: '8px'}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--deep-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg></span>DigiFatigueBeaters</h1>
                </div>

                {/* ── Login Form ── */}
                {mode === 'login' && (
                    <form onSubmit={handleLogin} key="login" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                        <h2 style={{fontSize: '1.4rem', marginBottom: '0.25rem', textAlign: 'center'}}>Welcome back.</h2>
                        <p style={{textAlign: 'center', marginBottom: '2rem', color: 'rgba(40,57,108,0.7)', fontSize: '0.9rem'}}>Sign in to your dashboard.</p>

                        <div className="form-group">
                            <input
                                id="li-identifier"
                                type="text"
                                className="form-input"
                                placeholder="Email or Username"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                autoComplete="username"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <input
                                id="li-password"
                                type="password"
                                className="form-input"
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        {error && <div className="error-msg" role="alert">{error}</div>}

                        <button 
                            type="submit" 
                            className="btn-primary" 
                            disabled={loading}
                            style={{width: '100%', marginTop: '1rem'}}
                        >
                            {loading ? 'Authenticating...' : 'Sign in'}
                        </button>

                        <div className="auth-sub">
                            Don't have an account?{' '}
                            <span onClick={() => switchMode('register')}>
                                Create account
                            </span>
                        </div>
                    </form>
                )}

                {/* ── Register Form ── */}
                {mode === 'register' && (
                    <form onSubmit={handleRegister} key="register" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                        <h2 style={{fontSize: '1.4rem', marginBottom: '0.25rem', textAlign: 'center'}}>Create account</h2>
                        <p style={{textAlign: 'center', marginBottom: '2rem', color: 'rgba(40,57,108,0.7)', fontSize: '0.9rem'}}>Sign up for your dashboard.</p>

                        {/* Identity */}
                        <div className="form-group" style={{display: 'flex', gap: '1rem'}}>
                            <input
                                id="reg-username"
                                type="text"
                                className="form-input"
                                placeholder="Username *"
                                value={reg.username}
                                onChange={e => updateReg('username', e.target.value)}
                                autoComplete="username"
                                required
                            />
                            <input
                                id="reg-phone"
                                type="tel"
                                className="form-input"
                                placeholder="Phone (optional)"
                                value={reg.phone_number}
                                onChange={e => updateReg('phone_number', e.target.value)}
                                autoComplete="tel"
                            />
                        </div>
                        
                        <div className="form-group">
                            <input
                                id="reg-email"
                                type="email"
                                className="form-input"
                                placeholder="Email address *"
                                value={reg.email}
                                onChange={e => updateReg('email', e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <input
                                id="reg-password"
                                type="password"
                                className="form-input"
                                placeholder="Create password (8+ chars, 1 symbol) *"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                        </div>

                        {/* Password strength indicator */}
                        <PasswordStrength password={password} />


                        {error && <div className="error-msg" role="alert" style={{marginTop: '1rem'}}>{error}</div>}

                        <button type="submit" className="btn-primary" disabled={loading} style={{width: '100%', marginTop: '1.5rem'}}>
                            {loading ? 'Creating...' : 'Create Account'}
                        </button>
                        
                        <div className="auth-sub">
                            Already have an account?{' '}
                            <span onClick={() => switchMode('login')}>
                                Sign in instead
                            </span>
                        </div>
                    </form>
                )}
            </motion.div>
        </div>
    );
}

/* ── Sub-components ── */

function FloatField({ id, type, label, value, onChange, autoComplete, required, min, max }) {
    return (
        <div className="gauth-float-field">
            <input
                id={id}
                type={type}
                placeholder=" "
                value={value}
                onChange={e => onChange(e.target.value)}
                autoComplete={autoComplete}
                required={required}
                min={min}
                max={max}
                className="gauth-input"
            />
            <label htmlFor={id} className="gauth-label">{label}</label>
        </div>
    );
}

function SubmitBtn({ loading, label }) {
    return (
        <button type="submit" className="gauth-primary-btn" disabled={loading}>
            {loading
                ? <span className="gauth-spinner" aria-label="Loading" />
                : label}
        </button>
    );
}

function PasswordStrength({ password }) {
    if (!password) return null;

    const checks = [
        { label: '8+ characters', pass: password.length >= 8 },
        { label: 'Special character', pass: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
    ];

    const score = checks.filter(c => c.pass).length;
    const colors = ['#ef4444', '#facc15', '#22c55e'];

    return (
        <div className="pw-strength">
            <div className="pw-strength-bar">
                <div
                    className="pw-strength-fill"
                    style={{
                        width: `${(score / checks.length) * 100}%`,
                        background: colors[score] || colors[0],
                    }}
                />
            </div>
            <div className="pw-strength-checks">
                {checks.map(c => (
                    <span key={c.label} className={`pw-check ${c.pass ? 'pass' : ''}`}>
                        {c.pass ? '✓' : '○'} {c.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
