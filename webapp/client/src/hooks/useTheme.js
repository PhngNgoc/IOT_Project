import { useEffect, useState } from 'react';

const KEY = 'esp32-console-theme';

export function useTheme() {
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'light';
        return localStorage.getItem(KEY) || 'light';
    });

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(KEY, theme);
    }, [theme]);

    const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
    return { theme, toggle };
}
