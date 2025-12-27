//! System information helpers for the desktop app.
//! Provides OS-specific system info strings used in the About dialog.

use std::fs;

#[cfg(unix)]
fn read_first_match(path: &str, prefix: &str) -> Option<String> {
  let contents = fs::read_to_string(path).ok()?;
  contents
    .lines()
    .find_map(|line| line.strip_prefix(prefix).map(|value| value.trim().to_string()))
}

#[cfg(unix)]
pub fn system_info_string() -> String {
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

#[cfg(windows)]
pub fn system_info_string() -> String {
  let mut lines = Vec::new();
  let os = std::env::var("OS").unwrap_or_else(|_| "Windows".to_string());

  lines.push(format!("OS: {}", os));
  lines.push(format!("Arch: {}", std::env::consts::ARCH));

  if let Ok(hostname) = std::env::var("COMPUTERNAME") {
    lines.push(format!("Hostname: {}", hostname));
  }
  if let Ok(cpu) = std::env::var("PROCESSOR_IDENTIFIER") {
    lines.push(format!("CPU: {}", cpu));
  }
  if let Ok(cores) = std::env::var("NUMBER_OF_PROCESSORS") {
    lines.push(format!("CPU Cores: {}", cores));
  }
  if let Ok(arch) = std::env::var("PROCESSOR_ARCHITECTURE") {
    lines.push(format!("CPU Arch: {}", arch));
  }

  lines.join("\n")
}

#[cfg(not(any(unix, windows)))]
pub fn system_info_string() -> String {
  let mut lines = Vec::new();
  lines.push(format!("OS: {}", std::env::consts::OS));
  lines.push(format!("Arch: {}", std::env::consts::ARCH));
  lines.join("\n")
}
