# IOT Web Dashboard (Node + React)

Web bên ngoài (Node.js + React + Vite) để visualize dữ liệu nhiệt độ/độ ẩm
và bật/tắt GPIO trên ESP32 firmware ở thư mục cha. Node server đóng vai trò
**cầu nối WebSocket**: kết nối tới `ws://<ESP32_IP>/ws` và đẩy/lấy dữ liệu
với browser qua một WebSocket riêng.

## Cấu trúc

```
webapp/
  server/   Node Express + ws bridge + SQLite (port 3000 mặc định)
  client/   Vite + React UI (dev port 5173)
```

## Yêu cầu

- **Node.js 20+** (nvm: `nvm install 22 && nvm use 22`).
  `better-sqlite3@11` yêu cầu Node 20+. Node 18 sẽ segfault.
- ESP32 đã chạy firmware ở thư mục `../` (không bắt buộc — có demo mode).

## Cài đặt (chạy 1 lần)

```bash
cd webapp/server && npm install
cd ../client     && npm install
```

---

## 🚀 Cách chạy

### Cách 1 — Dev mode (2 terminal, có hot reload)

**Terminal 1 — Backend (Node bridge + SQLite)**

```bash
cd /home/tai/vscodemain/IOT/IOT_Project/webapp/server
cp .env.example .env          # chỉ lần đầu tiên — sửa ESP32_HOST cho đúng IP
node server.js                # hoặc: npm start
```

Khi chạy ok sẽ thấy:
```
[esp32] connecting -> ws://192.168.1.50:80/ws
[http] listening on http://localhost:3000
```

**Terminal 2 — Frontend (Vite dev server)**

```bash
cd /home/tai/vscodemain/IOT/IOT_Project/webapp/client
npm run dev
```

Vite sẽ in `Local: http://localhost:5173/` → mở browser vào đó.
Vite tự proxy `/ws` và `/api` về backend ở cổng 3000.

> Hot reload tự động: chỉnh code React, browser auto refresh.
> Đổi backend code → tự Ctrl+C terminal 1 rồi chạy lại.

### Cách 2 — Chạy không cần ESP32 (demo mode)

Sinh dữ liệu nhiệt/ẩm giả mỗi 5s để xem UI hoạt động:

```bash
# Terminal 1
cd /home/tai/vscodemain/IOT/IOT_Project/webapp/server
echo "DEMO=1" >> .env         # bật demo mode (1 lần duy nhất)
node server.js

# Terminal 2
cd /home/tai/vscodemain/IOT/IOT_Project/webapp/client
npm run dev
```

Khi xong demo, mở `.env` xóa dòng `DEMO=1` để tắt.

### Cách 3 — Production build (1 cổng duy nhất)

```bash
# Build frontend trước
cd /home/tai/vscodemain/IOT/IOT_Project/webapp/client
npm run build

# Rồi chạy backend — phục vụ luôn UI đã build
cd ../server
node server.js
```

Mở `http://localhost:3000`. Không cần Vite dev server nữa.

### Tắt server

`Ctrl+C` trong từng terminal.

### Cheat sheet

| Mục đích | Lệnh |
|---|---|
| Backend (đã có .env) | `cd webapp/server && node server.js` |
| Frontend dev | `cd webapp/client && npm run dev` |
| Build production | `cd webapp/client && npm run build` |
| Xem DB events | `sqlite3 webapp/server/data.sqlite "SELECT * FROM events ORDER BY ts DESC LIMIT 10;"` |
| Kill server zombie | `pkill -f "node.*server.js"` |
| Đổi IP ESP32 runtime | Sửa form trên UI (góc phải topbar) hoặc `POST /api/esp32` |

### Troubleshooting

