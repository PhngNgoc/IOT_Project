export default function ThemeToggle({ theme, onToggle }) {
    const isDark = theme === 'dark';
    return (
        <button
            type="button"
            className="theme-toggle"
            onClick={onToggle}
            aria-label="Toggle theme"
            title="Toggle theme"
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={`theme-toggle-icon ${isDark ? 'flip' : ''}`}>
                <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    {isDark ? (
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
                    ) : (
                        <>
                            <circle cx="12" cy="12" r="4" />
                            <line x1="12" y1="2" x2="12" y2="4" />
                            <line x1="12" y1="20" x2="12" y2="22" />
                            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
                            <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                            <line x1="2" y1="12" x2="4" y2="12" />
                            <line x1="20" y1="12" x2="22" y2="12" />
                            <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
                            <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
                        </>
                    )}
                </g>
            </svg>
        </button>
    );
}
