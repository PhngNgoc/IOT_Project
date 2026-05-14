import { useEffect, useRef } from 'react';

// Mouse-tracking radial spotlight + optional 3D tilt.
// Sets CSS vars --mx, --my (px, relative to element) and --tx, --ty (deg).
export function useSpotlight({ tilt = false, tiltStrength = 6 } = {}) {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const onMove = (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            el.style.setProperty('--mx', `${x}px`);
            el.style.setProperty('--my', `${y}px`);
            if (tilt) {
                const cx = rect.width / 2;
                const cy = rect.height / 2;
                const ry = ((x - cx) / cx) * tiltStrength;
                const rx = -((y - cy) / cy) * tiltStrength;
                el.style.setProperty('--rx', `${rx}deg`);
                el.style.setProperty('--ry', `${ry}deg`);
            }
        };

        const onLeave = () => {
            el.style.setProperty('--rx', '0deg');
            el.style.setProperty('--ry', '0deg');
        };

        el.addEventListener('mousemove', onMove);
        el.addEventListener('mouseleave', onLeave);
        return () => {
            el.removeEventListener('mousemove', onMove);
            el.removeEventListener('mouseleave', onLeave);
        };
    }, [tilt, tiltStrength]);

    return ref;
}
