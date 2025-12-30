# RS-485 Enterprise Telemetry (Web + Desktop)

This repository is an **enterprise-grade** RS-485 telemetry platform:

- **Backend (FastAPI)**: realtime WS streaming + REST history + analytics-ready storage
- **DB (MySQL + Alembic)**: future-proof schema that can store **any** RS-485 parameters
- **Frontend (Vite + React + Tailwind)**: high-performance dashboard
- **Desktop (Tauri v2)**: native app wrapper with tray/menu, autostart, backend watchdog, and recording export

> **Performance design goals**
> - WebGL charts (high FPS)
> - Client-side downsampling (LTTB) to keep rendering fast even at high sample rates
> - Virtualized parameter table (50k+ keys)
> - Record / Replay + Export as `.jsonl` for debugging

---

## 0) Repo hygiene before pushing to GitHub (IMPORTANT)

Your uploaded ZIP contained local artifacts (example: `.venv`, `node_modules`, `.git`).
Before you push to GitHub:

1. Delete local folders if they exist:
   - `backend/.venv/`
   - `frontend/node_modules/`
   - `desktop/node_modules/`
2. Ensure `.env` is NOT committed.
3. Commit only source code + config files.

A hardened `.gitignore` is included.

---

## 1) Prerequisites

### Backend
- Python **3.11+**
- `uv` package manager (recommended)

### Database
- MySQL 8.x running locally
- A database created, e.g. `rs485`

### Frontend / Desktop
- Node.js **20+**
- (Desktop) Rust toolchain

---

## 1.1) WSL USB port binding (Windows + WSL2)

If you are using a USB RS-485 adapter from Windows and want it inside WSL2, run these in **PowerShell (Admin)**:

```powershell
usbipd list
usbipd bind --busid 1-1
usbipd attach --wsl --busid 1-1
```

Replace `1-1` with the busid from `usbipd list`.

---

## 1.2) Desktop prerequisites by OS (Tauri)

### Windows
- Rust toolchain (MSVC)
- Visual Studio Build Tools (C++ workload)
- WebView2 runtime (usually preinstalled on Windows 10/11)

### macOS
- Xcode Command Line Tools: `xcode-select --install`

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  pkg-config \
  libssl-dev
```

### Linux (Fedora)
```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  openssl-devel \
  pkgconf
```

### Linux (Arch)
```bash
sudo pacman -S --needed \
  webkit2gtk \
  gtk3 \
  libayatana-appindicator \
  librsvg \
  openssl \
  pkgconf
```

> WSL2 note: Tauri GUI windows require WSLg. If WSLg is not working, run the desktop app on Windows host instead.

---

## 1.2.1) Session log save location + permissions

The Session Log window saves to fixed paths:

- Linux: `/home/pi/logs/rs485.log`
- Windows: `C:\Logs\rs485.log`

If you see `Save failed: Permission denied (os error 13)`, create the folder and grant the desktop app user write access.

Linux example:

```bash
sudo mkdir -p /home/pi/logs
sudo chown -R $USER:$USER /home/pi/logs
```

Windows example (run in an elevated PowerShell):

```powershell
mkdir C:\Logs
```

Ensure the user running the desktop app has write permissions to `C:\Logs`.

---

## 1.3) Raspberry Pi 4 (Debian 12, aarch64)

Recommended (most reliable):
- Run backend + frontend on the Pi.
- Access the UI from another machine via a browser.

Desktop app on Pi (optional):

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  pkg-config \
  libssl-dev
```

Build steps:

```bash
cd frontend
npm ci
npm run build

cd ../desktop
npm ci
npm run build
```

Notes:
- Tauri builds are slower on Pi.
- Add your user to the `dialout` group for serial access: `sudo usermod -aG dialout $USER`

---

## 1.4) Cross-compile desktop for Raspberry Pi (aarch64)

Install the Rust target and cross toolchain on your dev machine:

```bash
rustup target add aarch64-unknown-linux-gnu

sudo dpkg --add-architecture arm64
sudo apt update
sudo apt install -y \
  gcc-aarch64-linux-gnu \
  pkg-config \
  libwebkit2gtk-4.1-dev:arm64 \
  libgtk-3-dev:arm64 \
  libayatana-appindicator3-dev:arm64 \
  librsvg2-dev:arm64 \
  libssl-dev:arm64
```

Build:

```bash
cd desktop
PKG_CONFIG_ALLOW_CROSS=1 \
PKG_CONFIG_PATH=/usr/lib/aarch64-linux-gnu/pkgconfig:/usr/lib/pkgconfig \
CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
npm run build -- --target aarch64-unknown-linux-gnu
```

---

## 2) Quick start (Backend)

```bash
cd backend
uv sync --dev
uv run uvicorn rs485_app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

- `GET http://127.0.0.1:8000/api/health`

WebSocket:

- `ws://127.0.0.1:8000/ws/realtime`

---

## 3) MySQL + Migrations

### Option A (recommended): create a dedicated DB user

Create DB + user:

```sql
CREATE DATABASE IF NOT EXISTS rs485 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'rs485'@'localhost' IDENTIFIED BY 'rs485';
GRANT ALL PRIVILEGES ON rs485.* TO 'rs485'@'localhost';
FLUSH PRIVILEGES;
```

Set `backend/.env`:

```env
DATABASE_URL=mysql+pymysql://rs485:rs485@127.0.0.1:3306/rs485
```

Run migrations:

```bash
cd backend
uv run alembic -c alembic.ini upgrade head
```

### Option B: use your local MySQL root (root/root)

Yes you can, but **don’t use root in production**.

```env
DATABASE_URL=mysql+pymysql://root:root@127.0.0.1:3306/rs485
```

If you get an auth plugin error (`caching_sha2_password`), install `cryptography`:

```bash
cd backend
uv add cryptography
```

---

## 4) Quick start (Frontend Web)

```bash
cd frontend
npm ci
npm run dev
```

Open:

- `http://localhost:5173`

The UI connects to backend at `http://127.0.0.1:8000` by default.

Override via `frontend/.env`:

```env
VITE_API_BASE=http://127.0.0.1:8000
```

---

## 4.1) Frontend module layout (current)

- `frontend/src/modules/` holds feature modules: `devices`, `config`, `monitor`, `events`, `ui`.
- `frontend/src/shared/` holds shared UI primitives, utilities, and data helpers.
- Device-specific routes are:
  - `/devices/:deviceId/config`
  - `/devices/:deviceId/monitor`

---

## 5) Quick start (Desktop Tauri)

### Development
The desktop app runs an embedded Rust REST/WS server on `127.0.0.1:8000`.
Set `DATABASE_URL` if you want history endpoints to work.

```bash
cd desktop
npm ci
npm run dev
```

### Production build
Build the desktop app:

```bash
cd desktop
npm run build
```

---

## 6) Dashboard features

### WebGL charts
The dashboard uses **ECharts GL** for WebGL-accelerated series rendering.

### Downsampling (biggest win)
For each series, the UI runs **LTTB** downsampling to ~2000 points before rendering.
This keeps the chart smooth even if the backend publishes very fast telemetry.

### Virtualized table (50k params)
The parameter panel uses virtualization to keep DOM size stable.

### Multi-metric overlay
Select up to 6 numeric keys to overlay.

### Record / Replay + Export JSONL
- Record writes WS events into IndexedDB
- Replay streams from IndexedDB without backend
- Export saves to `.jsonl` (browser download or native save dialog in Tauri)

---

## 7) Desktop Rust ⇄ Frontend bindings

Key Tauri commands and where they are used in the React UI:

- **Serial ports and I/O** (`desktop/src-tauri/src/serial.rs`)
  - `list_serial_ports` → `frontend/src/modules/config/components/DeviceConfiguration.tsx` (Detect ports)
  - `open_serial_port` → `frontend/src/modules/config/components/DeviceConfiguration.tsx` (Save), `frontend/src/modules/monitor/components/DeviceMonitor.tsx` (Connect)
  - `close_serial_port` → `frontend/src/modules/monitor/components/DeviceMonitor.tsx` (Disconnect)
  - `write_serial_data` → `frontend/src/modules/monitor/components/DeviceMonitor.tsx` (Send)
  - `read_serial_data` → `frontend/src/modules/monitor/components/DeviceMonitor.tsx` (Read)

- **Session log saving** (`desktop/src-tauri/src/logs.rs`)
  - `save_session_log` → `frontend/src/modules/monitor/components/DeviceMonitor.tsx` (Save Log)

- **System info (About dialog)** (`desktop/src-tauri/src/system.rs`)
  - Used in `desktop/src-tauri/src/main.rs` for the app menu About dialog (not called directly by React).

All commands are registered in `desktop/src-tauri/src/main.rs` via `tauri::generate_handler![]` and invoked in the UI with `@tauri-apps/api/core` `invoke()`.

---

## 8) CI/CD (GitHub Actions)

Included workflows:

- `CI`: backend lint/test + frontend build + tauri build smoke
- `Release`: builds desktop apps on tag push (`vX.Y.Z`)

---

## 8) Troubleshooting

### WS connects but no data
Ensure backend is in `SERIAL_MODE=simulator` or your serial pipeline is producing events.

### Desktop closes instead of minimizing
This repo is configured to **hide window on close** and keep tray icon alive.

### Backend crashes in desktop
A watchdog checks port `127.0.0.1:8000` and restarts the sidecar if it dies.

### Serial port debug (Tauri desktop)
- Run the desktop app with logs: `cd desktop && npm run dev`
- Save config in the UI, then Connect to open the port.
- Tauri terminal logs include:
  - `[serial] open requested ...`
  - `[serial] open ok ...`
  - `[serial] write ok bytes=...`
  - `[serial] read ok bytes=...`
  - `[serial] close ok`
- If the port is busy, find the owning process: `lsof /dev/ttyUSB0`
- Verify the configured settings when the port is closed: `stty -F /dev/ttyUSB0 -a`

---

## License
Choose your license (MIT/Apache-2.0/etc.) and add `LICENSE`.