| Lỗi | Cách fix |
|---|---|
| `Segmentation fault` | Node version cũ. Cần Node 20+. Reinstall: `rm -rf node_modules && npm install` |
| `ENOENT package.json` | Chạy sai thư mục. Phải `cd webapp/server` hoặc `cd webapp/client` trước |
| `EADDRINUSE :3000` | Có server cũ đang chạy. `pkill -f "node.*server.js"` |
| `Failed running 'server.js'. Waiting...` | `--watch` ẩn error. Chạy `node server.js` (không qua npm) để xem error thực |
| UI không update | Hard refresh `Ctrl+Shift+R`. Hoặc restart Vite. |

---

## Giao thức (đồng bộ với firmware)

- **Browser → Node → ESP32** (toggle GPIO):

  ```json
  { "page": "device", "value": { "name": "LED", "gpio": 2, "status": "ON" } }
  ```

- **ESP32 → Node → Browser** (sensor):

  ```json
  { "page": "sensor", "temperature": 27.5, "humidity": 65.2 }
  ```

- Node thêm message riêng cho bridge status + alerts:

  ```json
  { "page": "bridge", "connected": true, "host": "192.168.1.50", "port": 80 }
  { "page": "event",  "event": { "id": 42, "ts": 1731234, "level": "warning", "category": "temperature", "message": "..." } }
  ```

## Tính năng

- **Lưu DB SQLite** (`webapp/server/data.sqlite`) — readings + events.
  Auto purge sau 7 ngày (override `RETENTION_MS`).
- **Cảnh báo tự sinh** theo đúng ngưỡng firmware
  ([`src/temp_humi_monitor.cpp`](../src/temp_humi_monitor.cpp)):
  - Temp <25°C info / 25–30°C warning / >30°C **critical**
  - Humi <40% hoặc >70% warning
  - Sensor trả -1 → **error** "DHT20 read failed"
  - Bridge connect / lost → info / warning
- **Uptime tracking**: thời gian ESP32 đã kết nối liên tục.
- **Hero section** lớn với gradient text + count-up animation.
- **Stat grid** 4 thẻ (Temp / Humi / Uptime / Alerts) với:
  - Cursor-tracking spotlight (Linear-style)
  - 3D tilt khi hover
  - Sparkline mini-chart trong card
  - Flash pulse khi có data mới
- **Biểu đồ** AreaChart với range tabs (5m / 1h / 24h / All) +
  ngưỡng tham chiếu 25 / 30°C, LIVE/OFFLINE badge.
- **Alerts panel** real-time với slide-in animation.
- **Toasts** floating top-right khi có warning/critical/error.
- **GPIO control** + preset (LED, Relay 1/2, Fan), nút ON/OFF với ripple.
- **Theme toggle** light/dark (saved to localStorage).
- **Animated mesh background** + sticky glass topbar.
- **Demo mode** (`DEMO=1`) — generate dữ liệu giả khi không có ESP32.

## REST API

| Endpoint | Mô tả |
|----------|------|
| `GET /api/history?windowMs=...` | Readings trong cửa sổ thời gian |
| `GET /api/alerts?limit=...` | Sự kiện gần đây |
| `GET /api/stats` | Uptime, tổng readings, đếm alert 24h |
| `GET/POST /api/esp32` | Xem / đổi IP+port ESP32 runtime |

## Biến môi trường (.env)

| Var | Default | Mô tả |
|---|---|---|
| `ESP32_HOST` | `192.168.1.50` | IP của ESP32 |
| `ESP32_PORT` | `80` | Port WebSocket ESP32 |
| `PORT` | `3000` | Port Node server |
| `DB_FILE` | `./data.sqlite` | Đường dẫn SQLite file |
| `RETENTION_MS` | `604800000` | Lưu dữ liệu bao lâu (7 ngày) |
| `DEMO` | (off) | `=1` để sinh data giả mỗi 5s |

## Lưu ý

- Đảm bảo máy chạy Node cùng LAN với ESP32 (hoặc ESP32 reachable).
- ESP32 phải đang ở chế độ STA (đã kết nối Wi-Fi), AP mode 192.168.4.1
  vẫn dùng được nếu máy nối thẳng vào AP `ESP32 LOCAL`.
