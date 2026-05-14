import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function useCountUp(target, { duration = 600, decimals = 1 } = {}) {
    const [value, setValue] = useState(target ?? 0);
    const frameRef = useRef();
    const fromRef = useRef(target ?? 0);

    useEffect(() => {
        if (target == null || !Number.isFinite(target)) {
            setValue(target);
            return;
        }
        const from = fromRef.current ?? 0;
        const to = target;
        if (from === to) return;

        const startedAt = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - startedAt) / duration);
            const eased = easeOutCubic(t);
            const next = from + (to - from) * eased;
            setValue(next);
            if (t < 1) {
                frameRef.current = requestAnimationFrame(tick);
            } else {
                fromRef.current = to;
            }
        };
        frameRef.current = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frameRef.current);
    }, [target, duration]);

    if (value == null || !Number.isFinite(value)) return '—';
    return value.toFixed(decimals);
}
