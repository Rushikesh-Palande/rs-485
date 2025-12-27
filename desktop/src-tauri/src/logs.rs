//! Log persistence helpers for the desktop app.
//! Writes session logs to OS-specific default locations with a safe fallback.

use std::{
  env,
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

fn fallback_log_path() -> Option<PathBuf> {
  if cfg!(target_os = "windows") {
    env::var("USERPROFILE")
      .ok()
      .map(|home| Path::new(&home).join("Logs").join("rs485.log"))
  } else {
    env::var("HOME")
      .ok()
      .map(|home| Path::new(&home).join("logs").join("rs485.log"))
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
  match write_log(&preferred, &contents) {
    Ok(()) => Ok(preferred.display().to_string()),
    Err(err) => {
      let fallback = fallback_log_path().filter(|path| path != &preferred);
      if let Some(path) = fallback {
        if write_log(&path, &contents).is_ok() {
          return Ok(path.display().to_string());
        }
      }
      Err(err.to_string())
    }
  }
}
