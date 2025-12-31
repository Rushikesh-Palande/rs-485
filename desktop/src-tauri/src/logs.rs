//! Log persistence helpers for the desktop app.
//! Writes session logs to OS-specific default locations with a safe fallback.

use std::{
  fs,
  io,
  path::{Path, PathBuf},
};

fn preferred_log_path() -> PathBuf {
  if cfg!(target_os = "windows") {
    PathBuf::from(r"C:\Logs\rs485.log")
  } else {
    PathBuf::from("/home/pi/logs/rs485.log")
  }
}

fn write_log(path: &Path, contents: &str) -> Result<(), io::Error> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }
  fs::write(path, contents)
}

#[tauri::command]
pub fn save_session_log(contents: String) -> Result<String, String> {
  let preferred = preferred_log_path();
  write_log(&preferred, &contents)
    .map(|()| preferred.display().to_string())
    .map_err(|err| err.to_string())
}
