var gateway = `ws://${window.location.hostname}/ws`;
var websocket;
var gaugeTemp;
var gaugeHumi;
var relayList = [];
var servoList = [];
var deleteTarget = null;

window.alert = function (message) {
    console.log(message);
};

window.addEventListener("load", function () {
    initGauges();
    initStatusPanel();
    loadRelays();
    loadServos();
    initServoControls();
    fetchSensorValues();
    fetchTinyMLValues();
    setInterval(fetchSensorValues, 2000);
    setInterval(fetchTinyMLValues, 5000);
    initWebSocket();
    bindSettingsForm();
    loadCoreIotForm();
});

function initWebSocket() {
    console.log("Trying to open a WebSocket connection...");
    websocket = new WebSocket(gateway);
    websocket.onopen = function () {
        console.log("Connection opened");
        setWifiState("Web page connected");
        registerSavedDevices();
    };
    websocket.onclose = function () {
        console.log("Connection closed");
        setWifiState("WebSocket disconnected. Retrying...");
        setTimeout(initWebSocket, 2000);
    };
    websocket.onmessage = onMessage;
}

function initGauges() {
    gaugeTemp = null;
    gaugeHumi = null;
}

function initStatusPanel() {
    updateApUrl(`http://${window.location.hostname}`);
    setWifiState("AP mode active");
}

function onMessage(event) {
    console.log("Received:", event.data);

    try {
        var data = JSON.parse(event.data);

        if (data.page === "setting_saved" && data.status === "connecting") {
            setWifiState("Saved. Trying to connect to Wi-Fi...");
            return;
        }

        if (data.page === "wifi") {
            handleWifiMessage(data);
            return;
        }

        if (data.page === "sensor") {
            updateSensorValues(data.temperature, data.humidity);
            return;
        }
        if (data.page === "device") {
            updateDeviceFromMessage(data.value || data);
            return;
        }
        if (data.page === "tinyml") {
            updateTinyMLValues(data);
        }
    } catch (error) {
        console.warn("Invalid JSON:", event.data, error);
    }
}

function handleWifiMessage(data) {
    if (data.ap_ip) {
        updateApUrl(`http://${data.ap_ip}`);
    }
    if (data.sta_ip) {
        updateStaUrl(`http://${data.sta_ip}`);
    }

    if (data.status === "ap_active") {
        setWifiState("AP mode active");
        setWifiConnectBusy(false);
        return;
    }

    if (data.status === "connecting") {
        setWifiState(`Connecting to ${data.ssid || "saved Wi-Fi"}...`);
        setWifiConnectBusy(true);
        return;
    }

    if (data.status === "connected") {
        var staIp = data.sta_ip ? ` (STA IP: ${data.sta_ip})` : "";
        setWifiState(`Connected to Wi-Fi${staIp}`);
        setWifiConnectBusy(false);
        return;
    }

    if (data.status === "already_connected") {
        var currentStaIp = data.sta_ip ? ` (STA IP: ${data.sta_ip})` : "";
        setWifiState(`Already connected to Wi-Fi${currentStaIp}`);
        setWifiConnectBusy(false);
        return;
    }

    if (data.status === "failed") {
        setWifiState("Wi-Fi connect failed. AP mode is still active.");
        setWifiConnectBusy(false);
        return;
    }

    if (data.status === "missing_ssid") {
        setWifiState("No saved Wi-Fi SSID. AP mode only.");
    }
}

function updateSensorValues(temperature, humidity) {
    var tempValue = Number(temperature);
    var humiValue = Number(humidity);

    if (!Number.isFinite(tempValue) || !Number.isFinite(humiValue)) {
        console.warn("Invalid sensor values:", temperature, humidity);
        return;
    }

    if (gaugeTemp) {
        gaugeTemp.refresh(tempValue);
    } else {
        setText("gauge_temp_value", `${tempValue.toFixed(1)} C`);
    }
    if (gaugeHumi) {
        gaugeHumi.refresh(humiValue);
    } else {
        setText("gauge_humi_value", `${humiValue.toFixed(1)} %`);
    }

    setText("temp_value", `${tempValue.toFixed(1)} C`);
    setText("humi_value", `${humiValue.toFixed(1)} %`);
}

