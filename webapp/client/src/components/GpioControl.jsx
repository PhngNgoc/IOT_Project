import { useState } from 'react';
import { PowerIcon, SparkIcon, ChipIcon } from './Icons.jsx';

const PRESETS = [
    { name: 'Onboard LED', gpio: 2 },
    { name: 'Relay 1', gpio: 5 },
    { name: 'Relay 2', gpio: 18 },
    { name: 'Fan', gpio: 19 },
];

export default function GpioControl({ onSend, disabled }) {
    const [gpio, setGpio] = useState(2);
    const [name, setName] = useState('Onboard LED');
    const [lastAction, setLastAction] = useState(null);

    const applyPreset = (preset) => {
        setName(preset.name);
        setGpio(preset.gpio);
    };

    const handlePress = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--rx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        e.currentTarget.style.setProperty('--ry', `${((e.clientY - rect.top) / rect.height) * 100}%`);
    };

    const send = (status, e) => {
        if (e) handlePress(e);
        const parsed = Number(gpio);
        if (!Number.isInteger(parsed) || parsed < 0) return;
        onSend({
            page: 'device',
            value: { name, gpio: parsed, status },
        });
        setLastAction({ status, ts: Date.now() });
    };

    return (
        <div className="card gpio-card section-enter">
            <div className="card-label">
                <SparkIcon size={14} />
                GPIO control
            </div>

            <div className="preset-row">
                {PRESETS.map((preset) => {
                    const active = Number(gpio) === preset.gpio && name === preset.name;
                    return (
                        <button
                            key={preset.name}
                            type="button"
                            className={`preset ${active ? 'active' : ''}`}
                            onClick={() => applyPreset(preset)}
                        >
                            {preset.name} · GPIO {preset.gpio}
                        </button>
                    );
                })}
            </div>

            <div className="gpio-form">
                <label className="field">
                    Name
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="LED"
                    />
                </label>
                <label className="field">
                    GPIO pin
                    <input
                        type="number"
                        min={0}
                        max={48}
                        value={gpio}
                        onChange={(e) => setGpio(e.target.value)}
                    />
                </label>
            </div>

            <div className="power-display">
                <div>
                    <div className="power-display-label">Target</div>
                    <div className="power-display-value">
                        {name} · GPIO {gpio}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="power-display-label">Last</div>
                    <div className="power-display-value" style={{
                        color: lastAction?.status === 'ON' ? 'var(--success)'
                            : lastAction?.status === 'OFF' ? 'var(--danger)'
                            : 'var(--text-faint)'
                    }}>
                        {lastAction?.status ?? '—'}
                    </div>
                </div>
            </div>

            <div className="gpio-buttons">
                <button
                    type="button"
                    className="btn on"
                    onClick={(e) => send('ON', e)}
                    disabled={disabled}
                >
                    <PowerIcon size={16} />
                    Turn ON
                </button>
                <button
                    type="button"
                    className="btn off"
                    onClick={(e) => send('OFF', e)}
                    disabled={disabled}
                >
                    <PowerIcon size={16} />
                    Turn OFF
                </button>
            </div>

            {disabled && (
                <div className="gpio-hint">
                    <ChipIcon size={14} />
                    ESP32 not connected — commands will be rejected.
                </div>
            )}
        </div>
    );
}
