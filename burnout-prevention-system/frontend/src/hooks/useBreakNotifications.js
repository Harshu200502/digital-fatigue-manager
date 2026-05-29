import { useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

/**
 * useBreakNotifications  —  Guardian Break Alert Engine v3
 *
 * FIXES APPLIED:
 * 1. User Activation: requestPermission only via explicit user click (startGuardian)
 * 2. Unix Timestamps: compares break_timestamp_ms vs Date.now() — no HH:MM parsing
 * 3. State Persistence: next break stored in refs (survives re-renders)
 * 4. Service Worker: uses navigator.serviceWorker.ready (guaranteed active)
 * 5. Emergency Logging: console.warn at every critical step
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const POLL_MS = 60_000;        // poll every 60 s
const WARN_MIN_MS = 14 * 60_000; // 14 minutes in ms
const WARN_MAX_MS = 16 * 60_000; // 16 minutes in ms

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function buildBody(title = '') {
    const t = title.toLowerCase();
    if (t.includes('wall'))   return 'Recovery session in 15 mins: Time for Wall Angels!';
    if (t.includes('box'))    return 'Recovery session in 15 mins: Time for Box Breathing!';
    if (t.includes('breath') || t.includes('bhramari') || t.includes('sigh'))
        return 'Recovery session in 15 mins: Time for breathing exercises!';
    if (t.includes('stretch') || t.includes('tendon'))
        return 'Recovery session in 15 mins: Time for stretching!';
    return `Recovery session in 15 mins: Time for ${title || 'your break'}!`;
}

// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

let _swReady = null; // Promise<ServiceWorkerRegistration>

function ensureServiceWorker() {
    if (_swReady) return _swReady;
    if (!('serviceWorker' in navigator)) {
        console.warn('[Guardian] ⚠ Service Workers not supported — notifications only work while tab is focused.');
        return Promise.resolve(null);
    }

    _swReady = navigator.serviceWorker
        .register('/guardian-sw.js')
        .then(() => {
            console.warn('[Guardian] 🔧 Service Worker registered — waiting for "ready"…');
            return navigator.serviceWorker.ready;
        })
        .then((reg) => {
            console.warn('[Guardian] ✅ Service Worker READY & ACTIVE:', reg.active?.state);
            return reg;
        })
        .catch((err) => {
            console.error('[Guardian] ❌ Service Worker failed:', err);
            return null;
        });

    return _swReady;
}

/**
 * Dispatch notification. Tries ServiceWorker first (works in background),
 * then falls back to raw Notification API.
 */
async function fireNotification(title, body, tag) {
    console.warn('[Guardian] 🚀 Attempting to show notification…');
    console.warn(`[Guardian]    title = "${title}"`);
    console.warn(`[Guardian]    body  = "${body}"`);
    console.warn(`[Guardian]    tag   = "${tag}"`);

    // Attempt 1: Service Worker showNotification (works even if tab unfocused)
    try {
        const reg = await ensureServiceWorker();
        if (reg?.active) {
            await reg.showNotification(title, {
                body,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag,
                requireInteraction: true,
                silent: false,
                vibrate: [200, 100, 200],
            });
            console.warn('[Guardian] ✅ Notification shown via Service Worker showNotification()');
            return true;
        }
    } catch (swErr) {
        console.error('[Guardian] ⚠ SW showNotification failed, falling back:', swErr);
    }

    // Attempt 2: Direct Notification API (only works if tab is focused)
    try {
        const n = new Notification(title, { body, icon: '/favicon.ico', tag, requireInteraction: true });
        n.onclick = () => { window.focus(); n.close(); };
        console.warn('[Guardian] ✅ Notification shown via Notification API');
        return true;
    } catch (apiErr) {
        console.error('[Guardian] ❌ Direct Notification API also failed:', apiErr);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useBreakNotifications(routine, enabled = false) {
    // ── Refs: survive re-renders, never trigger re-render ──
    const firedRef     = useRef(new Set());
    const intervalRef  = useRef(null);
    const nextBreakRef = useRef(null);   // persisted next_break data
    const swReadyRef   = useRef(false);

    // ──────────────────────────────────────────────────────────
    // 1. Mount: log permission status, register SW
    // ──────────────────────────────────────────────────────────
    useEffect(() => {
        console.warn('═══════════════════════════════════════════════');
        console.warn('[Guardian] 🛡️  Break Alert Engine v3 — MOUNTED');
        console.warn('═══════════════════════════════════════════════');

        if (!('Notification' in window)) {
            console.error('[Guardian] ❌ This browser does NOT support the Notification API.');
            return;
        }

        console.warn(`[Guardian] 📋 Permission Status on mount: "${Notification.permission}"`);
        if (Notification.permission === 'denied') {
            console.error(
                '[Guardian] ❌ Notifications are BLOCKED by browser settings.\n' +
                '👉 Fix: Click the lock icon 🔒 in the address bar → Site settings → Allow Notifications.'
            );
        }

        // Pre-register SW (don't request permission here — needs user gesture)
        ensureServiceWorker().then((reg) => {
            swReadyRef.current = !!reg?.active;
            console.warn(`[Guardian] Service Worker active: ${swReadyRef.current}`);
        });
    }, []);

    // ──────────────────────────────────────────────────────────
    // 2. Polling loop — only runs when `enabled === true`
    // ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            console.warn('[Guardian] ⏸ Polling is OFF.');
            return;
        }

        console.warn('[Guardian] ▶ Polling STARTED — every 60 seconds.');

        const tick = async () => {
            const clientNow = Date.now();
            const clientTimeStr = new Date(clientNow).toLocaleTimeString();

            console.warn('───────────────────────────────────────');
            console.warn(`[Guardian] ⏱ TICK at ${clientTimeStr}  (epoch: ${clientNow})`);

            // ── Permission check ──
            const perm = Notification.permission;
            console.warn(`[Guardian] 📋 Permission Status: "${perm}"`);
            if (perm !== 'granted') {
                console.error(`[Guardian] ❌ Cannot fire — permission is "${perm}". Skipping tick.`);
                return;
            }

            // ── Fetch /api/schedule ──
            let data;
            try {
                const res = await axios.get(`${BACKEND_URL}/api/schedule`);
                data = res.data;
            } catch (err) {
                console.error('[Guardian] ❌ /api/schedule fetch failed:', err.message);
                return;
            }

            console.warn('[Guardian] 📡 Server response:', JSON.stringify(data, null, 2));

            const nb = data?.next_break;
            if (!nb) {
                console.warn('[Guardian] ℹ No upcoming breaks from server.');
                nextBreakRef.current = null;
                return;
            }

            // ── Store in ref (persists across re-renders) ──
            nextBreakRef.current = nb;

            // ── TIME COMPARISON: use Unix timestamps ──
            const breakMs   = nb.break_timestamp_ms;
            const serverMs  = data.server_now_ms;
            const minsFromServer = nb.minutes_until;

            // Also compute delta from client clock → server-provided break timestamp
            const deltaMs = breakMs - clientNow;
            const deltaMins = Math.round(deltaMs / 60_000);

            console.warn(`[Guardian] 🕐 Time Debug:`);
            console.warn(`[Guardian]    break_timestamp_ms : ${breakMs}  (${new Date(breakMs).toLocaleTimeString()})`);
            console.warn(`[Guardian]    server_now_ms      : ${serverMs}  (${new Date(serverMs).toLocaleTimeString()})`);
            console.warn(`[Guardian]    client Date.now()   : ${clientNow}  (${clientTimeStr})`);
            console.warn(`[Guardian]    server minutes_until: ${minsFromServer} min`);
            console.warn(`[Guardian]    client deltaMs      : ${deltaMs} ms  ≈ ${deltaMins} min`);
            console.warn(`[Guardian]    break title         : "${nb.title}"`);
            console.warn(`[Guardian]    break start (HH:MM) : ${nb.start}`);

            // ── Decision: use the MORE RELIABLE of the two calculations ──
            // If server & client clocks agree within 2 min, use server.
            // Otherwise, fall back to client delta.
            let useMs;
            if (Math.abs(deltaMins - minsFromServer) <= 2) {
                // Clocks in sync — use server value (it's authoritative)
                useMs = minsFromServer * 60_000;
                console.warn(`[Guardian] ✅ Clocks in sync — using server minutes_until: ${minsFromServer} min`);
            } else {
                // Clock drift detected — use client-side delta
                useMs = deltaMs;
                console.warn(`[Guardian] ⚠ Clock drift detected! server says ${minsFromServer}min, client says ${deltaMins}min. Using client delta.`);
            }

            console.warn(`[Guardian] ⏳ Time Remaining: ${Math.round(useMs / 60_000)} min  (${useMs} ms)`);
            console.warn(`[Guardian] 🎯 Trigger window: ${WARN_MIN_MS / 60_000}–${WARN_MAX_MS / 60_000} min`);

            // ── Tag for deduplication ──
            const tag = `break-${nb.id || nb.title}-${nb.start}`;

            if (firedRef.current.has(tag)) {
                console.warn(`[Guardian] ⏭ Already notified for "${nb.title}" (tag: ${tag}) — skipping.`);
                return;
            }

            // ── TRIGGER CHECK ──
            if (useMs >= WARN_MIN_MS && useMs <= WARN_MAX_MS) {
                console.warn(`[Guardian] 🚀🚀🚀 TRIGGERING NOTIFICATION for "${nb.title}"!`);

                firedRef.current.add(tag);
                const ok = await fireNotification(
                    'Digital Guardian Alert',
                    buildBody(nb.title || 'Recovery Session'),
                    tag
                );

                if (ok) {
                    console.warn(`[Guardian] ✅ Notification delivered successfully.`);
                } else {
                    console.error(`[Guardian] ❌ Notification delivery FAILED.`);
                }
            } else if (useMs > 0 && useMs < WARN_MIN_MS) {
                console.warn(`[Guardian] ⚡ Break is CLOSER than 14 min (${Math.round(useMs/60_000)} min). Window passed.`);
            } else if (useMs > WARN_MAX_MS) {
                console.warn(`[Guardian] ⏳ Break is further than 16 min (${Math.round(useMs/60_000)} min). Waiting…`);
            } else {
                console.warn(`[Guardian] ℹ Break time in past or invalid delta: ${useMs} ms`);
            }
        };

        // Run immediately, then every 60 s
        tick();
        intervalRef.current = setInterval(tick, POLL_MS);

        return () => {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            console.warn('[Guardian] ⏹ Polling STOPPED (cleanup).');
        };
    }, [enabled]);

    // ──────────────────────────────────────────────────────────
    // 3. requestPermission — ONLY call this from a click handler
    // ──────────────────────────────────────────────────────────
    const requestPermission = useCallback(async () => {
        console.warn('[Guardian] 🔐 requestPermission called (user gesture)');

        if (!('Notification' in window)) {
            console.error('[Guardian] ❌ Notification API not supported.');
            return 'denied';
        }

        if (Notification.permission === 'granted') {
            console.warn('[Guardian] ✅ Already granted.');
            return 'granted';
        }

        const result = await Notification.requestPermission();
        console.warn(`[Guardian] 🔐 Permission result: "${result}"`);

        if (result === 'denied') {
            console.error(
                '[Guardian] ❌ BLOCKED by browser.\n' +
                '👉 Fix: Click 🔒 in address bar → Site settings → Notifications → Allow'
            );
        }
        return result;
    }, []);

    // ──────────────────────────────────────────────────────────
    // 4. startGuardian — User-gesture-triggered test notification
    //    This is the "Start Guardian" button handler.
    //    It requests permission AND fires a test alert in ONE click.
    // ──────────────────────────────────────────────────────────
    const startGuardian = useCallback(async () => {
        console.warn('═══════════════════════════════════════════════');
        console.warn('[Guardian] 🛡️ START GUARDIAN — user clicked button');
        console.warn('═══════════════════════════════════════════════');

        // Step 1: Request permission (user gesture = will show browser dialog)
        const perm = await requestPermission();
        if (perm !== 'granted') {
            console.error('[Guardian] ❌ Cannot proceed — permission not granted.');
            return { success: false, reason: 'permission_denied' };
        }

        // Step 2: Verify service worker is active
        const reg = await ensureServiceWorker();
        const swActive = !!reg?.active;
        console.warn(`[Guardian] Service Worker active: ${swActive}`);

        // Step 3: Fire a TEST notification immediately
        console.warn('[Guardian] 🧪 Firing TEST notification…');
        const ok = await fireNotification(
            '🛡️ Guardian Activated',
            'Break alerts are now active. You will be notified 15 minutes before each recovery session.',
            'guardian-test-' + Date.now()
        );

        if (ok) {
            console.warn('[Guardian] ✅ TEST notification delivered! System is working.');
        } else {
            console.error('[Guardian] ❌ TEST notification FAILED.');
        }

        return { success: ok, permission: perm, serviceWorker: swActive };
    }, [requestPermission]);

    return { requestPermission, startGuardian, nextBreakRef };
}
