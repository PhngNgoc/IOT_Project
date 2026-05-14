import { useMemo } from 'react';

export default function Sparkline({
    data,
    accessor = (d) => d,
    width = 120,
    height = 36,
    stroke = '#6366f1',
    fillOpacity = 0.18,
    strokeWidth = 1.6,
}) {
    const path = useMemo(() => {
        const values = data
            .map((d, i) => ({ i, v: Number(accessor(d)) }))
            .filter((p) => Number.isFinite(p.v));
        if (values.length < 2) return null;

        const min = Math.min(...values.map((p) => p.v));
        const max = Math.max(...values.map((p) => p.v));
        const range = max - min || 1;
        const stepX = width / (values.length - 1);
        const padY = 3;
        const usableH = height - padY * 2;

        const points = values.map((p, idx) => {
            const x = idx * stepX;
            const y = height - padY - ((p.v - min) / range) * usableH;
            return [x, y];
        });

        const linePath = points
            .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
            .join(' ');
        const fillPath = `${linePath} L${width},${height} L0,${height} Z`;
        return { linePath, fillPath, last: points[points.length - 1] };
    }, [data, accessor, width, height]);

    if (!path) {
        return (
            <svg width={width} height={height}>
                <line
                    x1="0"
                    y1={height / 2}
                    x2={width}
                    y2={height / 2}
                    stroke="rgba(148,163,184,0.2)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                />
            </svg>
        );
    }

    const gradId = `spark-${stroke.replace('#', '')}`;
    return (
        <svg width={width} height={height} className="sparkline">
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={fillOpacity} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={path.fillPath} fill={`url(#${gradId})`} />
            <path
                d={path.linePath}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <circle cx={path.last[0]} cy={path.last[1]} r="3" fill={stroke}>
                <animate
                    attributeName="r"
                    values="3;5;3"
                    dur="2s"
                    repeatCount="indefinite"
                />
                <animate
                    attributeName="opacity"
                    values="1;0.4;1"
                    dur="2s"
                    repeatCount="indefinite"
                />
            </circle>
        </svg>
    );
}
