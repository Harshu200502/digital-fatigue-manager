import re
from datetime import datetime, timedelta
try:
    from db import get_recent_risk_levels
except ImportError:
    # Fallback for when running directly or in different context
    def get_recent_risk_levels(count): return []

# Intervention Library Categories
INTERVENTION_LIBRARY = {
    'physical': ['5-min Desk Stretch', 'Eye Rest / 20-20-20 Rule'],
    'social': ['Drop a thank-you message to a peer', 'Quick 5-min coffee sync'],
    'recovery': ['Set a hard-stop boundary for 6 PM', '10-min Power Nap/Rest', '🧘 Breathing Exercises'],
    'escalated': ['🛑 RECOMMENDED: Personal Day / Half-Day Off']
}

def analyze_schedule(schedule_data, features):
    """
    Scans a schedule for gaps and injects context-aware interventions.
    Returns (modified_schedule, reason)
    """
    if not schedule_data:
        return [], "No schedule provided"

    # Determine primary risk driver and intervention category
    workload = features.get('workload', 8) / 14.0 # Normalize to 0-1
    social_support = features.get('social_support', 50) / 100.0
    wlb = features.get('wlb', 50) / 100.0

    # 1. Check for Trend Escalation (3 consecutive Moderate/High)
    recent_risks = get_recent_risk_levels(3)
    is_trend_critical = len(recent_risks) >= 3 and all(r in ['Moderate', 'High'] for r in recent_risks)

    if is_trend_critical:
        category = 'escalated'
        reason = "CRITICAL TREND: Persistent high-risk state detected across multiple sessions."
    elif workload > 0.7:
        category = 'physical'
        reason = "DYNAMIC INTERVENTION: Scaling physical recovery due to high intensity workload."
    elif social_support < 0.4:
        category = 'social'
        reason = "CONTEXTUAL SYNC: Prioritizing social connectivity to counter isolation risk."
    else:
        category = 'recovery'
        reason = "PROACTIVE BALANCE: Routine energy preservation protocol."

    interventions = INTERVENTION_LIBRARY[category]
    
    # Sort schedule by start time
    sorted_schedule = sorted(schedule_data, key=lambda x: x['start'])
    
    modified_schedule = []
    
    # ITERATIVE INTERVENTION MAPPING (SCALES TO ANY N TASKS)
    for i in range(len(sorted_schedule)):
        current_event = sorted_schedule[i]
        modified_schedule.append(current_event)
        
        # If there's a next task, check for a gap
        if i < len(sorted_schedule) - 1:
            next_event = sorted_schedule[i+1]
            
            try:
                current_end = datetime.strptime(current_event['end'], "%H:%M")
                next_start = datetime.strptime(next_event['start'], "%H:%M")
                
                gap = next_start - current_end
                
                # SENSITIVITY ADJUSTMENT:
                # If workload is high (>0.6), we trigger interventions for gaps as small as 5 mins
                # Otherwise, stick to 15 mins.
                threshold = 5 if workload > 0.6 else 15
                
                if gap >= timedelta(minutes=threshold):
                    # Inject intervention
                    duration = min(15, int(gap.total_seconds() / 120)) # Max 15 mins, or half the gap
                    if duration < 5: duration = 5 # Min 5 mins
                    
                    exercise_start = current_end + (gap - timedelta(minutes=duration)) / 2
                    exercise_end = exercise_start + timedelta(minutes=duration)
                    
                    # Cycle through available interventions to ensure diversity
                    selected_task = interventions[i % len(interventions)]
                    
                    modified_schedule.append({
                        'title': f"{selected_task} (AI Exercise)",
                        'start': exercise_start.strftime("%H:%M"),
                        'end': exercise_end.strftime("%H:%M"),
                        'type': 'prevention'
                    })
            except Exception as e:
                print(f"Intervention skip on task {i}: {e}")
                continue
                
    return modified_schedule, reason

