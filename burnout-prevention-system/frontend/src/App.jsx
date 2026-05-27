import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
         BarChart, Bar, Cell, Tooltip } from 'recharts';
import './App.css';
import BreakOrchestrator from './components/BreakOrchestrator';

axios.defaults.withCredentials = true;

const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

const BACKEND_URL = 'http://localhost:5000';
const headers = { 'Content-Type': 'application/json' };

const formatDate  = (d) => d.toISOString().split('T')[0];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_FULL    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function getWeekStart(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
    return dt;
}

// ── SUB-COMPONENTS ──

const RiskMeter = ({ score, isCritical }) => {
    const radius = 70, stroke = 10;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (score / 10) * circumference;
    const color = isCritical ? 'var(--bold-yellow)'
        : (score > 6.5 ? '#f87171' : (score > 4.5 ? 'var(--bold-yellow)' : 'var(--guardian-blue)'));
    return (
        <div className="risk-meter-container">
            <svg height={radius * 2} width={radius * 2}>
                <circle stroke="rgba(255,255,255,0.05)" fill="transparent" strokeWidth={stroke}
                    r={normalizedRadius} cx={radius} cy={radius} />
                <circle stroke={color} fill="transparent"
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
                    strokeWidth={stroke} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} />
            </svg>
            <div className="meter-content">
                <span className="meter-label">{isCritical ? 'DANGER' : 'INDEX'}</span>
                <span className="meter-score" style={{ color }}>{score}</span>
            </div>
        </div>
    );
};