function fetchSensorValues() {
    fetch("/sensors", { cache: "no-store" })
        .then(function (response) {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(function (data) {
            updateSensorValues(data.temperature, data.humidity);
        })
        .catch(function (error) {
            console.warn("Could not load sensor values:", error);
        });
}

function updateTinyMLValues(data) {
    if (data.status === "waiting") {
        setText("tinyml_state", "Waiting for first inference");
        setText("tinyml_result", "--");
        setText("tinyml_anomaly", "Waiting");
        setTinyMLBadge(false, "Waiting");
        return;
    }

    var temperature = Number(data.temperature);
    var humidity = Number(data.humidity);
    var result = Number(data.result);
    var isAnomaly = Boolean(data.is_anomaly);

    if (!Number.isFinite(result)) {
        console.warn("Invalid TinyML values:", data);
        return;
    }

    setText("tinyml_state", "Model running");
    setText("tinyml_result", result.toFixed(3));
    setText("tinyml_anomaly", isAnomaly ? "Anomaly detected" : "Normal");
    setText("tinyml_temp", Number.isFinite(temperature) ? `${temperature.toFixed(1)} C` : "--.- C");
    setText("tinyml_humi", Number.isFinite(humidity) ? `${humidity.toFixed(1)} %` : "--.- %");
    setText("tinyml_updated", new Date().toLocaleTimeString());
    setTinyMLBadge(isAnomaly, isAnomaly ? "Anomaly" : "Normal");
}

function updateDeviceFromMessage(data) {
    if (data && data.angle !== undefined) {
        updateServoFromMessage(data);
        return;
    }

    updateRelayFromMessage(data);
}

function updateRelayFromMessage(data) {
    if (!data || data.gpio === undefined || data.status === undefined) {
        return;
    }

    var gpio = String(data.gpio);
    var relayState = String(data.status).toUpperCase() === "ON";
    var relay = relayList.find(function (item) {
        return String(item.gpio) === gpio;
    });

    if (!relay) {
        relay = {
            id: Date.now(),
            name: data.name || `Relay GPIO ${gpio}`,
            gpio: gpio,
            state: relayState
        };
        relayList.push(relay);
    } else {
        relay.state = relayState;
    }

    persistRelays();
    renderRelays();
}

function updateServoFromMessage(data) {
    if (!data || data.gpio === undefined || data.angle === undefined) {
        return;
    }

    var gpio = String(data.gpio);
    var angle = clampServoAngle(data.angle);
    var servo = servoList.find(function (item) {
        return String(item.gpio) === gpio;
    });

    if (!servo) {
        servo = {
            id: Date.now(),
            name: data.name || `Servo GPIO ${gpio}`,
            gpio: gpio,
            angle: angle
        };
        servoList.push(servo);
    } else {
        servo.angle = angle;
    }

    persistServos();
    renderRelays();
}

function setTinyMLBadge(isAnomaly, label) {
    var badge = document.getElementById("tinyml_badge");
    if (!badge) {
        return;
    }

    badge.textContent = label;
    badge.classList.toggle("anomaly", isAnomaly);
}

function fetchTinyMLValues() {
    fetch("/tinyml", { cache: "no-store" })
        .then(function (response) {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(function (data) {
            updateTinyMLValues(data);
        })
        .catch(function (error) {
            console.warn("Could not load TinyML values:", error);
            setText("tinyml_state", "TinyML endpoint unavailable");
        });
}

function setWifiState(message) {
    setText("wifi_state", message);
}

function updateApUrl(url) {
    var link = document.getElementById("ap_url");
    if (!link) {
        return;
    }

    link.href = url;
    link.textContent = url;
}

function updateStaUrl(url) {
    var link = document.getElementById("sta_url");
    if (!link) {
        return;
    }

    link.href = url;
    link.textContent = url;
}

function setText(id, value) {
    var element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function setWifiConnectBusy(isBusy) {
    var button = document.getElementById("connectWifiBtn");
    if (!button) {
        return;
    }

    button.disabled = isBusy;
}

function Send_Data(data) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(data);
        console.log("Sent:", data);
        return;
    }

    console.warn("WebSocket is not ready");
    setWifiState("WebSocket is not connected yet.");
}

function showSection(id, event) {
    document.querySelectorAll(".section").forEach(function (section) {
        section.style.display = "none";
    });
    document.getElementById(id).style.display = (id === "settings" || id === "coreiot") ? "flex" : "block";
    document.querySelectorAll(".nav-item").forEach(function (item) {
        item.classList.remove("active");
    });

    if (event && event.currentTarget) {
        event.currentTarget.classList.add("active");
        return;
    }

    document.querySelectorAll(".nav-item").forEach(function (item) {
        var target = item.getAttribute("onclick") || "";
        if (target.indexOf(`'${id}'`) >= 0 || target.indexOf(`"${id}"`) >= 0) {
            item.classList.add("active");
        }
    });
}

function openAddRelayDialog() {
    document.getElementById("addRelayDialog").style.display = "flex";
}

function closeAddRelayDialog() {
    document.getElementById("addRelayDialog").style.display = "none";
}

function initServoControls() {
    if (!document.getElementById("addServoBtn")) {
        var button = document.createElement("button");
        button.id = "addServoBtn";
        button.className = "add-servo-btn";
        button.type = "button";
        button.innerHTML = '<i class="fa-solid fa-gauge-high"></i>';
        button.onclick = openAddServoDialog;
        var deviceSection = document.getElementById("device");
        (deviceSection || document.body).appendChild(button);
    }

    if (!document.getElementById("addServoDialog")) {
        var dialog = document.createElement("div");
        dialog.id = "addServoDialog";
        dialog.className = "dialog-overlay";
        dialog.style.display = "none";
        dialog.innerHTML = `
    <div class="dialog fade-in">
      <h3><i class="fa-solid fa-gauge-high"></i> Add servo</h3>
      <p>Enter servo name, GPIO pin, and initial angle.</p>
      <div class="input-field">
        <input type="text" id="servoName" placeholder="Servo name">
      </div>
      <div class="input-field">
        <input type="number" id="servoGPIO" placeholder="GPIO pin">
      </div>
      <div class="input-field">
        <input type="number" id="servoAngle" placeholder="Initial angle 0-180" value="90" min="0" max="180">
      </div>
      <div class="dialog-buttons">
        <button class="confirm" onclick="saveServo()">Save</button>
        <button class="cancel" onclick="closeAddServoDialog()">Cancel</button>
      </div>
    </div>
  `;
        document.body.appendChild(dialog);
    }
}

function openAddServoDialog() {
    document.getElementById("addServoDialog").style.display = "flex";
}

function closeAddServoDialog() {
    document.getElementById("addServoDialog").style.display = "none";
}

function saveRelay() {
    var name = document.getElementById("relayName").value.trim();
    var gpio = document.getElementById("relayGPIO").value.trim();

    if (!name || !gpio) {
        console.warn("Relay name and GPIO are required.");
        return;
    }

    relayList.push({ id: Date.now(), name: name, gpio: gpio, state: false });
    persistRelays();
    renderRelays();
    sendRelayState(relayList[relayList.length - 1]);
    closeAddRelayDialog();
}

function saveServo() {
    var name = document.getElementById("servoName").value.trim();
    var gpio = document.getElementById("servoGPIO").value.trim();
    var angle = clampServoAngle(document.getElementById("servoAngle").value);

    if (!name || !gpio) {
        console.warn("Servo name and GPIO are required.");
        return;
    }

    var servo = { id: Date.now(), name: name, gpio: gpio, angle: angle };
    servoList.push(servo);
    persistServos();
    renderRelays();
    sendServoState(servo);
    closeAddServoDialog();
}

function renderRelays() {
    var container = document.getElementById("relayContainer");
    container.innerHTML = "";

    relayList.forEach(function (relay) {
        var card = document.createElement("div");
        card.className = "device-card";
        card.innerHTML = `
      <i class="fa-solid fa-bolt device-icon"></i>
      <h3>${relay.name}</h3>
      <p>GPIO: ${relay.gpio}</p>
      <button class="toggle-btn ${relay.state ? "on" : ""}" onclick="toggleRelay(${relay.id})">
        ${relay.state ? "ON" : "OFF"}
      </button>
      <i class="fa-solid fa-trash delete-icon" onclick="showDeleteDialog(${relay.id}, 'relay')"></i>
    `;
        container.appendChild(card);
    });

    servoList.forEach(function (servo) {
        var card = document.createElement("div");
        card.className = "device-card servo-card";
        card.setAttribute("data-servo-id", servo.id);
        card.innerHTML = `
      <i class="fa-solid fa-gauge-high device-icon"></i>
      <h3>${servo.name}</h3>
      <p>GPIO: ${servo.gpio}</p>
      <div class="servo-angle-value">${servo.angle} deg</div>
      <input class="servo-slider" type="range" min="0" max="180" value="${servo.angle}" oninput="previewServoAngle(${servo.id}, this.value)" onchange="setServoAngle(${servo.id}, this.value)">
      <div class="servo-quick-actions">
        <button onclick="setServoAngle(${servo.id}, 0)">0</button>
        <button onclick="setServoAngle(${servo.id}, 90)">90</button>
        <button onclick="setServoAngle(${servo.id}, 180)">180</button>
      </div>
      <i class="fa-solid fa-trash delete-icon" onclick="showDeleteDialog(${servo.id}, 'servo')"></i>
    `;
        container.appendChild(card);
    });
}

function toggleRelay(id) {
    var relay = relayList.find(function (item) {
        return item.id === id;
    });

    if (!relay) {
        return;
    }

    relay.state = !relay.state;
    persistRelays();
    sendRelayState(relay);
    renderRelays();
}

function sendRelayState(relay) {
    Send_Data(JSON.stringify({
        page: "device",
        value: {
            name: relay.name,
            status: relay.state ? "ON" : "OFF",
            gpio: relay.gpio
        }
    }));
}

function previewServoAngle(id, angle) {
    var servo = servoList.find(function (item) {
        return item.id === id;
    });

    if (!servo) {
        return;
    }

    servo.angle = clampServoAngle(angle);
    persistServos();

    var card = document.querySelector(`[data-servo-id="${id}"]`);
    if (card) {
        var value = card.querySelector(".servo-angle-value");
        if (value) {
            value.textContent = `${servo.angle} deg`;
        }
    }
}

function setServoAngle(id, angle) {
    var servo = servoList.find(function (item) {
        return item.id === id;
    });

    if (!servo) {
        return;
    }

    servo.angle = clampServoAngle(angle);
    persistServos();
    sendServoState(servo);
    renderRelays();
}

function sendServoState(servo) {
    Send_Data(JSON.stringify({
        page: "device",
        value: {
            type: "servo",
            name: servo.name,
            gpio: servo.gpio,
            angle: servo.angle
        }
    }));
}

function registerSavedDevices() {
    relayList.forEach(sendRelayState);
    servoList.forEach(sendServoState);
}

function clampServoAngle(angle) {
    var value = Number(angle);
    if (!Number.isFinite(value)) {
        return 90;
    }

    return Math.max(0, Math.min(180, Math.round(value)));
}

function showDeleteDialog(id, type) {
    deleteTarget = { id: id, type: type || "relay" };
    document.getElementById("confirmDeleteDialog").style.display = "flex";
}

function closeConfirmDelete() {
    document.getElementById("confirmDeleteDialog").style.display = "none";
}

function confirmDelete() {
    if (deleteTarget && deleteTarget.type === "servo") {
        servoList = servoList.filter(function (servo) {
            return servo.id !== deleteTarget.id;
        });
        persistServos();
    } else {
        var relayId = deleteTarget && deleteTarget.id !== undefined ? deleteTarget.id : deleteTarget;
        relayList = relayList.filter(function (relay) {
            return relay.id !== relayId;
        });
        persistRelays();
    }

    deleteTarget = null;
    persistRelays();
    renderRelays();
    closeConfirmDelete();
}

function loadRelays() {
    var saved = localStorage.getItem("relay_list");
    if (!saved) {
        return;
    }

    try {
        var relays = JSON.parse(saved);
        if (Array.isArray(relays)) {
            relayList = relays;
            renderRelays();
        }
    } catch (error) {
        console.warn("Could not load relay list:", error);
    }
}

function loadServos() {
    var saved = localStorage.getItem("servo_list");
    if (!saved) {
        return;
    }

    try {
        var servos = JSON.parse(saved);
        if (Array.isArray(servos)) {
            servoList = servos.map(function (servo) {
                servo.angle = clampServoAngle(servo.angle);
                return servo;
            });
            renderRelays();
        }
    } catch (error) {
        console.warn("Could not load servo list:", error);
    }
}

function persistRelays() {
    localStorage.setItem("relay_list", JSON.stringify(relayList));
}

function persistServos() {
    localStorage.setItem("servo_list", JSON.stringify(servoList));
}

function bindSettingsForm() {
    var wifiForm = document.getElementById("wifiConfigForm");
    if (wifiForm) {
        wifiForm.addEventListener("submit", function (event) {
            event.preventDefault();

            var ssid = document.getElementById("ssid").value.trim();
            var password = document.getElementById("password").value.trim();

            connectWifiFromWeb(ssid, password);
        });
    }

    var deviceForm = document.getElementById("deviceConfigForm");
    if (!deviceForm) {
        return;
    }

    deviceForm.addEventListener("submit", function (event) {
        event.preventDefault();

        var config = readCoreIotForm();
        saveDeviceConfig(config);
    });
}

function readCoreIotForm() {
    return {
        sensorToken: document.getElementById("sensorToken").value.trim(),
        relayToken: document.getElementById("relayToken").value.trim(),
        servoToken: document.getElementById("servoToken").value.trim(),
        server: document.getElementById("server").value.trim(),
        port: document.getElementById("port").value.trim()
    };
}

function loadCoreIotForm() {
    var saved = localStorage.getItem("coreiot_config");
    if (!saved) {
        return;
    }

    try {
        var config = JSON.parse(saved);
        setInputValue("sensorToken", config.sensorToken || config.token);
        setInputValue("relayToken", config.relayToken);
        setInputValue("servoToken", config.servoToken);
        setInputValue("server", config.server);
        setInputValue("port", config.port);
    } catch (error) {
        console.warn("Could not load saved CoreIoT form:", error);
    }
}

function setInputValue(id, value) {
    var input = document.getElementById(id);
    if (input && value !== undefined && value !== null && value !== "") {
        input.value = value;
    }
}

function connectWifiFromWeb(ssid, password) {
    var params = new URLSearchParams({
        ssid: ssid,
        password: password
    });

    setWifiState("Saving Wi-Fi and connecting...");
    setWifiConnectBusy(true);

    fetch(`/wifi/connect?${params.toString()}`, { cache: "no-store" })
        .then(function (response) {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(function () {
            setWifiState("Saved. Trying to connect to Wi-Fi...");
        })
        .catch(function (error) {
            console.warn("Could not connect Wi-Fi over HTTP:", error);
            setWifiConnectBusy(false);
            Send_Data(JSON.stringify({
                page: "setting",
                value: {
                    ssid: ssid,
                    password: password,
                    sensor_token: document.getElementById("sensorToken").value.trim(),
                    relay_token: document.getElementById("relayToken").value.trim(),
                    servo_token: document.getElementById("servoToken").value.trim(),
                    server: document.getElementById("server").value.trim(),
                    port: document.getElementById("port").value.trim()
                }
            }));
        });
}

function saveDeviceConfig(config) {
    var params = new URLSearchParams({
        sensor_token: config.sensorToken,
        relay_token: config.relayToken,
        servo_token: config.servoToken,
        server: config.server,
        port: config.port
    });

    setWifiState("Saving CoreIoT devices...");

    fetch(`/device/config?${params.toString()}`, { cache: "no-store" })
        .then(function (response) {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(function () {
            localStorage.setItem("coreiot_config", JSON.stringify(config));
            setWifiState("Sensor, relay, and servo are linked to CoreIoT.");
        })
        .catch(function (error) {
            console.warn("Could not save device configuration over HTTP:", error);
            Send_Data(JSON.stringify({
                page: "setting",
                value: {
                    ssid: document.getElementById("ssid").value.trim(),
                    password: document.getElementById("password").value.trim(),
                    sensor_token: config.sensorToken,
                    relay_token: config.relayToken,
                    servo_token: config.servoToken,
                    server: config.server,
                    port: config.port
                }
            }));
        });
}
