#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
  fs,
  net::TcpStream,
  path::Path,
  process::{Child, Command, Stdio},
  sync::{Arc, Mutex},
  thread,
  time::Duration,
};

use tauri::{
  menu::{MenuBuilder, MenuItem, PredefinedMenuItem},
  tray::{TrayIconBuilder, TrayIconEvent},
  AppHandle, Emitter, Manager, Runtime, State,
};

use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

#[cfg(unix)]
use std::os::unix::io::AsRawFd;
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;
/// Shared state: backend child process handle.
/// Using std::process::Child (stable) avoids plugin-shell private API issues.
#[derive(Clone)]
struct BackendState {
  child: Arc<Mutex<Option<Child>>>,
}

struct SerialState {
  port: Mutex<Option<Box<dyn serialport::SerialPort>>>,
}

impl BackendState {
  fn new() -> Self {
    Self {
      child: Arc::new(Mutex::new(None)),
    }
  }

  fn is_running(&self) -> bool {
    let mut guard = self.child.lock().expect("backend mutex poisoned");
    if let Some(child) = guard.as_mut() {
      match child.try_wait() {
        Ok(Some(_status)) => {
          // Process exited
          *guard = None;
          false
        }
        Ok(None) => true, // still running
        Err(_) => true,    // if unsure, assume running and let port probe decide
      }
    } else {
      false
    }
  }
}

/// Cheap health probe: “is TCP port open?”
fn backend_port_open(host: &str, port: u16) -> bool {
  TcpStream::connect_timeout(
    &format!("{host}:{port}").parse().unwrap(),
    Duration::from_millis(150),
  )
  .is_ok()
}

/// Spawn backend process (DEV default).
///
/// Enterprise notes:
/// - For dev, the most reliable approach is running uvicorn via python.
/// - For production installers, you’ll likely bundle a backend executable.
///   (I can give you the clean sidecar packaging next.)
fn spawn_backend<R: Runtime>(app: &AppHandle<R>, state: &BackendState) -> anyhow::Result<()> {
  // If it’s already running, do nothing.
  if state.is_running() {
    let _ = app.emit("backend:already_running", ());
    return Ok(());
  }

  // DEV spawn (runs from repo)
  // desktop/ -> ../backend
  let mut cmd = Command::new("python");
  cmd.args([
    "-m",
    "uvicorn",
    "rs485_app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
  ])
  .current_dir("../backend")
  .env("APP_ENV", "dev")
  .env("LOG_LEVEL", "INFO")
  .env("HOST", "127.0.0.1")
  .env("PORT", "8000")
  .stdout(Stdio::piped())
  .stderr(Stdio::piped());

  let child = cmd.spawn()?;
  *state.child.lock().expect("backend mutex poisoned") = Some(child);

  let _ = app.emit("backend:spawned", ());
  Ok(())
}

/// Kill backend if running (best effort).
fn kill_backend(state: &BackendState) {
  let mut guard = state.child.lock().expect("backend mutex poisoned");
  if let Some(mut child) = guard.take() {
    let _ = child.kill();
    let _ = child.wait();
  }
}

/// Crash-safe watchdog:
/// - If backend dies OR port stops responding, restart it.
/// - Requires multiple consecutive failures to avoid flapping.
fn start_watchdog<R: Runtime>(app: AppHandle<R>, state: BackendState) {
  thread::spawn(move || {
    let host = "127.0.0.1";
    let port = 8000u16;

    let mut fails: u8 = 0;

    loop {
      thread::sleep(Duration::from_secs(2));

      // If the main window is gone, app is exiting — break.
      if app.get_webview_window("main").is_none() {
        break;
      }

      // Probe health (port open)
      if backend_port_open(host, port) {
        fails = 0;
        continue;
      }

      fails = fails.saturating_add(1);
      let _ = app.emit("backend:health_failed", fails);

      // After 3 consecutive failures -> restart
      if fails >= 3 {
        kill_backend(&state);
        let _ = app.emit("backend:watchdog_restart", ());
        let _ = spawn_backend(&app, &state);
        fails = 0;
      }
    }
  });
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
  let quit = PredefinedMenuItem::quit(app, None)?;

  // Custom menu items with stable IDs (so matching works reliably)
  let about = MenuItem::with_id(app, "menu.about", "About", true, None::<&str>)?;
  let menu = MenuBuilder::new(app)
    .item(&about)
    .separator()
    .item(&quit)
    .build()?;

  Ok(menu)
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
  if let Some(w) = app.get_webview_window("main") {
    let _ = w.show();
    let _ = w.set_focus();
  }
}