const CustomSlider = ({ label, min, max, value, onChange, onDragEnd, unit = "" }) => {
    const percentage = ((value - min) / (max - min)) * 100;
    return (
        <div className="custom-slider-unit">
            <label>{label}</label>
            <div className="slider-wrapper">
                <div className="value-pill" style={{ left: `${percentage}%` }}>{value}{unit}</div>
                <input type="range" min={min} max={max} value={value}
                    onChange={(e) => onChange(parseInt(e.target.value))}
                    onMouseUp={onDragEnd} onTouchEnd={onDragEnd}
                    className="v10-range-input" />
                <div className="slider-track-fill" style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const ToggleCard = ({ label, active, onClick }) => (
    <div className={`glass-toggle-card ${active ? 'active' : ''}`} onClick={onClick}>
        <span className="card-label">{label}</span>
        {active && <div className="card-dot"></div>}
    </div>
);

// ── MAIN APP CONTENT ──

function AppContent() {
    const { currentUser, logout } = useUser();
    const [view, setView]         = useState('home');
    const [authMode, setAuthMode] = useState('login');
    const [notification, setNotification] = useState(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [breakExerciseId, setBreakExerciseId] = useState(null);

    const [stats, setStats] = useState({
        hours_worked: currentUser?.target_hours || 40,
        mh_resources: 'No', wlb_rating: 2, isolation: 1,
        sleep_quality: currentUser?.avg_sleep || 'Average'
    });
    const [results, setResults]       = useState(null);
    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
    const [scheduleMode, setScheduleMode] = useState('daily');
    const [routine, setRoutine]       = useState([
        { id: 't1', start: '09:00', end: '11:00', type: 0, title: 'Strategic Planning' },
        { id: 't2', start: '11:00', end: '11:15', type: 1, title: 'Guardian Recovery Break' },
        { id: 't3', start: '11:15', end: '13:00', type: 0, title: 'Deep Work' }
    ]);
    const [weekTrend, setWeekTrend]   = useState([]);

    const showNotification = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 5000); };
    const handleStatChange = (key, val) => setStats(p => ({ ...p, [key]: val }));

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
            const res = await axios.post(`${BACKEND_URL}${endpoint}`, data, { headers });
            showNotification(`Welcome${authMode === 'register' ? ' to Guardian Protocol' : ' back'}, ${res.data.user.username}`);
            window.location.reload();
        } catch (err) { alert(err.response?.data?.error || "Authentication Error"); }
    };

    const handleLogout = () => { logout(); setView('login'); };

    const runAnalysis = async (updatedStats = null) => {
        if (!currentUser) return;
        try {
            const res = await axios.post(`${BACKEND_URL}/api/predict`,
                { schedule: routine, ...(updatedStats || stats) }, { headers });
            setResults(res.data);
        } catch (err) { console.error("Sync Error:", err); }
    };

    const runOptimization = async () => {
        setIsOptimizing(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/predict`,
                { schedule: routine, optimize: true, ...stats }, { headers });
            setTimeout(() => {
                setResults(res.data);
                if (res.data.optimized_routine) setRoutine([...res.data.optimized_routine]);
                setIsOptimizing(false);
                showNotification('Guardian Logic: Schedule Optimization Complete');
            }, 800);
        } catch (err) { console.error(err); setIsOptimizing(false); }
    };

    const saveRoutineToServer = useCallback(async (routineToSave) => {
        if (!currentUser) return;
        try {
            await axios.post(`${BACKEND_URL}/api/routine`,
                { date: selectedDate, schedule: routineToSave }, { headers });
        } catch (err) { console.error("Save error:", err); }
    }, [currentUser, selectedDate]);

    const loadRoutineFromServer = useCallback(async (date) => {
        if (!currentUser) return;
        try {
            const res = await axios.get(`${BACKEND_URL}/api/routine`, { params: { date } });
            if (res.data.routine?.length > 0) {
                setRoutine([...res.data.routine]);
            } else {
                setRoutine([{ id: `new_${Date.now()}`, start: '09:00', end: '10:00', type: 0, title: '' }]);
            }
        } catch (err) { console.error("Load error:", err); }
    }, [currentUser]);

    const loadWeekTrend = useCallback(async () => {
        if (!currentUser) return;
        try {
            const weekStart = formatDate(getWeekStart(new Date(selectedDate)));
            const res = await axios.get(`${BACKEND_URL}/api/weekly-trend`, { params: { start: weekStart } });
            setWeekTrend(res.data.trend || []);
        } catch (err) { console.error("Trend error:", err); }
    }, [currentUser, selectedDate]);

    const addActivity = (typeCode) => {
        const lastTask = routine[routine.length - 1];
        const nextStart = lastTask ? lastTask.end : '09:00';
        const [h, m] = nextStart.split(':').map(Number);
        const nextEnd = `${Math.min(23, h + 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        setRoutine([...routine, { id: `usr_${Date.now()}`, start: nextStart, end: nextEnd, type: typeCode, title: '' }]);
    };

    const handleTaskUpdate = (id, field, val) => {
        setRoutine(prev => {
            const index = prev.findIndex(t => t.id === id);
            if (index === -1) return prev;
            const newTasks = [...prev];
            newTasks[index] = { ...newTasks[index], [field]: val };
            if (field === 'end' && index < newTasks.length - 1)
                newTasks[index + 1] = { ...newTasks[index + 1], start: val };
            return newTasks;
        });
    };

    useEffect(() => { if (!currentUser) setView('login'); }, [currentUser]);
    useEffect(() => { if (currentUser && view === 'home') runAnalysis(); }, [currentUser, view]);
    useEffect(() => {
        if (currentUser && view === 'routine') { loadRoutineFromServer(selectedDate); loadWeekTrend(); }
    }, [currentUser, view, selectedDate]);
    useEffect(() => {
        if (!currentUser || view !== 'routine') return;
        const timer = setTimeout(() => saveRoutineToServer(routine), 1500);
        return () => clearTimeout(timer);
    }, [routine, currentUser, view]);

    const routineData = useMemo(() => routine.map(t => {
        const [sh, sm] = t.start.split(':').map(Number);
        const [eh, em] = t.end.split(':').map(Number);
        let duration = (eh * 60 + em) - (sh * 60 + sm);
        if (duration < 0) duration += 24 * 60;
        return { name: t.title || (t.type === 0 ? 'Work' : 'Break'), duration: duration > 0 ? duration : 30, type: t.type };
    }), [routine]);

    const weekDays = useMemo(() => {
        const start = getWeekStart(new Date(selectedDate));
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start); d.setDate(d.getDate() + i);
            const dateStr = formatDate(d);
            const trendDay = weekTrend.find(t => t.date === dateStr);
            return {
                date: dateStr, dayName: DAY_NAMES[d.getDay()], dayFull: DAY_FULL[d.getDay()],
                isSelected: dateStr === selectedDate, isToday: dateStr === formatDate(new Date()),
                risk: trendDay?.risk ?? 3.0, workHours: trendDay?.work_hours ?? 0,
                hasSchedule: trendDay?.has_schedule ?? false
            };
        });
    }, [selectedDate, weekTrend]);

    const selectedDayLabel = useMemo(() => {
        const d = new Date(selectedDate + 'T00:00:00');
        return `${DAY_FULL[d.getDay()]}, ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }, [selectedDate]);

    const EXERCISE_ID_MAP = {
        'Bhramari':'bhramari', 'Box Breathing':'boxBreathing',
        'Physiological Sigh':'physioSigh', 'Stretch':'stretchTwist',
        'Tendon':'tendonGlide', 'Wall Angels':'wallAngels'
    };
    const ALL_EXERCISE_IDS = Object.values(EXERCISE_ID_MAP);

    return (
        <div className="v10-shell">
            <div className="slate-blue-backdrop"></div>
            {notification && <div className="ai-toast">{notification}</div>}

            {view === 'break' && (
                <BreakOrchestrator exerciseId={breakExerciseId}
                    onComplete={() => { setView('routine'); setBreakExerciseId(null); }}
                    onCancel={()   => { setView('routine'); setBreakExerciseId(null); }}
                />
            )}

            <header className="v10-header">
                <div className="system-stamp">
                    <span className="brand">COGNITIVE GUARD</span>
                    <span className="status-node">SECURE PERFORMANCE MONITOR : {currentUser?.username || 'PENDING'}</span>
                </div>
                {currentUser && <button className="v10-logout" onClick={handleLogout}>Secure Sign-out</button>}
            </header>

            <main className="v10-main">
                {/* ─── LOGIN / REGISTER ─── */}
                {view === 'login' && (
                    <div className="v10-auth-screen">
                        <section className="v10-card auth-card">
                            <div className="auth-icon">🛡️</div>
                            <h1>{authMode === 'login' ? 'Guardian Access' : 'Initial Registration'}</h1>
                            <p className="auth-subtitle">
                                {authMode === 'login' ? 'Initialize Cognitive Shield Session' : 'Establish Your Professional Baseline'}
                            </p>
                            <form className="v10-form" onSubmit={handleAuthSubmit}>
                                <input name="username" type="text" placeholder="Username / Identity" required autoComplete="off" />
                                {authMode === 'register' && <>
                                    <input name="email" type="email" placeholder="Secure Email" required autoComplete="off" />
                                    <div className="profile-setup-label">Basic Requirements Phase</div>
                                    <input name="target_hours" type="number" placeholder="Target Weekly Hours (e.g. 40)" defaultValue="40" required />
                                    <select name="avg_sleep" className="v10-select" required>
                                        <option value="Good">Sleep Quality: Good</option>
                                        <option value="Average">Sleep Quality: Average</option>
                                        <option value="Poor">Sleep Quality: Poor</option>
                                    </select>
                                </>}
                                <input name="password" type="password" placeholder="Passphrase" required />
                                <button type="submit" className="v10-btn yellow-btn">
                                    {authMode === 'login' ? 'Initialize System Session' : 'Commit Configuration'}
                                </button>
                            </form>
                            <button className="back-btn-ghost mt-4"
                                onClick={() => setAuthMode(m => m === 'login' ? 'register' : 'login')}>
                                {authMode === 'login' ? 'No Access? Register Here' : 'Return to Login'}
                            </button>
                        </section>
                    </div>
                )}

                {/* ─── HOME HUB ─── */}
                {view === 'home' && (
                    <div className="v10-home-view">
                        <section className="v10-hero">
                            <h1 className="bold-yellow-tagline">Proactive Burnout Prevention.</h1>
                            <p className="v10-subtitle">GUARDIAN LOGIC ACTIVE • SECURE ENGINE v16.0</p>
                        </section>
                        <div className="hub-grid">
                            <div className="v10-card hub-card" onClick={() => setView('analysis')}>
                                <div className="card-icon">📊</div>
                                <h2>Risk Analysis</h2>
                                <p>Quantify your professional sustainability index using Guardian Deterministic Logic.</p>
                                <span className="card-link">Open Dashboard →</span>
                            </div>
                            <div className="v10-card hub-card" onClick={() => setView('routine')}>
                                <div className="card-icon">🛡️</div>
                                <h2>Schedule Guard</h2>
                                <p>Plan your week, optimize daily routines, and forecast burnout risk.</p>
                                <span className="card-link">Manage Schedule →</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── RISK ANALYSIS ─── */}
                {view === 'analysis' && (
                    <div className="v10-analysis-view">
                        <div className="analysis-header">
                            <h1 className="bold-yellow-tagline small">Sustainability Matrix</h1>
                            <button className="back-btn-ghost" onClick={() => setView('home')}>← Hub</button>
                        </div>
                        <div className="matrix-layout">
                            <div className="matrix-controls">
                                <section className="v10-card control-section">
                                    <h3>System Inputs</h3>
                                    <CustomSlider label="Weekly Professional Load" min={20} max={80}
                                        value={stats.hours_worked} onChange={(v) => handleStatChange('hours_worked', v)}
                                        onDragEnd={() => runAnalysis()} unit="h" />
                                    <CustomSlider label="Isolation Factor" min={0} max={3}
                                        value={stats.isolation} onChange={(v) => handleStatChange('isolation', v)}
                                        onDragEnd={() => runAnalysis()} />
                                    <CustomSlider label="Work-Life Balance" min={0} max={3}
                                        value={stats.wlb_rating} onChange={(v) => handleStatChange('wlb_rating', v)}
                                        onDragEnd={() => runAnalysis()} />
                                </section>
                                <section className="v10-card control-section">
                                    <h3>Resource Availability</h3>
                                    <div className="toggle-group-label">Mental Health Support</div>
                                    <div className="toggle-row">
                                        <ToggleCard label="Insecure (No)" active={stats.mh_resources === 'No'}
                                            onClick={() => { const s = {...stats, mh_resources:'No'}; setStats(s); runAnalysis(s); }} />
                                        <ToggleCard label="Secure (Yes)" active={stats.mh_resources === 'Yes'}
                                            onClick={() => { const s = {...stats, mh_resources:'Yes'}; setStats(s); runAnalysis(s); }} />
                                    </div>
                                    <div className="toggle-group-label" style={{ marginTop:'2rem' }}>Sleep Quality</div>
                                    <div className="toggle-column">
                                        {['Poor','Average','Good'].map(q => (
                                            <ToggleCard key={q} label={q} active={stats.sleep_quality === q}
                                                onClick={() => { const s = {...stats, sleep_quality:q}; setStats(s); runAnalysis(s); }} />
                                        ))}
                                    </div>
                                </section>
                            </div>
                            <div className="matrix-visualizer">
                                <div className="v10-card visualizer-card glass">
                                    <h3>Current Risk Profile</h3>
                                    <RiskMeter score={results?.burnout_risk?.score ?? 0}
                                        isCritical={results?.burnout_risk?.level === 'High'} />
                                    {results?.burnout_risk?.level === 'High' && (
                                        <div className="critical-warning">
                                            <span className="warning-text">Elevated Burnout Risk</span>
                                            <p style={{ fontSize:'0.8rem', opacity:0.7 }}>
                                                Guardian Protocol suggests immediate routine calibration.
                                            </p>
                                        </div>
                                    )}
                                    <button className="v10-btn yellow-btn" style={{ marginTop:'2rem', width:'100%' }}
                                        onClick={() => setView('routine')}>
                                        Calibrate Schedule →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── SCHEDULE GUARD ─── */}
                {view === 'routine' && (
                    <div className="v10-routine-view">
                        <div className="analysis-header">
                            <h1 className="bold-yellow-tagline small">Schedule Guard</h1>
                            <button className="back-btn-ghost" onClick={() => setView('home')}>← Hub</button>
                        </div>

                        <div className="schedule-subnav">
                            <button className={`subnav-pill ${scheduleMode==='daily'?'active':''}`}
                                onClick={() => setScheduleMode('daily')}>Daily Pulse</button>
                            <button className={`subnav-pill ${scheduleMode==='weekly'?'active':''}`}
                                onClick={() => { setScheduleMode('weekly'); loadWeekTrend(); }}>Weekly Horizon</button>
                        </div>

                        <div className="date-tracker">
                            <span className="date-label">{selectedDayLabel}</span>
                            {selectedDate === formatDate(new Date()) && <span className="today-badge">TODAY</span>}
                        </div>

                        {scheduleMode === 'weekly' && (
                            <div className="week-section">
                                <div className="week-grid">
                                    {weekDays.map(day => (
                                        <div key={day.date}
                                            className={`day-card ${day.isSelected?'selected':''} ${day.isToday?'today':''}`}
                                            onClick={() => { setSelectedDate(day.date); setScheduleMode('daily'); }}>
                                            <div className="day-name">{day.dayName}</div>
                                            <div className="day-date">{day.date.split('-')[2]}</div>
                                            <div className={`day-risk-dot ${day.risk>6.5?'high':day.risk>=4?'moderate':'healthy'}`}></div>
                                            <div className="day-hours">{day.hasSchedule ? `${day.workHours}h` : '—'}</div>
                                        </div>
                                    ))}
                                </div>
                                {weekTrend.length > 0 && (
                                    <section className="v10-card trend-card">
                                        <h3>7-Day Burnout Forecast</h3>
                                        <div className="week-trend-graph">
                                            <ResponsiveContainer width="100%" height={180}>
                                                <AreaChart data={weekTrend}>
                                                    <defs>
                                                        <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%"  stopColor="var(--bold-yellow)" stopOpacity={0.3}/>
                                                            <stop offset="95%" stopColor="var(--bold-yellow)" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                    <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} />
                                                    <YAxis domain={[0,10]} stroke="var(--text-muted)" fontSize={11} />
                                                    <Tooltip content={({ active, payload }) => {
                                                        if (active && payload?.length) {
                                                            const d = payload[0].payload;
                                                            return (
                                                                <div className="custom-tooltip">
                                                                    <p className="tooltip-title">{d.day} — {d.date}</p>
                                                                    <p className="tooltip-value">Risk: {d.risk}/10 | Work: {d.work_hours}h</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }} />
                                                    <Area type="monotone" dataKey="risk" stroke="var(--bold-yellow)"
                                                        fill="url(#riskGrad)" strokeWidth={2}
                                                        dot={{ fill:'var(--bold-yellow)', r:4 }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}

                        {scheduleMode === 'daily' && (
                            <div className="routine-layout">
                                <section className="v10-card routine-card">
                                    <div className="routine-header">
                                        <h3>Chronological Sequence</h3>
                                        <div className="add-group">
                                            <button className="v10-btn blue-btn"  onClick={() => addActivity(0)}>+ WORK</button>
                                            <button className="v10-btn slate-btn" onClick={() => addActivity(1)}>+ BUFFER</button>
                                        </div>
                                    </div>
                                    <div className="chain-list">
                                        {routine.map(t => (
                                            <div key={t.id}
                                                className={`chain-item ${t.type===0?'work-item':'break-item'} ${t.is_injected?'injected-break':''}`}>
                                                <div className="item-time">
                                                    <input type="time" value={t.start} readOnly className="time-input readonly" />
                                                    <span>→</span>
                                                    <input type="time" value={t.end}
                                                        onChange={(e) => handleTaskUpdate(t.id,'end',e.target.value)}
                                                        className="time-input" />
                                                </div>
                                                <input type="text" placeholder="Activity Title..."
                                                    value={t.title} onChange={(e) => handleTaskUpdate(t.id,'title',e.target.value)}
                                                    className="title-field" />
                                                {t.type === 1 && (
                                                    <button className="break-launch-btn" title="Start Break"
                                                        onClick={() => {
                                                            const matchedKey = Object.keys(EXERCISE_ID_MAP).find(k => t.title.includes(k));
                                                            setBreakExerciseId(matchedKey
                                                                ? EXERCISE_ID_MAP[matchedKey]
                                                                : ALL_EXERCISE_IDS[Math.floor(Math.random() * ALL_EXERCISE_IDS.length)]);
                                                            setView('break');
                                                        }}>▶</button>
                                                )}
                                                <button className="delete-btn"
                                                    onClick={() => setRoutine(routine.filter(item => item.id !== t.id))}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="v10-btn yellow-btn ripple-btn" onClick={runOptimization} disabled={isOptimizing}>
                                        {isOptimizing ? <span className="btn-spinner"></span> : 'Execute Guardian Optimization (Ripple Engine)'}
                                    </button>
                                </section>

                                <section className="v10-card graph-card">
                                    <h3>Visual Sequence Map</h3>
                                    <div className="graph-container">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={routineData} layout="vertical" margin={{ left:10, right:10 }}>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" hide />
                                                <Tooltip content={({ active, payload }) => {
                                                    if (active && payload?.length)
                                                        return (
                                                            <div className="custom-tooltip">
                                                                <p className="tooltip-title">{payload[0].payload.name}</p>
                                                                <p className="tooltip-value">{payload[0].value} mins</p>
                                                            </div>
                                                        );
                                                    return null;
                                                }} />
                                                <Bar dataKey="duration" radius={[0,4,4,0]}>
                                                    {routineData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`}
                                                            fill={entry.type===0 ? 'var(--guardian-blue)' : 'var(--bold-yellow)'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="graph-legend">
                                        <span><span className="dot work"></span> Work Block</span>
                                        <span><span className="dot break"></span> Recovery Buffer</span>
                                    </div>
                                    {weekTrend.length > 0 && (
                                        <div className="trend-section">
                                            <h4>Weekly Sustainability Trend</h4>
                                            <ResponsiveContainer width="100%" height={100}>
                                                <AreaChart data={weekTrend}>
                                                    <Area type="monotone" dataKey="risk"
                                                        stroke="var(--guardian-blue)" fill="rgba(67,97,238,0.1)" strokeWidth={2} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

// ── ROOT APP (Auth Context Provider) ──

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [isChecking, setIsChecking]   = useState(true);

    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/me`)
             .then(res => setCurrentUser(res.data))
             .catch(() => setCurrentUser(null))
             .finally(() => setIsChecking(false));
    }, []);

    const logout = async () => {
        try { await axios.post(`${BACKEND_URL}/api/logout`); } catch(e) {}
        setCurrentUser(null);
    };

    if (isChecking) return (
        <div className="v10-shell">
            <div className="slate-blue-backdrop"></div>
            <div style={{ display:'flex', justifyContent:'center', marginTop:'40vh' }}>
                <div className="btn-spinner"></div>
            </div>
        </div>
    );

    return (
        <UserContext.Provider value={{ currentUser, setCurrentUser, logout }}>
            <AppContent />
        </UserContext.Provider>
    );
}
