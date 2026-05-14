import { useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    ReferenceLine,
} from 'recharts';
import { ActivityIcon } from './Icons.jsx';
import { formatClock } from '../utils/format.js';
import LiveBadge from './LiveBadge.jsx';

const RANGES = [
    { id: '5m', label: '5m', ms: 5 * 60 * 1000 },
    { id: '1h', label: '1h', ms: 60 * 60 * 1000 },
    { id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
    { id: 'all', label: 'All', ms: null },
];

function TooltipContent({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const tempEntry = payload.find((p) => p.dataKey === 'temp');
    const humiEntry = payload.find((p) => p.dataKey === 'humi');
    return (
        <div
            style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
                color: '#0f172a',
            }}
        >
            <div style={{ color: '#9ca3af', marginBottom: 6, letterSpacing: '0.04em' }}>
                {formatClock(label)}
            </div>
            {tempEntry && (
                <div style={{ color: '#ef4444', fontWeight: 600 }}>
                    Temp · {Number(tempEntry.value).toFixed(1)} °C
                </div>
            )}
            {humiEntry && (
                <div style={{ color: '#3b82f6', fontWeight: 600 }}>
                    Humi · {Number(humiEntry.value).toFixed(1)} %
                </div>
            )}
        </div>
    );
}

export default function SensorChart({ history, isLive }) {
    const [rangeId, setRangeId] = useState('1h');
    const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[1];

    const data = useMemo(() => {
        if (!range.ms) return history;
        const cutoff = Date.now() - range.ms;
        return history.filter((p) => p.t >= cutoff);
    }, [history, range.ms]);

    return (
        <div className="card chart-card section-enter">
            <div className="chart-header">
                <div className="chart-title-row">
                    <div className="card-label" style={{ margin: 0 }}>
                        <ActivityIcon size={14} />
                        Sensor timeline
                    </div>
                    <LiveBadge active={isLive} />
                </div>
                <div className="range-tabs">
                    {RANGES.map((r) => (
                        <button
                            key={r.id}
                            className={`range-tab ${r.id === rangeId ? 'active' : ''}`}
                            onClick={() => setRangeId(r.id)}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="chart-legend">
                <span className="legend-item">
                    <span className="legend-swatch" style={{ background: '#ef4444' }} />
                    Temperature (°C)
                </span>
                <span className="legend-item">
                    <span className="legend-swatch" style={{ background: '#3b82f6' }} />
                    Humidity (%)
                </span>
                <span className="legend-item">
                    <span
                        className="legend-swatch"
                        style={{ background: 'transparent', border: '1px dashed #f59e0b' }}
                    />
                    Threshold
                </span>
                <span className="legend-item" style={{ marginLeft: 'auto', color: 'var(--text-faint)' }}>
                    {data.length} samples
                </span>
            </div>

            {data.length === 0 ? (
                <div className="chart-empty">
                    <div className="chart-empty-pulse" />
                    Waiting for sensor data...
                </div>
            ) : (
                <div className="chart-area-wrap" key={rangeId}>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={data} margin={{ top: 10, right: 14, left: -8, bottom: 0 }}>
                            <defs>
                                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.22} />
                                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="humiGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 4" />
                            <XAxis
                                dataKey="t"
                                tickFormatter={formatClock}
                                stroke="#94a3b8"
                                fontSize={11}
                                tickMargin={6}
                            />
                            <YAxis
                                yAxisId="t"
                                stroke="#94a3b8"
                                fontSize={11}
                                domain={['auto', 'auto']}
                                tickFormatter={(v) => `${v}°`}
                            />
                            <YAxis
                                yAxisId="h"
                                orientation="right"
                                stroke="#94a3b8"
                                fontSize={11}
                                domain={[0, 100]}
                                tickFormatter={(v) => `${v}%`}
                            />
                            <Tooltip
                                content={<TooltipContent />}
                                cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }}
                            />
                            <ReferenceLine
                                yAxisId="t"
                                y={30}
                                stroke="#f59e0b"
                                strokeDasharray="3 3"
                                strokeOpacity={0.7}
                                label={{ value: 'crit 30°', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                            />
                            <ReferenceLine
                                yAxisId="t"
                                y={25}
                                stroke="#f59e0b"
                                strokeDasharray="3 3"
                                strokeOpacity={0.35}
                            />
                            <Area
                                yAxisId="t"
                                type="monotone"
                                dataKey="temp"
                                stroke="#ef4444"
                                strokeWidth={2}
                                fill="url(#tempGrad)"
                                animationDuration={650}
                                animationEasing="ease-out"
                            />
                            <Area
                                yAxisId="h"
                                type="monotone"
                                dataKey="humi"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fill="url(#humiGrad)"
                                animationDuration={650}
                                animationEasing="ease-out"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