#[tauri::command]
fn list_serial_ports() -> Vec<String> {
  let mut ports: Vec<String> = serialport::available_ports()
    .map(|ports| ports.into_iter().map(|port| port.port_name).collect())
    .unwrap_or_default();

  if let Ok(entries) = fs::read_dir("/dev") {
    for entry in entries.flatten() {
      if let Ok(name) = entry.file_name().into_string() {
        if name.starts_with("ttyUSB") || name.starts_with("ttyACM") {
          ports.push(format!("/dev/{name}"));
        }
      }
    }
  }

  if let Ok(entries) = fs::read_dir("/dev/serial/by-id") {
    for entry in entries.flatten() {
      let path = entry.path();
      if let Ok(target) = fs::read_link(&path) {
        let resolved = if target.is_absolute() {
          target
        } else {
          path
            .parent()
            .unwrap_or_else(|| Path::new("/dev"))
            .join(target)
        };
        if let Ok(canon) = resolved.canonicalize() {
          ports.push(canon.display().to_string());
        } else {
          ports.push(resolved.display().to_string());
        }
      }
    }
  }

  ports.sort();
  ports.dedup();
  ports
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SerialConfig {
  port: String,
  baud: u32,
  parity: String,
  stop_bits: String,
  data_bits: u8,
  read_timeout_ms: u64,
  write_timeout_ms: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SerialStatus {
  port: String,
  baud: u32,
  parity: String,
  stop_bits: String,
  data_bits: u8,
  timeout_ms: u64,
  fd: Option<i64>,
  handle: Option<i64>,
}

fn parse_parity(parity: &str) -> Result<serialport::Parity, String> {
  match parity {
    "None" => Ok(serialport::Parity::None),
    "Even" => Ok(serialport::Parity::Even),
    "Odd" => Ok(serialport::Parity::Odd),
    _ => Err(format!("Unsupported parity: {parity}")),
  }
}

fn parse_stop_bits(stop_bits: &str) -> Result<serialport::StopBits, String> {
  match stop_bits {
    "1" => Ok(serialport::StopBits::One),
    "2" => Ok(serialport::StopBits::Two),
    _ => Err(format!("Unsupported stop bits: {stop_bits}")),
  }
}

fn parse_data_bits(data_bits: u8) -> Result<serialport::DataBits, String> {
  match data_bits {
    5 => Ok(serialport::DataBits::Five),
    6 => Ok(serialport::DataBits::Six),
    7 => Ok(serialport::DataBits::Seven),
    8 => Ok(serialport::DataBits::Eight),
    _ => Err(format!("Unsupported data bits: {data_bits}")),
  }
}

#[tauri::command]
fn open_serial_port(state: State<SerialState>, config: SerialConfig) -> Result<SerialStatus, String> {
  if config.port.trim().is_empty() {
    return Err("Port is required".to_string());
  }

  eprintln!(
    "[serial] open requested port={} baud={} parity={} stop_bits={} data_bits={} read_timeout_ms={} write_timeout_ms={}",
    config.port,
    config.baud,
    config.parity,
    config.stop_bits,
    config.data_bits,
    config.read_timeout_ms,
    config.write_timeout_ms
  );

  {
    let mut guard = state.port.lock().map_err(|_| "Serial port mutex poisoned".to_string())?;
    *guard = None;
  }

  let parity = parse_parity(&config.parity)?;
  let stop_bits = parse_stop_bits(&config.stop_bits)?;
  let data_bits = parse_data_bits(config.data_bits)?;
  let timeout_ms = config.read_timeout_ms.max(config.write_timeout_ms).max(100);

  let builder = serialport::new(config.port.clone(), config.baud)
    .parity(parity)
    .stop_bits(stop_bits)
    .data_bits(data_bits)
    .timeout(Duration::from_millis(timeout_ms));

  #[cfg(unix)]
  let (port, fd, handle) = {
    let port = serialport::TTYPort::open(&builder).map_err(|err| err.to_string())?;
    let fd = port.as_raw_fd() as i64;
    (Box::new(port) as Box<dyn serialport::SerialPort>, Some(fd), None)
  };

  #[cfg(windows)]
  let (port, fd, handle) = {
    let port = serialport::COMPort::open(&builder).map_err(|err| err.to_string())?;
    let handle = port.as_raw_handle() as i64;
    (Box::new(port) as Box<dyn serialport::SerialPort>, None, Some(handle))
  };

  #[cfg(not(any(unix, windows)))]
  let (port, fd, handle) = {
    let port = builder.open().map_err(|err| err.to_string())?;
    (port, None, None)
  };

  let mut guard = state.port.lock().map_err(|_| "Serial port mutex poisoned".to_string())?;
  *guard = Some(port);
  eprintln!(
    "[serial] open ok port={} baud={} parity={} stop_bits={} data_bits={} timeout_ms={} fd={:?} handle={:?}",
    config.port,
    config.baud,
    config.parity,
    config.stop_bits,
    config.data_bits,
    timeout_ms,
    fd,
    handle
  );
  Ok(SerialStatus {
    port: config.port,
    baud: config.baud,
    parity: config.parity,
    stop_bits: config.stop_bits,
    data_bits: config.data_bits,
    timeout_ms,
    fd,
    handle,
  })
}

#[tauri::command]
fn close_serial_port(state: State<SerialState>) -> Result<(), String> {
  let mut guard = state.port.lock().map_err(|_| "Serial port mutex poisoned".to_string())?;
  *guard = None;
  Ok(())
}

fn read_first_match(path: &str, prefix: &str) -> Option<String> {
  let contents = fs::read_to_string(path).ok()?;
  contents
    .lines()
    .find_map(|line| line.strip_prefix(prefix).map(|value| value.trim().to_string()))
}

fn system_info_string() -> String {
  let os_pretty = read_first_match("/etc/os-release", "PRETTY_NAME=").map(|value| {
    value.trim_matches('"').to_string()
  });
  let kernel = fs::read_to_string("/proc/sys/kernel/osrelease").ok().map(|s| s.trim().to_string());
  let hostname = fs::read_to_string("/proc/sys/kernel/hostname").ok().map(|s| s.trim().to_string());

  let cpu_model = read_first_match("/proc/cpuinfo", "model name\t: ");
  let cpu_cores = fs::read_to_string("/proc/cpuinfo")
    .ok()
    .map(|s| s.lines().filter(|line| line.starts_with("processor\t:")).count());
  let mem_total_kb = read_first_match("/proc/meminfo", "MemTotal:")
    .and_then(|value| value.split_whitespace().next().and_then(|v| v.parse::<u64>().ok()));
  let mem_total_gb = mem_total_kb.map(|kb| (kb as f64) / 1024.0 / 1024.0);

  let distro = std::env::var("WSL_DISTRO_NAME").ok();
  let is_wsl = distro.is_some() || kernel.as_deref().unwrap_or("").to_lowercase().contains("microsoft");

  let mut lines = Vec::new();
  lines.push(format!("OS: {}", os_pretty.unwrap_or_else(|| std::env::consts::OS.to_string())));
  lines.push(format!("Kernel: {}", kernel.unwrap_or_else(|| "unknown".to_string())));
  lines.push(format!("Arch: {}", std::env::consts::ARCH));
  lines.push(format!("Hostname: {}", hostname.unwrap_or_else(|| "unknown".to_string())));
  if is_wsl {
    lines.push("WSL: true".to_string());
    if let Some(distro_name) = distro {
      lines.push(format!("WSL Distro: {}", distro_name));
    }
  }
  if let Some(model) = cpu_model {
    lines.push(format!("CPU: {}", model));
  }
  if let Some(cores) = cpu_cores {
    lines.push(format!("CPU Cores: {}", cores));
  }
  if let Some(gb) = mem_total_gb {
    lines.push(format!("Memory: {:.2} GB", gb));
  }

  lines.join("\n")
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![list_serial_ports, open_serial_port, close_serial_port])
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
    .setup(|app| {
      let state = BackendState::new();

      // 1) Spawn backend
      let handle = app.handle().clone();
      if let Err(e) = spawn_backend(&handle, &state) {
        let _ = handle.emit("backend:spawn_failed", format!("{e:?}"));
      }

      // 2) Watchdog
      start_watchdog(handle.clone(), state.clone());

      // 3) App menu
      let menu = build_menu(&handle)?;
      app.set_menu(menu)?;

      // 4) Tray menu + tray icon
      let tray_menu = build_menu(&handle)?;
      let _tray = TrayIconBuilder::new()
        .menu(&tray_menu)
        .on_tray_icon_event(|tray, event| match event {
          TrayIconEvent::Click { .. } => {
            show_main_window(&tray.app_handle());
          }
          _ => {}
        })
        .build(app)?;

      // Store state globally
      app.manage(state);
      app.manage(SerialState {
        port: Mutex::new(None),
      });

      Ok(())
    })
    .on_menu_event(|app, event| {
      let id = event.id().0.as_str();
      let state = app.state::<BackendState>();

      match id {
        "menu.about" => {
          let info = app.package_info();
          let message = format!(
            "{} v{}\nRS-485 Enterprise Telemetry Desktop\n\n{}",
            info.name,
            info.version,
            system_info_string()
          );
          app
            .dialog()
            .message(message)
            .title("About")
            .kind(MessageDialogKind::Info)
            .buttons(MessageDialogButtons::Ok)
            .show(|_| {});
        }
        "quit" => {
          kill_backend(&state);
          app.exit(0);
        }
        _ => {}
      }
    })
    .on_window_event(|app, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        // Hide instead of close (enterprise UX: app stays in tray)
        api.prevent_close();
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.hide();
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
