import React from 'react';
import { BarChart, Bar, Cell, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export default function DailyPulse({
    routine,
    routineData,
    addActivity,
    handleTaskUpdate,
    setRoutine,
    runOptimization,
    isOptimizing,
    setBreakExerciseId,
    setView
}) {
    const EXERCISE_ID_MAP = {
        'Bhramari':'bhramari', 'Box Breathing':'boxBreathing',
        'Physiological Sigh':'physioSigh', 'Stretch':'stretchTwist',
        'Tendon':'tendonGlide', 'Wall Angels':'wallAngels'
    };
    const ALL_EXERCISE_IDS = Object.values(EXERCISE_ID_MAP);

    return (
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
            </section>
        </div>
    );
}
