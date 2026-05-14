export default function LiveBadge({ active = true }) {
    return (
        <span className={`live-badge ${active ? 'on' : 'off'}`}>
            <span className="live-dot" />
            {active ? 'LIVE' : 'OFFLINE'}
        </span>
    );
}
