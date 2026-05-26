import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function WeeklyHorizon({ weekDays, weekTrend, setSelectedDate, setScheduleMode }) {
    return (
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
    );
}
