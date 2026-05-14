const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};

export function ThermometerIcon({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0Z" />
        </svg>
    );
}

export function DropletIcon({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <path d="M12 3.5s-6 6.5-6 10.5a6 6 0 0 0 12 0c0-4-6-10.5-6-10.5Z" />
        </svg>
    );
}

export function PowerIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
    );
}

export function WifiIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <path d="M5 12.55a11 11 0 0 1 14 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
    );
}

export function ChipIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <rect x="6" y="6" width="12" height="12" rx="2" />
            <rect x="9" y="9" width="6" height="6" />
            <path d="M3 10h3M3 14h3M18 10h3M18 14h3M10 3v3M14 3v3M10 18v3M14 18v3" />
        </svg>
    );
}

export function ActivityIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    );
}

export function AlertIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    );
}

export function InfoIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    );
}

export function CheckIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

export function ClockIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

export function BellIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}

export function SparkIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
            <path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" />
        </svg>
    );
}

export function LogoMark({ size = 36 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48">
            <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
            </defs>
            <rect width="48" height="48" rx="11" fill="url(#logoGrad)" />
            <g fill="white">
                <path d="M24 14a10 10 0 0 0-10 10h3a7 7 0 0 1 14 0h3a10 10 0 0 0-10-10Z" />
                <path d="M24 19a5 5 0 0 0-5 5h10a5 5 0 0 0-5-5Z" opacity=".85" />
                <circle cx="24" cy="32" r="2.4" />
            </g>
        </svg>
    );
}
