import React from 'react';

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

export default function Guardian({ stats, handleStatChange, runAnalysis, results, setView }) {
    return (
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
                                onClick={() => { const s = {...stats, mh_resources:'No'}; handleStatChange('mh_resources', 'No'); runAnalysis(s); }} />
                            <ToggleCard label="Secure (Yes)" active={stats.mh_resources === 'Yes'}
                                onClick={() => { const s = {...stats, mh_resources:'Yes'}; handleStatChange('mh_resources', 'Yes'); runAnalysis(s); }} />
                        </div>
                        <div className="toggle-group-label" style={{ marginTop:'2rem' }}>Sleep Quality</div>
                        <div className="toggle-column">
                            {['Poor','Average','Good'].map(q => (
                                <ToggleCard key={q} label={q} active={stats.sleep_quality === q}
                                    onClick={() => { const s = {...stats, sleep_quality:q}; handleStatChange('sleep_quality', q); runAnalysis(s); }} />
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
    );
}
