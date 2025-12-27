//! Serial port commands and shared state for the desktop app.
//! Provides Tauri commands, config/status types, and helpers for serial I/O.

use std::{
  fs,
  io::{ErrorKind, Read, Write},
  path::Path,
  sync::Mutex,
  time::Duration,
};

use tauri::State;

#[cfg(unix)]
use std::os::unix::io::AsRawFd;
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;

pub struct SerialState {
  pub port: Mutex<Option<Box<dyn serialport::SerialPort>>>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialConfig {
  pub port: String,
  pub baud: u32,
  pub parity: String,
  pub stop_bits: String,
  pub data_bits: u8,
  pub read_timeout_ms: u64,
  pub write_timeout_ms: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialStatus {
  pub port: String,
  pub baud: u32,
  pub parity: String,
  pub stop_bits: String,
  pub data_bits: u8,
  pub timeout_ms: u64,
  pub fd: Option<i64>,
  pub handle: Option<i64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialRead {
  pub len: usize,
  pub text: String,
  pub hex: String,
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

fn hex_to_bytes(input: &str) -> Result<Vec<u8>, String> {
  let filtered: String = input.chars().filter(|c| !c.is_whitespace()).collect();
  if filtered.len() % 2 != 0 {
    return Err("Hex input must have an even number of digits".to_string());
  }

  let mut bytes = Vec::with_capacity(filtered.len() / 2);
  let chars: Vec<char> = filtered.chars().collect();
  for i in (0..chars.len()).step_by(2) {
    let hi = chars[i].to_digit(16).ok_or_else(|| "Invalid hex digit".to_string())?;
    let lo = chars[i + 1].to_digit(16).ok_or_else(|| "Invalid hex digit".to_string())?;
    bytes.push(((hi << 4) | lo) as u8);
  }
  Ok(bytes)
}

fn bytes_to_hex(bytes: &[u8]) -> String {
  bytes
    .iter()
    .map(|b| format!("{:02X}", b))
    .collect::<Vec<_>>()
    .join(" ")
}

#[tauri::command]
pub fn list_serial_ports() -> Vec<String> {
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

#[tauri::command]
pub fn open_serial_port(
  state: State<SerialState>,
  config: SerialConfig,
) -> Result<SerialStatus, String> {
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
pub fn close_serial_port(state: State<SerialState>) -> Result<(), String> {
  let mut guard = state.port.lock().map_err(|_| "Serial port mutex poisoned".to_string())?;
  *guard = None;
  eprintln!("[serial] close ok");
  Ok(())
}

#[tauri::command]
pub fn write_serial_data(
  state: State<SerialState>,
  data: String,
  format: Option<String>,
) -> Result<usize, String> {
  let mut guard = state.port.lock().map_err(|_| "Serial port mutex poisoned".to_string())?;
  let port = guard.as_mut().ok_or_else(|| "Serial port not open".to_string())?;
  let bytes = match format.as_deref() {
    Some("hex") => hex_to_bytes(&data)?,
    _ => data.into_bytes(),
  };

  port.write_all(&bytes).map_err(|err| err.to_string())?;
  port.flush().map_err(|err| err.to_string())?;
  eprintln!("[serial] write ok bytes={}", bytes.len());
  Ok(bytes.len())
}

#[tauri::command]
pub fn read_serial_data(
  state: State<SerialState>,
  max_bytes: Option<usize>,
) -> Result<SerialRead, String> {
  let mut guard = state.port.lock().map_err(|_| "Serial port mutex poisoned".to_string())?;
  let port = guard.as_mut().ok_or_else(|| "Serial port not open".to_string())?;
  let mut buf = vec![0u8; max_bytes.unwrap_or(1024)];

  let n = match port.read(&mut buf) {
    Ok(count) => count,
    Err(err) if err.kind() == ErrorKind::TimedOut => 0,
    Err(err) => return Err(err.to_string()),
  };

  buf.truncate(n);
  let text = String::from_utf8_lossy(&buf).to_string();
  let hex = bytes_to_hex(&buf);
  eprintln!("[serial] read ok bytes={}", n);
  Ok(SerialRead { len: n, text, hex })
}
