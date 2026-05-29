import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Cell, Tooltip } from 'recharts';
import { Home, Activity, Calendar, LogOut, Bell, Shield, BellOff, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import bgImage from './bg-presentation.png';
import './App.css';
import BreakOrchestrator from './components/BreakOrchestrator';
import AuthPage from './components/AuthPage';
import { AuthProvider, useAuth } from './components/AuthContext';
import { useBreakNotifications } from './hooks/useBreakNotifications';


/**
 * COGNITIVE GUARD: SECURE PERFORMANCE MONITOR
 * PROTOCOL 17.0: JWT AUTH + MULTI-TEMPORAL ALIGNMENT
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const headers = { 'Content-Type': 'application/json' };

const formatDate = (d) => d.toISOString().split('T')[0];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekStart(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    dt.setDate(dt.getDate() - diff);
    return dt;
}

// --- SUB-COMPONENTS ---

const RiskMeter = ({ score, isCritical }) => {
    const radius = 70;
    const stroke = 10;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (score / 10) * circumference;
    const color = isCritical ? '#ef4444' : (score > 6.5 ? '#f59e0b' : (score > 4.5 ? '#facc15' : 'var(--primary-green)'));

    return (
        <div className="risk-meter-container">
            <svg height={radius * 2} width={radius * 2}>
                <circle stroke="rgba(40, 57, 108, 0.1)" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
                <circle stroke={color} fill="transparent" strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s' }}
                    strokeWidth={stroke} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} />
            </svg>
            <div className="meter-content">
                <span className="meter-score" style={{ color: 'var(--deep-navy)' }}>{score}</span>
                <span className="meter-label">{isCritical ? 'DANGER' : 'INDEX'}</span>
            </div>
        </div>
    );
};

const CustomSlider = ({ label, min, max, value, onChange, onDragEnd, unit = "" }) => {
    return (
        <div className="slider-unit" style={{marginBottom: '1rem'}}>
            <label style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--deep-navy)'}}>
                <span>{label}</span>
                <span>{value}{unit}</span>
            </label>
            <input type="range" min={min} max={max} value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                onMouseUp={onDragEnd} onTouchEnd={onDragEnd}
                style={{width: '100%', accentColor: 'var(--deep-navy)'}} />
        </div>
    );
};

const ToggleCard = ({ label, active, onClick }) => (
    <div style={{
        flex: 1, padding: '0.8rem 1rem', borderRadius: '0.75rem', cursor: 'pointer',
        border: `1px solid ${active ? 'var(--deep-navy)' : 'var(--border-light)'}`,
        background: active ? 'var(--bg-pale)' : 'var(--white)',
        color: 'var(--deep-navy)', fontWeight: 600, textAlign: 'center', transition: 'all 0.2s', fontSize: '0.9rem'
    }} onClick={onClick}>
        {label}
    </div>
);

// --- MAIN APP CONTENT ---

function AppContent() {
    const { currentUser, logout } = useAuth();
    const [view, setView] = useState('home');
    const [notification, setNotification] = useState(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [breakExerciseId, setBreakExerciseId] = useState(null);
    const [notifEnabled, setNotifEnabled] = useState(false);


    // Analysis state
    const [stats, setStats] = useState({
        hours_worked: currentUser?.target_hours || 40, mh_resources: 'No', wlb_rating: 2, isolation: 1, sleep_quality: currentUser?.avg_sleep || 'Average'
    });
    const [results, setResults] = useState(null);

    // Schedule state
    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
    const [scheduleMode, setScheduleMode] = useState('daily'); // 'daily' | 'weekly'
    const [routine, setRoutine] = useState([
        { id: 't1', start: '09:00', end: '11:00', type: 0, title: 'Strategic Planning' },
        { id: 't2', start: '11:00', end: '11:15', type: 1, title: 'Guardian Recovery Break' },
        { id: 't3', start: '11:15', end: '13:00', type: 0, title: 'Deep Work' }
    ]);
    const [weekTrend, setWeekTrend] = useState([]);

    // --- HELPERS ---
    const showNotification = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 5000); };
    const handleStatChange = (key, val) => setStats(p => ({ ...p, [key]: val }));

    const handleLogout = () => { logout(); };

    // ── Notification hook (polls /api/schedule every 60s) ──
    const { requestPermission, startGuardian } = useBreakNotifications(routine, notifEnabled);

    const toggleNotifications = async () => {
        if (!notifEnabled) {
            // Use startGuardian: requests permission (user gesture), verifies SW, sends test alert
            const result = await startGuardian();
            if (result.success) {
                setNotifEnabled(true);
                showNotification('🔔 Guardian Active — you will be alerted 15 min before each break.');
            } else {
                alert(
                    'Notifications are blocked by your browser.\n\n' +
                    'Fix: Click the 🔒 lock icon in the address bar → Site Settings → Allow Notifications.'
                );
            }
        } else {
            setNotifEnabled(false);
            showNotification('🔕 Break alerts paused.');
        }
    };

    // --- API CALLS ---
    const runAnalysis = async (updatedStats = null) => {
        if (!currentUser) return;
        try {
            const payload = { schedule: routine, ...(updatedStats || stats) };
            const response = await axios.post(`${BACKEND_URL}/api/predict`, payload, { headers });
            setResults(response.data);
        } catch (err) { console.error("System Sync Error:", err); }
    };

    const runOptimization = async () => {
        try {
            setIsOptimizing(true);
            const rData = { schedule: routine };
            const { data } = await axios.post(`${BACKEND_URL}/api/optimize`, rData, { headers });
            if (data.optimized_schedule) setRoutine(data.optimized_schedule);
            await loadWeekTrend();
        } catch (e) {
            console.error(e);
        } finally {
            setIsOptimizing(false);
            showNotification('DigiFatigueBeaters: Schedule Optimization Complete');
        }
    };

    const swapBreak = async (taskId) => {
        try {
            const { data } = await axios.get(import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/swap-break` : 'http://localhost:5000/api/swap-break', { headers });
            if (data.new_break_title) {
                setRoutine(prev => prev.map(t => t.id === taskId ? { ...t, title: data.new_break_title } : t));
            }
        } catch (e) {
            console.error("Swap break failed", e);
        }
    };

    const saveRoutineToServer = useCallback(async (routineToSave) => {
        if (!currentUser) return;
        try {
            await axios.post(`${BACKEND_URL}/api/routine`, {
                date: selectedDate, schedule: routineToSave
            }, { headers });
        } catch (err) { console.error("Save error:", err); }
    }, [currentUser, selectedDate]);

    const loadRoutineFromServer = useCallback(async (date) => {
        if (!currentUser) return;
        try {
            const res = await axios.get(`${BACKEND_URL}/api/routine`, {
                params: { date }
            });
            if (res.data.routine && res.data.routine.length > 0) {
                setRoutine([...res.data.routine]);
            } else {
                setRoutine([
                    { id: `new_${Date.now()}`, start: '09:00', end: '10:00', type: 0, title: '' }
                ]);
            }
        } catch (err) { console.error("Load error:", err); }
    }, [currentUser]);

    const loadWeekTrend = useCallback(async () => {
        if (!currentUser) return;
        try {
            const weekStart = formatDate(getWeekStart(new Date(selectedDate)));
            const res = await axios.get(`${BACKEND_URL}/api/weekly-trend`, {
                params: { start: weekStart }
            });
            setWeekTrend(res.data.trend || []);
        } catch (err) { console.error("Trend error:", err); }
    }, [currentUser, selectedDate]);

    // --- ROUTINE ACTIONS ---
    const addActivity = (typeCode) => {
        const lastTask = routine[routine.length - 1];
        const nextStart = lastTask ? lastTask.end : '09:00';
        const [h, m] = nextStart.split(':').map(Number);
        const endH = Math.min(23, h + 1).toString().padStart(2, '0');
        const nextEnd = `${endH}:${m.toString().padStart(2, '0')}`;
        setRoutine([...routine, {
            id: `usr_${Date.now()}`, start: nextStart, end: nextEnd, type: typeCode, title: ''
        }]);
    };

    const handleTaskUpdate = (id, field, val) => {
        setRoutine(prev => {
            const index = prev.findIndex(t => t.id === id);
            if (index === -1) return prev;
            const newTasks = [...prev];
            newTasks[index] = { ...newTasks[index], [field]: val };
            if (field === 'end' && index < newTasks.length - 1) {
                newTasks[index + 1] = { ...newTasks[index + 1], start: val };
            }
            return newTasks;
        });
    };

    // --- EFFECTS ---
    // Redirect to login view if not authenticated
    useEffect(() => {
        if (!currentUser) {
            setView('login');
        } else if (view === 'login') {
            setView('home');
        }
    }, [currentUser]);

    useEffect(() => { if (currentUser && view === 'home') runAnalysis(); }, [currentUser, view]);

    useEffect(() => {
        if (currentUser && view === 'routine') {
            loadRoutineFromServer(selectedDate);
            loadWeekTrend();
        }
    }, [currentUser, view, selectedDate]);

    // Auto-save routine on changes (debounced)
    useEffect(() => {
        if (!currentUser || view !== 'routine') return;
        const timer = setTimeout(() => { saveRoutineToServer(routine); }, 1500);
        return () => clearTimeout(timer);
    }, [routine, currentUser, view]);

    // Graph data
    const routineData = useMemo(() => {
        return routine.map(t => {
            const [sh, sm] = t.start.split(':').map(Number);
            const [eh, em] = t.end.split(':').map(Number);
            let duration = (eh * 60 + em) - (sh * 60 + sm);
            if (duration < 0) duration += 24 * 60;
            return { name: t.title || (t.type === 0 ? 'Work' : 'Break'), duration: duration > 0 ? duration : 30, type: t.type };
        });
    }, [routine]);

    // Week grid data
    const weekDays = useMemo(() => {
        const start = getWeekStart(new Date(selectedDate));
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateStr = formatDate(d);
            const trendDay = weekTrend.find(t => t.date === dateStr);
            return {
                date: dateStr,
                dayName: DAY_NAMES[d.getDay()],
                dayFull: DAY_FULL[d.getDay()],
                isSelected: dateStr === selectedDate,
                isToday: dateStr === formatDate(new Date()),
                risk: trendDay?.risk ?? 3.0,
                workHours: trendDay?.work_hours ?? 0,
                hasSchedule: trendDay?.has_schedule ?? false
            };
        });
    }, [selectedDate, weekTrend]);

    const selectedDayLabel = useMemo(() => {
        const d = new Date(selectedDate + 'T00:00:00');
        return `${DAY_FULL[d.getDay()]}, ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }, [selectedDate]);

    // --- RENDER ---
    return (
        <div className={`wellness-app-container ${view === 'analysis' || view === 'routine' ? 'aura-container' : ''}`}>

            {notification && <div className="wellness-toast">{notification}</div>}

            {view === 'break' && (
                <BreakOrchestrator 
                    exerciseId={breakExerciseId} 
                    onComplete={() => {
                        setView('routine');
                        setBreakExerciseId(null);
                    }}
                    onCancel={() => {
                        setView('routine');
                        setBreakExerciseId(null);
                    }}
                    onSwap={async () => {
                        try {
                            const { data } = await axios.get(import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/swap-break` : 'http://localhost:5000/api/swap-break', authHeader());
                            if (data.new_break_title) {
                                // Find generic break ID format
                                const idMap = { 'Bhramari': 'bhramari', 'Box Breathing': 'boxBreathing', 'Physiological Sigh': 'physioSigh', 'Stretch': 'stretchTwist', 'Tendon': 'tendonGlide', 'Wall Angels': 'wallAngels' };
                                const matchedId = Object.keys(idMap).find(k => data.new_break_title.includes(k));
                                if (matchedId) setBreakExerciseId(idMap[matchedId]);
                            }
                        } catch(e) {}
                    }}
                />
            )}

            {currentUser && view !== 'login' && view !== 'break' && (
                <nav className="wellness-top-nav">
                    <div className="wellness-brand" style={{margin: 0}}>
                        <ShieldCheck size={28} color="var(--white)" />
                        <h1 style={{fontFamily: 'Tenor Sans', fontSize: '1.5rem'}}>DigiFatigueBeaters</h1>
                    </div>
                    
                    <div className="wellness-nav">
                        <button className={`nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
                            <Home size={18} /> Home
                        </button>
                        <button className={`nav-item ${view === 'analysis' ? 'active' : ''}`} onClick={() => setView('analysis')}>
                            <Activity size={18} /> Risk Analysis
                        </button>
                        <button className={`nav-item ${view === 'routine' ? 'active' : ''}`} onClick={() => setView('routine')}>
                            <Calendar size={18} /> Schedule Guard
                        </button>
                    </div>

                    <div style={{display: 'flex', gap: '1rem'}}>
                        <button
                            id="start-guardian-btn"
                            className={`notif-toggle-btn ${notifEnabled ? 'notif-on' : ''}`}
                            style={{marginBottom: 0}}
                            onClick={toggleNotifications}
                            title={notifEnabled ? 'Break alerts ON — click to disable' : 'Click to activate Guardian alerts'}
                        >
                            {notifEnabled ? <Bell size={18} /> : <Shield size={18} />}
                            {notifEnabled ? 'Alerts ON' : 'Start Guardian'}
                        </button>
                        <button className="logout-btn" onClick={handleLogout} style={{marginBottom: 0}}>
                            <LogOut size={18} /> Sign out
                        </button>
                    </div>
                </nav>
            )}

            <main className={`wellness-main ${(view === 'analysis' || view === 'routine') ? 'w-full max-w-[1400px] mx-auto px-8 md:px-12 py-8' : ''}`} style={(view === 'home' || view === 'login') ? {background: `url(${bgImage}) no-repeat center center/cover`, backgroundAttachment: 'fixed', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column'} : {}}>
                {view === 'login' && (
                    <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <AuthPage />
                    </div>
                )}

                {view === 'home' && (
                    <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--deep-navy)', textAlign: 'center'}}>
                        <div style={{background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: '3rem', borderRadius: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.1)'}}>
                            <h1 style={{fontSize: '4rem', fontFamily: 'Tenor Sans', marginBottom: '0.5rem', fontWeight: 600}}>DigiFatigueBeaters</h1>
                            <p style={{fontSize: '1.5rem', fontFamily: 'Montserrat', color: 'var(--deep-navy)', opacity: 0.8}}>Hello! what tasks await you today?</p>
                        </div>
                    </div>
                )}

                {view === 'analysis' && (
                    <div className="dashboard-view">
                        <div className="dashboard-header">
                            <h2>Sustainability Matrix</h2>
                            <button className="nav-item" style={{display: 'inline-flex', width: 'auto', padding: '0.2rem 0'}} onClick={() => setView('home')}>← Back to Hub</button>
                        </div>

                        <div className="bento-grid">
                            <motion.div initial={{opacity: 0, y: 30}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5}} className="bento-card col-span-8">
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
                            </motion.div>

                            <motion.div initial={{opacity: 0, y: 30}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, delay: 0.1}} className="bento-card col-span-4" style={{background: 'rgba(255,255,255,0.7)'}}>
                                <h3>Current Risk Profile</h3>
                                <RiskMeter score={results?.burnout_risk?.score ?? 0} isCritical={results?.burnout_risk?.level === 'High'} />
                                {results?.burnout_risk?.level === 'High' && (
                                    <div style={{color: '#ef4444', textAlign: 'center', fontWeight: 'bold', marginBottom: '1rem'}}>
                                        Elevated Burnout Risk
                                        <p style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'rgba(40,57,108,0.7)' }}>Guardian Protocol suggests immediate routine calibration.</p>
                                    </div>
                                )}
                                <button className="btn-primary" style={{ marginTop: 'auto', width: '100%' }} onClick={() => setView('routine')}>
                                    Calibrate Schedule →
                                </button>
                            </motion.div>

                            <motion.div initial={{opacity: 0, y: 30}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, delay: 0.2}} className="bento-card col-span-12">
                                <h3>Resource Availability</h3>
                                <div style={{display: 'flex', gap: '2rem'}}>
                                    <div style={{flex: 1}}>
                                        <div style={{fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem'}}>Mental Health Support</div>
                                        <div style={{display: 'flex', gap: '1rem'}}>
                                            <ToggleCard label="Insecure (No)" active={stats.mh_resources === 'No'} onClick={() => { const s = { ...stats, mh_resources: 'No' }; setStats(s); runAnalysis(s); }} />
                                            <ToggleCard label="Secure (Yes)" active={stats.mh_resources === 'Yes'} onClick={() => { const s = { ...stats, mh_resources: 'Yes' }; setStats(s); runAnalysis(s); }} />
                                        </div>
                                    </div>
                                    <div style={{flex: 1}}>
                                        <div style={{fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem'}}>Sleep Quality</div>
                                        <div style={{display: 'flex', gap: '1rem'}}>
                                            {['Poor', 'Average', 'Good'].map(q => (
                                                <ToggleCard key={q} label={q} active={stats.sleep_quality === q}
                                                    onClick={() => { const s = { ...stats, sleep_quality: q }; setStats(s); runAnalysis(s); }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}

                {view === 'routine' && (
                    <div className="dashboard-view">
                        <div className="dashboard-header">
                            <h2>Schedule Guard</h2>
                            <button className="nav-item" style={{display: 'inline-flex', width: 'auto', padding: '0.2rem 0'}} onClick={() => setView('home')}>← Back to Hub</button>
                        </div>

                        {/* SUB-NAVIGATION */}
                        <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem'}}>
                            <button className="btn-primary" style={{background: scheduleMode === 'daily' ? 'var(--deep-navy)' : 'transparent', color: scheduleMode === 'daily' ? 'white' : 'var(--deep-navy)', border: '1px solid var(--deep-navy)'}}
                                onClick={() => setScheduleMode('daily')}>
                                Daily Pulse
                            </button>
                            <button className="btn-primary" style={{background: scheduleMode === 'weekly' ? 'var(--deep-navy)' : 'transparent', color: scheduleMode === 'weekly' ? 'white' : 'var(--deep-navy)', border: '1px solid var(--deep-navy)'}}
                                onClick={() => { setScheduleMode('weekly'); loadWeekTrend(); }}>
                                Weekly Horizon
                            </button>
                        </div>

                        {/* DATE TRACKER */}
                        <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem'}}>
                            <span style={{fontSize: '1.2rem', fontWeight: 600}}>{selectedDayLabel}</span>
                            {selectedDate === formatDate(new Date()) && <span style={{background: 'var(--primary-green)', padding: '2px 8px', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 'bold'}}>TODAY</span>}
                        </div>

                        {/* WEEKLY HORIZON VIEW */}
                        {scheduleMode === 'weekly' && (
                            <div className="bento-grid">
                                <motion.div initial={{opacity: 0, y: 30}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5}} className="bento-card col-span-12">
                                    <h3>Weekly Overview</h3>
                                    <div style={{display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem'}}>
                                        {weekDays.map(day => (
                                            <div key={day.date}
                                                style={{flex: 1, minWidth: '120px', padding: '1.5rem', borderRadius: '1rem', border: day.isSelected ? '2px solid var(--deep-navy)' : '1px solid var(--border-light)', background: day.isToday ? 'var(--bg-pale)' : 'var(--white)', cursor: 'pointer'}}
                                                onClick={() => { setSelectedDate(day.date); setScheduleMode('daily'); }}>
                                                <div style={{fontWeight: 600, fontSize: '0.9rem', opacity: 0.7}}>{day.dayName}</div>
                                                <div style={{fontSize: '1.8rem', fontFamily: 'Tenor Sans', margin: '0.5rem 0'}}>{day.date.split('-')[2]}</div>
                                                <div style={{fontSize: '0.9rem'}}>Risk: <span style={{fontWeight: 'bold', color: day.risk > 6.5 ? '#ef4444' : day.risk >= 4 ? '#f59e0b' : 'var(--primary-green)'}}>{day.risk}</span></div>
                                                <div style={{fontSize: '0.8rem', opacity: 0.7}}>{day.hasSchedule ? `${day.workHours}h work` : '—'}</div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>

                                {/* 7-DAY TREND GRAPH */}
                                {weekTrend.length > 0 && (
                                    <motion.div initial={{opacity: 0, y: 30}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, delay: 0.1}} className="bento-card col-span-12">
                                        <h3>7-Day Burnout Forecast</h3>
                                        <div style={{width: '100%', height: '250px'}}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={weekTrend} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="day" />
                                                    <YAxis domain={[0, 10]} />
                                                    <Tooltip />
                                                    <Area type="monotone" dataKey="risk" stroke="var(--deep-navy)" fill="var(--bg-pale)" strokeWidth={3} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        )}

                        {/* DAILY PULSE VIEW */}
                        {scheduleMode === 'daily' && (
                            <div className="bento-grid">
                                <motion.div initial={{opacity: 0, y: 30}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5}} className="bento-card col-span-8">
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                                        <h3 style={{margin: 0}}>Chronological Sequence</h3>
                                        <div style={{display: 'flex', gap: '0.5rem'}}>
                                            <button className="btn-primary" style={{padding: '0.4rem 1rem', fontSize: '0.85rem'}} onClick={() => addActivity(0)}>+ WORK</button>
                                            <button className="btn-primary" style={{padding: '0.4rem 1rem', fontSize: '0.85rem', background: 'var(--warm-pink)'}} onClick={() => addActivity(1)}>+ BUFFER</button>
                                        </div>
                                    </div>
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                                        {routine.map((t) => (
                                            <div key={t.id} style={{display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', borderRadius: '1rem', background: t.type === 0 ? 'rgba(40,57,108,0.03)' : 'var(--warm-pink)'}}>
                                                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                                    <input type="time" value={t.start} readOnly style={{border: 'none', background: 'transparent', width: '70px', fontWeight: 600, color: 'var(--deep-navy)', outline: 'none'}} />
                                                    <ArrowRight size={14} opacity={0.5} />
                                                    <input type="time" value={t.end} onChange={(e) => handleTaskUpdate(t.id, 'end', e.target.value)} style={{border: 'none', background: 'white', padding: '0.2rem', borderRadius: '4px', width: '80px', outline: 'none', color: 'var(--deep-navy)'}} />
                                                </div>
                                                <input type="text" placeholder="Activity Title..." value={t.title}
                                                    onChange={(e) => handleTaskUpdate(t.id, 'title', e.target.value)} style={{flex: 1, border: 'none', background: 'transparent', fontSize: '1rem', color: 'var(--deep-navy)', outline: 'none', borderBottom: '1px solid var(--border-light)'}} />
                                                
                                                {t.type === 1 && (
                                                    <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                                                        <button style={{background: 'transparent', color: 'var(--deep-navy)', border: 'none', cursor: 'pointer', padding: 0}} onClick={() => swapBreak(t.id)} title="Swap Break Exercise">
                                                            <RefreshCw size={18} />
                                                        </button>
                                                        <button style={{background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}} title="Start Break Simulation" onClick={() => {
                                                        const idMap = {
                                                            'Bhramari': 'bhramari',
                                                            'Box Breathing': 'boxBreathing',
                                                            'Physiological Sigh': 'physioSigh',
                                                            'Stretch': 'stretchTwist',
                                                            'Tendon': 'tendonGlide',
                                                            'Wall Angels': 'wallAngels'
                                                        };
                                                        const allIds = Object.values(idMap);
                                                        const matchedId = Object.keys(idMap).find(k => t.title.includes(k));
                                                        const exerciseId = matchedId ? idMap[matchedId] : allIds[Math.floor(Math.random() * allIds.length)];
                                                        setBreakExerciseId(exerciseId);
                                                        setView('break');
                                                    }}>▶</button>
                                                    </div>
                                                )}
                                                <button style={{background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.5rem', cursor: 'pointer', opacity: 0.5}} onClick={() => setRoutine(routine.filter(item => item.id !== t.id))}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="btn-primary" style={{marginTop: '2rem', width: '100%', background: 'var(--deep-navy)', color: 'var(--white)'}} onClick={runOptimization} disabled={isOptimizing}>
                                        {isOptimizing ? 'Optimizing...' : 'Execute Guardian Optimization'}
                                    </button>
                                </motion.div>

                                <motion.div initial={{opacity: 0, y: 30}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, delay: 0.1}} className="bento-card col-span-4" style={{display: 'flex', flexDirection: 'column'}}>
                                    <h3>Visual Sequence Map</h3>
                                    <div style={{flex: 1, minHeight: '300px'}}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={routineData} layout="vertical" margin={{ left: -20, right: 10 }}>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" hide />
                                                <Tooltip />
                                                <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                                                    {routineData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.type === 0 ? 'var(--deep-navy)' : 'var(--warm-pink)'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem', fontSize: '0.9rem', fontWeight: 600}}>
                                        <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}><div style={{width: 12, height: 12, borderRadius: '50%', background: 'var(--deep-navy)'}}></div> Work Block</span>
                                        <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}><div style={{width: 12, height: 12, borderRadius: '50%', background: 'var(--warm-pink)'}}></div> Recovery Buffer</span>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppInner />
        </AuthProvider>
    );
}

function AppInner() {
    const { isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="v10-shell">
                <div className="slate-blue-backdrop"></div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40vh' }}>
                    <div className="btn-spinner"></div>
                </div>
            </div>
        );
    }

    return <AppContent />;
}
