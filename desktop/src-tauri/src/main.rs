#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
  net::TcpStream,
  process::{Child, Command, Stdio},
  sync::{Arc, Mutex},
  thread,
  time::Duration,
};

use tauri::{
  menu::{MenuBuilder, MenuItem, PredefinedMenuItem},
  tray::{TrayIconBuilder, TrayIconEvent},
  AppHandle, Emitter, Manager, Runtime,
};

use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

/// Shared state: backend child process handle.
/// Using std::process::Child (stable) avoids plugin-shell private API issues.
#[derive(Clone)]
struct BackendState {
  child: Arc<Mutex<Option<Child>>>,
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
  let about = PredefinedMenuItem::about(app, None, None)?;

  // Custom menu items with stable IDs (so matching works reliably)
  let show = MenuItem::with_id(app, "menu.show", "Show Window", true, None::<&str>)?;
  let restart_backend =
    MenuItem::with_id(app, "menu.restart_backend", "Restart Backend", true, None::<&str>)?;
  let toggle_autostart =
    MenuItem::with_id(app, "menu.toggle_autostart", "Toggle Auto-start", true, None::<&str>)?;

  let menu = MenuBuilder::new(app)
    .item(&about)
    .separator()
    .item(&show)
    .item(&restart_backend)
    .item(&toggle_autostart)
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

fn main() {
  tauri::Builder::default()
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

      Ok(())
    })
    .on_menu_event(|app, event| {
      let id = event.id().0.as_str();
      let state = app.state::<BackendState>();

      match id {
        "menu.show" => {
          show_main_window(app);
        }
        "menu.restart_backend" => {
          kill_backend(&state);
          let _ = spawn_backend(app, &state);
        }
        "menu.toggle_autostart" => {
          // Minimal toggle.
          // In a real app we’d persist a setting and read it on boot.
          // Here: if enabled => disable, else enable.
          let autostart = app.autolaunch();
          let currently_enabled = autostart.is_enabled().unwrap_or(false);
          if currently_enabled {
            let _ = autostart.disable();
            let _ = app.emit("autostart:disabled", ());
          } else {
            let _ = autostart.enable();
            let _ = app.emit("autostart:enabled", ());
          }
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
