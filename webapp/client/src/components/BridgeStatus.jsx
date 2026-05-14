import { useEffect, useState } from 'react';
import { WifiIcon, ChipIcon } from './Icons.jsx';

export default function BridgeStatus({ bridge, wsReady, onUpdate }) {
    const [host, setHost] = useState(bridge.host);
    const [port, setPort] = useState(bridge.port);

    useEffect(() => {
        setHost(bridge.host);
        setPort(bridge.port);
    }, [bridge.host, bridge.port]);

    const submit = (e) => {
        e.preventDefault();
        if (!host) return;
        onUpdate(host, port);
    };

    return (
        <div className="bridge">
            <div className="status-row">
                <span className={`pill ${wsReady ? 'ok' : 'bad'}`}>
                    <span className="pill-dot" />
                    <WifiIcon size={14} />
                    Browser ↔ Node
                </span>
                <span className={`pill ${bridge.connected ? 'ok' : 'bad'}`}>
                    <span className="pill-dot" />
                    <ChipIcon size={14} />
                    Node ↔ ESP32
                </span>
            </div>
            <form className="bridge-form" onSubmit={submit}>
                <label className="field">
                    ESP32 host
                    <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="192.168.1.50"
                    />
                </label>
                <label className="field">
                    Port
                    <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        min={1}
                        max={65535}
                    />
                </label>
                <button type="submit" className="btn primary">
                    Reconnect
                </button>
            </form>
        </div>
    );
}
