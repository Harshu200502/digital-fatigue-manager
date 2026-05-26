import React, { useState, useEffect, useMemo } from 'react';

const EXERCISES = {
  bhramari: { name: 'Bhramari (Bee Breath)', image: '/exercises/Bhramari (Bee Breath).png', activeDuration: 120 },
  boxBreathing: { name: 'Box Breathing', image: '/exercises/Box Breathing.png', activeDuration: 90 },
  physioSigh: { name: 'Physiological Sigh', image: '/exercises/physiological sigh.png', activeDuration: 120 },
  stretchTwist: { name: "Stretch 'n' Twist", image: "/exercises/Stretch 'n' Twist.png", activeDuration: 150 },
  tendonGlide: { name: 'Tendon Gliding', image: '/exercises/Tendon Gliding.png', activeDuration: 120 },
  wallAngels: { name: 'Wall Angels', image: '/exercises/Wall Angels.png', activeDuration: 120 },
};

const BreakOrchestrator = ({ exerciseId, isPureRest, onComplete, onCancel, onSwap }) => {
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes total
  const [isActive, setIsActive] = useState(false);

  const exercise = useMemo(() => {
    if (isPureRest || !exerciseId) return null;
    return EXERCISES[exerciseId] || null;
  }, [exerciseId, isPureRest]);

  useEffect(() => {
    let interval = null;
    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0) {
      clearInterval(interval);
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeRemaining]);

  const currentPhase = useMemo(() => {
    if (!exercise) return 'REST';
    if (timeRemaining > 255) return 'PREP'; // 45s prep
    if (timeRemaining > 255 - exercise.activeDuration) return 'ACTIVE';
    return 'REST';
  }, [timeRemaining, exercise]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => setIsActive(true);

  return (
    <div className="break-orchestrator-overlay" style={{minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', padding: '2rem'}}>
      <div className="break-container" style={{maxWidth: '56rem', margin: '0 auto', background: 'rgba(255,255,255,0.7)', padding: '3rem', borderRadius: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', width: '100%', display: 'flex', flexDirection: 'column'}}>
        <div className="break-header" style={{textAlign: 'center', marginBottom: '2rem'}}>
          <h2 style={{fontSize: '2.25rem', lineHeight: '2.5rem', fontFamily: 'Tenor Sans', color: 'var(--deep-navy)', marginBottom: '0.5rem'}}>{exercise ? exercise.name : 'Pure Rest Session'}</h2>
          <span className="phase-badge" style={{background: 'var(--deep-navy)', color: 'white', padding: '0.2rem 1rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase'}}>{currentPhase}</span>
        </div>

        <div className="break-content" style={{flex: 1}}>
          {currentPhase === 'REST' ? (
            <div className="rest-screen pulse-animation" style={{textAlign: 'center', padding: '3rem 0'}}>
              <div className="rest-icon" style={{fontSize: '4rem', marginBottom: '1rem'}}>🧘</div>
              <h3 style={{fontSize: '1.5rem', fontFamily: 'Tenor Sans', color: 'var(--deep-navy)'}}>Just Breathe</h3>
              <p style={{fontSize: '1.125rem', color: 'var(--deep-navy)', opacity: 0.8, fontFamily: 'Montserrat'}}>Mandatory recovery in progress. Let your mind drift.</p>
            </div>
          ) : (
            <div className="exercise-screen" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <div className="image-container" style={{marginBottom: '1.5rem', width: '100%', display: 'flex', justifyContent: 'center'}}>
                <img src={exercise.image} alt={exercise.name} className="break-phase-image" style={{maxHeight: '400px', objectFit: 'contain', borderRadius: '1rem'}} />
              </div>
              <div className="instruction-text" style={{textAlign: 'center'}}>
                {currentPhase === 'PREP' ? (
                  <p style={{fontSize: '1.125rem', fontFamily: 'Montserrat', color: 'var(--deep-navy)', fontWeight: 500}}>Get Ready: Clear your space and adjust your posture.</p>
                ) : (
                  <p style={{fontSize: '1.125rem', fontFamily: 'Montserrat', color: 'var(--deep-navy)', fontWeight: 500}}>Exercise in Progress: Follow the guide on the screen.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="break-footer" style={{marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem'}}>
          <div className="timer-display" style={{position: 'relative', width: '120px', height: '120px'}}>
            <svg className="timer-ring" viewBox="0 0 100 100" width={120} height={120}>
              <circle className="timer-ring-bg" cx="50" cy="50" r="45" fill="transparent" stroke="rgba(40,57,108,0.1)" strokeWidth="6" />
              <circle
                className="timer-ring-fill"
                cx="50"
                cy="50"
                r="45"
                fill="transparent"
                stroke="var(--primary-green)"
                strokeWidth="6"
                strokeLinecap="round"
                style={{ strokeDasharray: 283, strokeDashoffset: (283) * (1 - timeRemaining / 300), transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <span className="time-text" style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--deep-navy)', fontFamily: 'Montserrat'}}>{formatTime(timeRemaining)}</span>
          </div>

          <div className="break-controls" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', fontFamily: 'Montserrat' }}>
            <button 
              onClick={handleStart} 
              style={{ background: 'var(--deep-navy)', color: 'white', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '2rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}
              disabled={isActive && timeRemaining > 0}
            >
              Start
            </button>
            <button 
              onClick={() => setIsActive(false)} 
              style={{ background: 'var(--deep-navy)', color: 'white', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '2rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}
              disabled={!isActive || timeRemaining === 0}
            >
              Pause
            </button>
            <button 
              onClick={onSwap} 
              style={{ background: 'var(--deep-navy)', color: 'white', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '2rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}
            >
              Swap Break
            </button>
            <button 
              onClick={() => {
                if (timeRemaining > 0) onCancel();
                else onComplete();
              }} 
              style={{ background: 'var(--deep-navy)', color: 'white', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '2rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}
            >
              Cancel Break
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreakOrchestrator;
