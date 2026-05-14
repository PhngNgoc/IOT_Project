import { useEffect } from 'react';
import { AlertIcon, InfoIcon } from './Icons.jsx';

function Toast({ toast, onClose }) {
    useEffect(() => {
        const id = setTimeout(() => onClose(toast.id), toast.duration ?? 6000);
        return () => clearTimeout(id);
    }, [toast, onClose]);

    return (
        <div className={`toast toast-${toast.level}`} role="status">
            <div className="toast-icon">
                {toast.level === 'info' ? <InfoIcon size={16} /> : <AlertIcon size={16} />}
            </div>
            <div className="toast-body">
                <div className="toast-title">{toast.title}</div>
                {toast.message && <div className="toast-message">{toast.message}</div>}
            </div>
            <button
                type="button"
                className="toast-close"
                onClick={() => onClose(toast.id)}
                aria-label="Dismiss"
            >
                ×
            </button>
            <div className="toast-progress" style={{ animationDuration: `${toast.duration ?? 6000}ms` }} />
        </div>
    );
}

export default function Toasts({ toasts, onClose }) {
    return (
        <div className="toasts-region" aria-live="polite">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onClose={onClose} />
            ))}
        </div>
    );
}
