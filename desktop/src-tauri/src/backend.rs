//! Backend process management for the desktop app.
//! Provides spawn/kill utilities, a watchdog, and shared state for the backend child process.

use std::{
  net::TcpStream,
  process::{Child, Command, Stdio},
  sync::{Arc, Mutex},
  thread,
  time::Duration,
};

use tauri::{AppHandle, Emitter, Manager, Runtime};

/// Shared state: backend child process handle.
/// Using std::process::Child (stable) avoids plugin-shell private API issues.
#[derive(Clone)]
pub struct BackendState {
  child: Arc<Mutex<Option<Child>>>,
}

impl BackendState {
  pub fn new() -> Self {
    Self {
      child: Arc::new(Mutex::new(None)),
    }
  }

  pub fn is_running(&self) -> bool {
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
pub fn spawn_backend<R: Runtime>(app: &AppHandle<R>, state: &BackendState) -> anyhow::Result<()> {
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
pub fn kill_backend(state: &BackendState) {
  let mut guard = state.child.lock().expect("backend mutex poisoned");
  if let Some(mut child) = guard.take() {
    let _ = child.kill();
    let _ = child.wait();
  }
}

/// Crash-safe watchdog:
/// - If backend dies OR port stops responding, restart it.
/// - Requires multiple consecutive failures to avoid flapping.
pub fn start_watchdog<R: Runtime>(app: AppHandle<R>, state: BackendState) {
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
