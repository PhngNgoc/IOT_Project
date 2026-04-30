var gateway = `ws://${window.location.hostname}/ws`;
var websocket;
var gaugeTemp;
var gaugeHumi;
var relayList = [];
var deleteTarget = null;

window.alert = function (message) {
    console.log(message);
};

window.addEventListener("load", function () {
    initGauges();
    initStatusPanel();
    fetchSensorValues();
    setInterval(fetchSensorValues, 2000);
    initWebSocket();
    bindSettingsForm();
});

function initWebSocket() {
    console.log("Trying to open a WebSocket connection...");
    websocket = new WebSocket(gateway);
    websocket.onopen = function () {
        console.log("Connection opened");
        setWifiState("Web page connected");
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
    document.getElementById(id).style.display = id === "settings" ? "flex" : "block";
    document.querySelectorAll(".nav-item").forEach(function (item) {
        item.classList.remove("active");
    });
    event.currentTarget.classList.add("active");
}

function openAddRelayDialog() {
    document.getElementById("addRelayDialog").style.display = "flex";
}

function closeAddRelayDialog() {
    document.getElementById("addRelayDialog").style.display = "none";
}

function saveRelay() {
    var name = document.getElementById("relayName").value.trim();
    var gpio = document.getElementById("relayGPIO").value.trim();

    if (!name || !gpio) {
        console.warn("Relay name and GPIO are required.");
        return;
    }

    relayList.push({ id: Date.now(), name: name, gpio: gpio, state: false });
    renderRelays();
    closeAddRelayDialog();
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
      <i class="fa-solid fa-trash delete-icon" onclick="showDeleteDialog(${relay.id})"></i>
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
    Send_Data(JSON.stringify({
        page: "device",
        value: {
            name: relay.name,
            status: relay.state ? "ON" : "OFF",
            gpio: relay.gpio
        }
    }));
    renderRelays();
}

function showDeleteDialog(id) {
    deleteTarget = id;
    document.getElementById("confirmDeleteDialog").style.display = "flex";
}

function closeConfirmDelete() {
    document.getElementById("confirmDeleteDialog").style.display = "none";
}

function confirmDelete() {
    relayList = relayList.filter(function (relay) {
        return relay.id !== deleteTarget;
    });
    renderRelays();
    closeConfirmDelete();
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

        var token = document.getElementById("token").value.trim();
        var server = document.getElementById("server").value.trim();
        var port = document.getElementById("port").value.trim();

        saveDeviceConfig(token, server, port);
    });
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
                    token: document.getElementById("token").value.trim(),
                    server: document.getElementById("server").value.trim(),
                    port: document.getElementById("port").value.trim()
                }
            }));
        });
}

function saveDeviceConfig(token, server, port) {
    var params = new URLSearchParams({
        token: token,
        server: server,
        port: port
    });

    setWifiState("Saving device configuration...");

    fetch(`/device/config?${params.toString()}`, { cache: "no-store" })
        .then(function (response) {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(function () {
            setWifiState("Device configuration saved.");
        })
        .catch(function (error) {
            console.warn("Could not save device configuration over HTTP:", error);
            Send_Data(JSON.stringify({
                page: "setting",
                value: {
                    ssid: document.getElementById("ssid").value.trim(),
                    password: document.getElementById("password").value.trim(),
                    token: token,
                    server: server,
                    port: port
                }
            }));
        });
}
