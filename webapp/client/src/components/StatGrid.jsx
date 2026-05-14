import { useEffect, useMemo, useRef, useState } from 'react';
import { ThermometerIcon, DropletIcon, ClockIcon, BellIcon } from './Icons.jsx';
import Sparkline from './Sparkline.jsx';
import { classifyTemp, classifyHumi, formatDuration } from '../utils/format.js';
import { useCountUp } from '../hooks/useCountUp.js';
import { useSpotlight } from '../hooks/useSpotlight.js';

function TrendChip({ current, previous, unit = '' }) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    const diff = current - previous;
    if (Math.abs(diff) < 0.05) return <span className="stat-trend steady">→ steady</span>;
    const dir = diff > 0 ? 'up' : 'down';
    const arrow = diff > 0 ? '↑' : '↓';
    return (
        <span className={`stat-trend ${dir}`}>
            {arrow} {Math.abs(diff).toFixed(1)}
            {unit}
        </span>
    );
}

function StatCard({
    tone = 'default',
    icon,
    label,
    value,
    unit,
    sparkData,
    sparkColor,
    sparkAccessor,
    extra,
    flashKey,
}) {
    const ref = useSpotlight({ tilt: true, tiltStrength: 5 });
    const [flash, setFlash] = useState(false);
    const prevKeyRef = useRef(flashKey);

    useEffect(() => {
        if (flashKey == null || flashKey === prevKeyRef.current) return;
        prevKeyRef.current = flashKey;
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 800);
        return () => clearTimeout(t);
    }, [flashKey]);

    return (
        <div
            ref={ref}
            className={`card spotlight tilt stat-card ${tone} ${flash ? 'flash' : ''}`}
        >
            <div className="stat-card-head">
                <div className="stat-label">{label}</div>
                <div className="stat-card-icon">{icon}</div>
            </div>
            <div className="stat-value">
                {value}
                {unit && <span className="stat-unit">{unit}</span>}
            </div>
            <div className="stat-sub">{extra}</div>
            {sparkData && sparkData.length > 1 && (
                <div className="stat-spark">
                    <Sparkline data={sparkData} accessor={sparkAccessor} stroke={sparkColor} height={44} />
                </div>
            )}
        </div>
    );
}

export default function StatGrid({ sensor, history, alertCounts, esp32ConnectedSince }) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const tempTone = classifyTemp(sensor.temperature) ?? 'default';
    const humiTone = classifyHumi(sensor.humidity) ?? 'default';

    const tempAnimated = useCountUp(sensor.temperature, { decimals: 1 });
    const humiAnimated = useCountUp(sensor.humidity, { decimals: 1 });

    const previousTemp = history.length >= 2 ? history[history.length - 2].temp : null;
    const previousHumi = history.length >= 2 ? history[history.length - 2].humi : null;

    const recentSamples = useMemo(() => history.slice(-30), [history]);

    const uptime = esp32ConnectedSince ? formatDuration(now - esp32ConnectedSince) : 'offline';
    const uptimeTone = esp32ConnectedSince ? 'ok' : 'crit';

    const totalAlerts =
        (alertCounts.warning ?? 0) + (alertCounts.critical ?? 0) + (alertCounts.error ?? 0);
    const alertTone = (alertCounts.critical || alertCounts.error) > 0
        ? 'crit'
        : (alertCounts.warning ?? 0) > 0 ? 'warn' : 'ok';

    return (
        <section className="stat-grid section-enter">
            <StatCard
                tone={tempTone}
                icon={<ThermometerIcon size={18} />}
                label="Temperature"
                value={tempAnimated}
                unit="°C"
                flashKey={history.length}
                sparkData={recentSamples}
                sparkAccessor={(d) => d.temp}
                sparkColor="#ef4444"
                extra={
                    <>
                        <TrendChip current={sensor.temperature} previous={previousTemp} unit="°" />
                        <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>vs. prev</span>
                    </>
                }
            />
            <StatCard
                tone={humiTone}
                icon={<DropletIcon size={18} />}
                label="Humidity"
                value={humiAnimated}
                unit="%"
                flashKey={history.length}
                sparkData={recentSamples}
                sparkAccessor={(d) => d.humi}
                sparkColor="#3b82f6"
                extra={
                    <>
                        <TrendChip current={sensor.humidity} previous={previousHumi} unit="%" />
                        <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>vs. prev</span>
                    </>
                }
            />
            <StatCard
                tone={uptimeTone}
                icon={<ClockIcon size={18} />}
                label="ESP32 uptime"
                value={uptime}
                extra={<span className="stat-trend steady">{history.length} samples buffered</span>}
            />
            <StatCard
                tone={alertTone}
                icon={<BellIcon size={18} />}
                label="Alerts · 24h"
                value={totalAlerts}
                flashKey={totalAlerts}
                extra={
                    <>
                        {alertCounts.critical > 0 && <span className="stat-trend up">{alertCounts.critical} crit</span>}
                        {alertCounts.error > 0 && <span className="stat-trend up">{alertCounts.error} err</span>}
                        {alertCounts.warning > 0 && (
                            <span className="stat-trend up" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                                {alertCounts.warning} warn
                            </span>
                        )}
                        {totalAlerts === 0 && (
                            <span className="stat-trend down" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                                All clear
                            </span>
                        )}
                    </>
                }
            />
        </section>
    );
}
