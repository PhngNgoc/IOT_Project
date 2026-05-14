import { useEffect, useRef, useState } from 'react';
import Hero from './components/Hero.jsx';
import StatGrid from './components/StatGrid.jsx';
import SensorChart from './components/SensorChart.jsx';
import GpioControl from './components/GpioControl.jsx';
import BridgeStatus from './components/BridgeStatus.jsx';
import AlertsPanel from './components/AlertsPanel.jsx';
import Toasts from './components/Toasts.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import MeshBackground from './components/MeshBackground.jsx';
import { LogoMark, ActivityIcon } from './components/Icons.jsx';
import { formatClock } from './utils/format.js';
import { useTheme } from './hooks/useTheme.js';

const MAX_POINTS = 360;
let toastCounter = 0;

export default function App() {
    const { theme, toggle: toggleTheme } = useTheme();
    const [bridge, setBridge] = useState({
        connected: false,
        host: '',
        port: 80,
        esp32ConnectedSince: null,
    });
    const [wsReady, setWsReady] = useState(false);
    const [sensor, setSensor] = useState({ temperature: null, humidity: null });
    const [history, setHistory] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [alertCounts, setAlertCounts] = useState({});
    const [log, setLog] = useState([]);
    const [toasts, setToasts] = useState([]);
    const wsRef = useRef(null);
    const bootDoneRef = useRef(false);

    const appendLog = (line) => {
        setLog((prev) => [`${formatClock(Date.now())}  ${line}`, ...prev].slice(0, 80));
    };

    const pushToast = (toast) => {
        toastCounter += 1;
        const id = toastCounter;
        setToasts((prev) => [...prev, { id, ...toast }]);
    };

    const closeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    useEffect(() => {
        Promise.all([
            fetch('/api/history?windowMs=86400000').then((r) => r.json()),
            fetch('/api/alerts?limit=50').then((r) => r.json()),
            fetch('/api/stats').then((r) => r.json()),
        ])
            .then(([h, a, s]) => {
                if (Array.isArray(h.readings)) {
                    setHistory(
                        h.readings.slice(-MAX_POINTS).map((r) => ({
                            t: r.ts, temp: r.temp, humi: r.humi,
                        })),
                    );
                }
                if (Array.isArray(a.events)) setAlerts(a.events);
                if (s.alertsLast24h) setAlertCounts(s.alertsLast24h);
                if (s.esp32ConnectedSince) {
                    setBridge((prev) => ({ ...prev, esp32ConnectedSince: s.esp32ConnectedSince }));
                }
                if (s.lastSensor) {
                    setSensor({ temperature: s.lastSensor.temperature, humidity: s.lastSensor.humidity });
                }
            })
            .catch((err) => appendLog(`Bootstrap failed: ${err.message}`))
            .finally(() => { bootDoneRef.current = true; });
    }, []);

    useEffect(() => {
        let retry;
        const connect = () => {
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const url = `${proto}//${window.location.host}/ws`;
            const ws = new WebSocket(url);
            wsRef.current = ws;
            ws.onopen = () => { setWsReady(true); appendLog('Browser WS open'); };
            ws.onclose = () => {
                setWsReady(false);
                appendLog('Browser WS closed, retry in 2s');
                retry = setTimeout(connect, 2000);
            };
            ws.onerror = () => appendLog('Browser WS error');
            ws.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data);
                    if (data.page === 'bridge') {
                        setBridge((prev) => ({
                            ...prev,
                            connected: !!data.connected,
                            host: data.host ?? prev.host,
                            port: data.port ?? prev.port,
                            esp32ConnectedSince: data.esp32ConnectedSince ?? prev.esp32ConnectedSince,
                        }));
                        if (data.error) appendLog(`Bridge error: ${data.error}`);
                        return;
                    }
                    if (data.page === 'sensor') {
                        const t = Number(data.temperature);
                        const h = Number(data.humidity);
                        setSensor({ temperature: t, humidity: h });
                        setHistory((prev) => {
                            const next = [...prev, { t: Date.now(), temp: t, humi: h }];
                            return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
                        });
                        return;
                    }
                    if (data.page === 'event') {
                        setAlerts((prev) => [data.event, ...prev].slice(0, 100));
                        setAlertCounts((prev) => ({
                            ...prev,
                            [data.event.level]: (prev[data.event.level] ?? 0) + 1,
                        }));
                        if (data.event.level !== 'info' && bootDoneRef.current) {
                            pushToast({
                                level: data.event.level,
                                title: `${data.event.level.toUpperCase()} · ${data.event.category}`,
                                message: data.event.message,
                            });
                        }
                        if (data.event.level !== 'info') {
                            appendLog(`[${data.event.level}] ${data.event.message}`);
                        }
                        return;
                    }
                } catch {
                    appendLog(`recv raw: ${ev.data.slice(0, 120)}`);
                }
            };
        };
        connect();
        return () => { clearTimeout(retry); wsRef.current?.close(); };
    }, []);

    const sendToEsp32 = (payload) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            appendLog('Cannot send: WS not open');
            return;
        }
        const text = JSON.stringify(payload);
        ws.send(text);
        appendLog(`send: ${text}`);
    };

    const updateEsp32Address = async (host, port) => {
        appendLog(`Updating ESP32 to ${host}:${port}`);
        try {
            const res = await fetch('/api/esp32', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host, port: Number(port) }),
            });
            const data = await res.json();
            setBridge((prev) => ({ ...prev, host: data.host, port: data.port }));
            pushToast({ level: 'info', title: 'Bridge updated', message: `Reconnecting to ${data.host}:${data.port}` });
        } catch (err) {
            appendLog(`Update failed: ${err.message}`);
        }
    };

    return (
        <>
            <MeshBackground />
            <div className="app">
                <header className="topbar section-enter">
                    <div className="brand">
                        <div className="logo-wrap"><LogoMark size={36} /></div>
                        <div>
                            <div className="brand-sub">IoT · Real-time</div>
                            <h1 className="brand-title">ESP32 Console</h1>
                        </div>
                    </div>
                    <div className="bridge">
                        <BridgeStatus
                            bridge={bridge}
                            wsReady={wsReady}
                            onUpdate={updateEsp32Address}
                        />
                        <ThemeToggle theme={theme} onToggle={toggleTheme} />
                    </div>
                </header>

                <Hero sensor={sensor} bridge={bridge} totalSamples={history.length} />

                <StatGrid
                    sensor={sensor}
                    history={history}
                    alertCounts={alertCounts}
                    esp32ConnectedSince={bridge.esp32ConnectedSince}
                />

                <SensorChart history={history} isLive={bridge.connected} />

                <section className="control-grid section-enter">
                    <GpioControl onSend={sendToEsp32} disabled={!bridge.connected} />
                    <AlertsPanel alerts={alerts} />
                </section>

                <div className="card section-enter">
                    <div className="card-label">
                        <ActivityIcon size={14} />
                        Activity log
                    </div>
                    <pre className="log-body">
                        {log.length ? log.join('\n') : (
                            <span className="log-empty">No events yet — waiting for the bridge.</span>
                        )}
                    </pre>
                </div>

                <Toasts toasts={toasts} onClose={closeToast} />
            </div>
        </>
    );
}
