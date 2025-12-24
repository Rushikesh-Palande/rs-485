#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
  net::TcpStream,
  sync::{Arc, Mutex},
  thread,
  time::Duration,
};

use tauri::{
  menu::{MenuBuilder, MenuItem, PredefinedMenuItem},
  tray::{TrayIconBuilder, TrayIconEvent},
  AppHandle, Manager, Runtime,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_shell::{process::Child, process::Command, ShellExt};

/// Shared state: backend child process handle.
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
}

/// Try to connect to backend TCP port.
/// This is a cheap health probe (no HTTP dependency).
fn backend_port_open(host: &str, port: u16) -> bool {
  TcpStream::connect_timeout(
    &format!("{host}:{port}").parse().unwrap(),
    Duration::from_millis(150),
  )
  .is_ok()
}

/// Spawn backend sidecar and store handle.
fn spawn_backend<R: Runtime>(app: &AppHandle<R>, state: &BackendState) -> anyhow::Result<()> {
  let shell = app.shell();

  let mut cmd = Command::new_sidecar("rs485-backend")
    .map_err(|e| anyhow::anyhow!("create sidecar command failed: {e:?}"))?;

  // Tight defaults for desktop mode.
  // Your backend reads these in Settings().
  cmd = cmd
    .env("APP_ENV", "prod")
    .env("LOG_LEVEL", "INFO")
    .env("HOST", "127.0.0.1")
    .env("PORT", "8000");

  let child = shell
    .spawn(cmd)
    .map_err(|e| anyhow::anyhow!("spawn sidecar failed: {e:?}"))?;

  *state.child.lock().unwrap() = Some(child);

  // Notify frontend (optional)
  let _ = app.emit("backend:spawned", ());

  Ok(())
}

/// Kill backend if running.
fn kill_backend(state: &BackendState) {
  if let Some(child) = state.child.lock().unwrap().as_mut() {
    let _ = child.kill();
  }
  *state.child.lock().unwrap() = None;
}

/// Crash-safe watchdog:
/// - If backend dies or port stops responding, restart it.
/// - This protects you from random crashes / user kills.
/// - Very cheap and extremely reliable.
fn start_watchdog<R: Runtime>(app: AppHandle<R>, state: BackendState) {
  thread::spawn(move || {
    let host = "127.0.0.1";
    let port = 8000u16;

    // Require multiple failures before restart to avoid flapping.
    let mut fails = 0u8;

    loop {
      thread::sleep(Duration::from_secs(2));

      // If app is exiting, this handle becomes invalid; best effort exit.
      if app.get_webview_window("main").is_none() {
        break;
      }

      if backend_port_open(host, port) {
        fails = 0;
        continue;
      }

      fails = fails.saturating_add(1);

      // After 3 consecutive failures => restart
      if fails >= 3 {
        kill_backend(&state);
        let _ = spawn_backend(&app, &state);
        fails = 0;
      }
    }
  });
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
  let handle = app;

  // "App" menu (macOS) + common actions
  let quit = PredefinedMenuItem::quit(handle, None)?;
  let about = PredefinedMenuItem::about(handle, None, None)?;

  let show = MenuItem::new(handle, "Show Window", true, None::<&str>)?;
  let restart_backend = MenuItem::new(handle, "Restart Backend", true, None::<&str>)?;
  let toggle_autostart = MenuItem::new(handle, "Toggle Auto-start", true, None::<&str>)?;

  let menu = MenuBuilder::new(handle)
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

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
    .setup(|app| {
      let state = BackendState::new();

      // 1) Spawn backend
      // In dev, you can run backend manually. In prod builds, we always spawn.
      let _ = spawn_backend(&app.handle(), &state);

      // 2) Watchdog to keep backend alive
      start_watchdog(app.handle(), state.clone());

      // 3) Native menu (top bar / app menu)
      let menu = build_menu(&app.handle())?;
      app.set_menu(menu)?;

      // 4) Tray icon + tray menu
      let tray_menu = build_menu(&app.handle())?;
      let _tray = TrayIconBuilder::new()
        .menu(&tray_menu)
        .on_tray_icon_event(|tray, event| match event {
          TrayIconEvent::Click { .. } => {
            if let Some(w) = tray.app_handle().get_webview_window("main") {
              let _ = w.show();
              let _ = w.set_focus();
            }
          }
          _ => {}
        })
        .build(app)?;

      // Store state so commands/menu events can access
      app.manage(state);

      Ok(())
    })
    .on_menu_event(|app, event| {
      let id = event.id().0.as_str();

      let state = app.state::<BackendState>();

      match id {
        "quit" => {
          kill_backend(&state);
          app.exit(0);
        }
        _ => {
          // MenuItem ids are auto-generated unless you set custom ids.
          // We match by text via event.id() in real apps; simplest approach here:
          // We'll use labels below by defining custom IDs on items if you want strict matching.
        }
      }
    })
    .on_window_event(|app, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        // Hide instead of close (enterprise desktop UX)
        api.prevent_close();

        if let Some(w) = app.get_webview_window("main") {
          let _ = w.hide();
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
