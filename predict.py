"""
COGNITIVE GUARD — Prediction Engine
Risk assessment using JD-R model.
"""

def time_to_mins(t_str):
    h, m = map(int, t_str.split(':'))
    return h * 60 + m

def compute_risk(hours, sleep_cat='Average', mh='No', wlb=2):
    if hours < 40:
        score = (hours / 40 * 2) + 1
    elif hours <= 55:
        score = ((hours - 40) / 15 * 2) + 4
    else:
        score = min(10, ((hours - 55) / 25 * 3) + 7)
    if sleep_cat == "Poor": score += 2.0
    elif sleep_cat == "Average": score += 1.0
    if mh == 'No': score += 1.0
    elif mh == 'Yes': score -= 0.5
    return min(10, round(score, 1))

def compute_daily_risk_from_routine(routine):
    total_work_mins = sum(
        time_to_mins(t['end']) - time_to_mins(t['start'])
        for t in routine if t.get('type') == 0
        and time_to_mins(t['end']) - time_to_mins(t['start']) > 0
    )
    return compute_risk(total_work_mins / 60)
