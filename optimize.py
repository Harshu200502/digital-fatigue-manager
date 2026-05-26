"""
COGNITIVE GUARD — Optimization Engine
Tiered break injection (cognitive fatigue model).
"""

def time_to_mins(t_str):
    h, m = map(int, t_str.split(':'))
    return h * 60 + m

def mins_to_time(m):
    m = m % (24 * 60)
    return f"{m // 60:02d}:{m % 60:02d}"

def optimize_schedule(routine):
    """
    Tiered break injection (cognitive fatigue model):
      TIER 1 — Micro-Break (5 min): consecutive work → work switch
      TIER 2 — AI Recovery Break (15 min): after 90 min cumulative work
      TIER 3 — Mental Reset (10 min): after 120 min in deep-focus state
    """
    if not routine:
        return []

    optimized = []
    pointer = time_to_mins(routine[0]['start'])
    cumulative_work = 0
    last_type = -1
    deep_focus = False
    part_counter = 0

    def _fatigue_threshold():
        return 120 if deep_focus else 90

    def _inject_break(label, duration, tag):
        nonlocal pointer, part_counter, cumulative_work, deep_focus, last_type
        part_counter += 1
        optimized.append({
            'id': f"break_{tag}_{part_counter}",
            'start': mins_to_time(pointer),
            'end': mins_to_time(pointer + duration),
            'type': 1, 'title': label, 'is_injected': True
        })
        pointer += duration
        last_type = 1
        if duration >= 15:
            deep_focus = True; cumulative_work = 0
        elif duration >= 10:
            deep_focus = False; cumulative_work = 0

    for i, task in enumerate(routine):
        duration = time_to_mins(task['end']) - time_to_mins(task['start'])
        if duration <= 0:
            continue
        task_id = task.get('id', f'task_{i}')

        if task.get('type') == 1:
            optimized.append({**task, 'start': mins_to_time(pointer), 'end': mins_to_time(pointer + duration)})
            pointer += duration
            cumulative_work = 0
            deep_focus = duration >= 15
            last_type = 1
            continue

        if last_type == 0:
            _inject_break('Micro-Break', 5, f'micro_{task_id}')

        remaining = duration
        while remaining > 0:
            threshold = _fatigue_threshold()
            chunk = min(remaining, threshold - cumulative_work)
            part_counter += 1
            optimized.append({
                'id': f"{task_id}_part{part_counter}",
                'start': mins_to_time(pointer),
                'end': mins_to_time(pointer + chunk),
                'type': 0,
                'title': task.get('title', 'Work')
            })
            pointer += chunk
            remaining -= chunk
            cumulative_work += chunk
            last_type = 0
            if cumulative_work >= threshold and remaining > 0:
                if deep_focus:
                    _inject_break('Mental Reset', 10, f'reset_{task_id}')
                else:
                    _inject_break('AI Recovery Break', 15, f'recovery_{task_id}')

    return optimized
