// Alert detection — thresholds mirror the firmware semaphores in
// src/temp_humi_monitor.cpp (semTempNormal/Warn/Crit, semHumiLow/Normal/High).

export const TEMP_WARN = 25;
export const TEMP_CRIT = 30;
export const HUMI_LOW = 40;
export const HUMI_HIGH = 70;

export function classifyTemp(t) {
    if (!Number.isFinite(t) || t < 0) return 'unknown';
    if (t < TEMP_WARN) return 'normal';
    if (t <= TEMP_CRIT) return 'warning';
    return 'critical';
}

export function classifyHumi(h) {
    if (!Number.isFinite(h) || h < 0) return 'unknown';
    if (h < HUMI_LOW) return 'low';
    if (h <= HUMI_HIGH) return 'normal';
    return 'high';
}

function tempEvent(level, ts, value) {
    const message = {
        critical: `Temperature critical: ${value.toFixed(1)}°C (over ${TEMP_CRIT}°C)`,
        warning: `Temperature elevated: ${value.toFixed(1)}°C`,
        normal: `Temperature back to normal: ${value.toFixed(1)}°C`,
    }[level];
    const sev = { critical: 'critical', warning: 'warning', normal: 'info' }[level];
    return { ts, level: sev, category: 'temperature', message, meta: { value } };
}

function humiEvent(level, ts, value) {
    const message = {
        high: `Humidity high: ${value.toFixed(1)}% (over ${HUMI_HIGH}%)`,
        low: `Humidity low: ${value.toFixed(1)}% (under ${HUMI_LOW}%)`,
        normal: `Humidity back to normal: ${value.toFixed(1)}%`,
    }[level];
    const sev = { high: 'warning', low: 'warning', normal: 'info' }[level];
    return { ts, level: sev, category: 'humidity', message, meta: { value } };
}

export function detectAlerts({ ts, temp, humi, prev }) {
    const alerts = [];

    // Sensor failure (firmware writes -1 when read fails)
    if (!Number.isFinite(temp) || !Number.isFinite(humi) || temp < 0 || humi < 0) {
        if (prev.sensorOk !== false) {
            alerts.push({
                ts,
                level: 'error',
                category: 'sensor',
                message: 'DHT20 read failed — sensor returned invalid values',
                meta: { temp, humi },
            });
        }
        return { alerts, next: { ...prev, sensorOk: false } };
    }

    const sensorRecovered = prev.sensorOk === false;
    if (sensorRecovered) {
        alerts.push({
            ts,
            level: 'info',
            category: 'sensor',
            message: 'DHT20 sensor recovered',
            meta: { temp, humi },
        });
    }

    const tLevel = classifyTemp(temp);
    if (tLevel !== prev.tempLevel && tLevel !== 'unknown') {
        alerts.push(tempEvent(tLevel, ts, temp));
    }

    const hLevel = classifyHumi(humi);
    if (hLevel !== prev.humiLevel && hLevel !== 'unknown') {
        alerts.push(humiEvent(hLevel, ts, humi));
    }

    return {
        alerts,
        next: { sensorOk: true, tempLevel: tLevel, humiLevel: hLevel },
    };
}

export const initialAlertState = { sensorOk: null, tempLevel: null, humiLevel: null };
