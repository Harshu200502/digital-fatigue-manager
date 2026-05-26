import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import axios from 'axios';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import './index.css';
import BreakOrchestrator from './components/BreakOrchestrator';
import Guardian from './components/Guardian';
import DailyPulse from './components/DailyPulse';
import WeeklyHorizon from './components/WeeklyHorizon';

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
                    <Guardian
                        stats={stats}
                        handleStatChange={handleStatChange}
                        runAnalysis={runAnalysis}
                        results={results}
                        setView={setView}
                    />
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
                            <WeeklyHorizon
                                weekDays={weekDays}
                                weekTrend={weekTrend}
                                setSelectedDate={setSelectedDate}
                                setScheduleMode={setScheduleMode}
                            />
                        )}

                        {scheduleMode === 'daily' && (
                            <DailyPulse
                                routine={routine}
                                routineData={routineData}
                                addActivity={addActivity}
                                handleTaskUpdate={handleTaskUpdate}
                                setRoutine={setRoutine}
                                runOptimization={runOptimization}
                                isOptimizing={isOptimizing}
                                setBreakExerciseId={setBreakExerciseId}
                                setView={setView}
                            />
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

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
