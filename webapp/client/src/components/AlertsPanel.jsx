import { AlertIcon, InfoIcon, CheckIcon, BellIcon } from './Icons.jsx';
import { formatRelative } from '../utils/format.js';

const ICONS = {
    critical: <AlertIcon size={14} />,
    error: <AlertIcon size={14} />,
    warning: <AlertIcon size={14} />,
    info: <InfoIcon size={14} />,
};

export default function AlertsPanel({ alerts }) {
    return (
        <div className="card alerts-card">
            <div className="alerts-header">
                <div className="card-label" style={{ margin: 0 }}>
                    <BellIcon size={14} />
                    Alerts &amp; events
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                    {alerts.length} recent
                </span>
            </div>
            {alerts.length === 0 ? (
                <div className="alerts-empty">
                    <CheckIcon size={20} /> Nothing yet — all systems nominal.
                </div>
            ) : (
                <ul className="alerts-list">
                    {alerts.map((event) => (
                        <li key={event.id} className={`alert-item ${event.level}`}>
                            <div className="alert-icon">
                                {ICONS[event.level] ?? <InfoIcon size={14} />}
                            </div>
                            <div className="alert-body">
                                <div className="alert-message">{event.message}</div>
                                <div className="alert-meta">
                                    <span className="alert-cat">{event.category}</span>
                                    <span>{formatRelative(event.ts)}</span>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
