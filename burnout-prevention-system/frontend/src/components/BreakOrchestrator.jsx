import React, { useState, useEffect, useMemo } from 'react';

const EXERCISES = {
  bhramari:     { name: 'Bhramari (Bee Breath)',   image: '/exercises/Bhramari (Bee Breath).png',   activeDuration: 120 },
  boxBreathing: { name: 'Box Breathing',           image: '/exercises/Box Breathing.png',           activeDuration: 90  },
  physioSigh:   { name: 'Physiological Sigh',      image: '/exercises/physiological sigh.png',      activeDuration: 120 },
  stretchTwist: { name: "Stretch 'n' Twist",       image: "/exercises/Stretch 'n' Twist.png",       activeDuration: 150 },
  tendonGlide:  { name: 'Tendon Gliding',          image: '/exercises/Tendon Gliding.png',          activeDuration: 120 },
  wallAngels:   { name: 'Wall Angels',             image: '/exercises/Wall Angels.png',             activeDuration: 120 },
};

const BreakOrchestrator = ({ exerciseId, isPureRest, onComplete, onCancel }) => {
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [isActive, setIsActive] = useState(false);

  const exercise = useMemo(() => {
    if (isPureRest || !exerciseId) return null;
    return EXERCISES[exerciseId] || null;
  }, [exerciseId, isPureRest]);

  useEffect(() => {
    let interval = null;
    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => setTimeRemaining(p => p - 1), 1000);
    } else if (timeRemaining === 0) {
      clearInterval(interval);
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeRemaining]);

  const currentPhase = useMemo(() => {
    if (!exercise) return 'REST';
    if (timeRemaining > 255) return 'PREP';
    if (timeRemaining > 255 - exercise.activeDuration) return 'ACTIVE';
    return 'REST';
  }, [timeRemaining, exercise]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="break-orchestrator-overlay">
      <div className="break-container v10-card glass">
        <div className="break-header">
          <h2>{exercise ? exercise.name : 'Pure Rest Session'}</h2>
          <span className="phase-badge">{currentPhase}</span>
        </div>

        <div className="break-content">
          {currentPhase === 'REST' ? (
            <div className="rest-screen pulse-animation">
              <div className="rest-icon">🧘</div>
              <h3>Just Breathe</h3>
              <p>Mandatory recovery in progress. Let your mind drift.</p>
            </div>
          ) : (
            <div className="exercise-screen">
              <div className="image-container">
                <img src={exercise.image} alt={exercise.name} className="break-phase-image" />
              </div>
              <div className="instruction-text">
                {currentPhase === 'PREP'
                  ? <p>Get Ready: Clear your space and adjust your posture.</p>
                  : <p>Exercise in Progress: Follow the guide on the screen.</p>
                }
              </div>
            </div>
          )}
        </div>

        <div className="break-footer">
          <div className="timer-display">
            <svg className="timer-ring" viewBox="0 0 100 100">
              <circle className="timer-ring-bg" cx="50" cy="50" r="45" />
              <circle
                className="timer-ring-fill" cx="50" cy="50" r="45"
                style={{ strokeDashoffset: (45 * 2 * Math.PI) * (1 - timeRemaining / 300) }}
              />
            </svg>
            <span className="time-text">{formatTime(timeRemaining)}</span>
          </div>

          {!isActive && timeRemaining === 300 ? (
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="v10-btn slate-btn" onClick={onCancel} style={{ minWidth: '140px' }}>
                ← Cancel
              </button>
              <button className="v10-btn yellow-btn" onClick={() => setIsActive(true)} style={{ minWidth: '160px' }}>
                ▶ Start Recovery
              </button>
            </div>
          ) : (
            <button className="v10-btn slate-btn" disabled={timeRemaining > 0} onClick={onComplete}>
              {timeRemaining > 0 ? 'Session in Progress…' : 'Finish & Return'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BreakOrchestrator;
