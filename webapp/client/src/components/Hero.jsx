import { useEffect, useState } from 'react';
import { useCountUp } from '../hooks/useCountUp.js';
import { ThermometerIcon, DropletIcon, ChipIcon } from './Icons.jsx';
import { formatDuration } from '../utils/format.js';
import LiveBadge from './LiveBadge.jsx';

export default function Hero({ sensor, bridge, totalSamples }) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const tempAnim = useCountUp(sensor.temperature, { decimals: 1, duration: 700 });
    const humiAnim = useCountUp(sensor.humidity, { decimals: 1, duration: 700 });

    const uptime = bridge.esp32ConnectedSince
        ? formatDuration(now - bridge.esp32ConnectedSince)
        : 'offline';

    return (
        <section className="hero section-enter">
            <div className="hero-inner">
                <div className="hero-eyebrow">
                    <LiveBadge active={bridge.connected} />
                    <span className="hero-bullet">·</span>
                    <span className="hero-host">{bridge.host || '—'}:{bridge.port || 80}</span>
                </div>
                <h2 className="hero-headline">
                    Realtime <span className="hero-grad">telemetry</span>
                    <br />
                    from your <span className="hero-grad">ESP32</span>
                </h2>
                <p className="hero-lede">
                    DHT20 readings and GPIO commands stream through a Node bridge into this
                    dashboard. Alerts fire automatically when values cross the firmware
                    thresholds.
                </p>

                <div className="hero-stats">
                    <div className="hero-stat">
                        <div className="hero-stat-icon" style={{ '--c': '#ef4444' }}>
                            <ThermometerIcon size={18} />
                        </div>
                        <div>
                            <div className="hero-stat-label">Temperature</div>
                            <div className="hero-stat-num">
                                {tempAnim}
                                <span className="hero-stat-unit">°C</span>
                            </div>
                        </div>
                    </div>
                    <div className="hero-stat">
                        <div className="hero-stat-icon" style={{ '--c': '#3b82f6' }}>
                            <DropletIcon size={18} />
                        </div>
                        <div>
                            <div className="hero-stat-label">Humidity</div>
                            <div className="hero-stat-num">
                                {humiAnim}
                                <span className="hero-stat-unit">%</span>
                            </div>
                        </div>
                    </div>
                    <div className="hero-stat">
                        <div className="hero-stat-icon" style={{ '--c': '#6366f1' }}>
                            <ChipIcon size={18} />
                        </div>
                        <div>
                            <div className="hero-stat-label">Uptime · Samples</div>
                            <div className="hero-stat-num hero-stat-text">
                                {uptime}
                                <span className="hero-stat-unit"> · {totalSamples}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="hero-glow" aria-hidden="true" />
        </section>
    );
}
