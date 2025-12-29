//! Tauri app entry point and wiring for modules.
//! Provides startup configuration, plugin wiring, and event handlers.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api_server;
mod logs;
mod menu;
mod serial;
mod system;

use std::sync::Mutex;

use tauri::{
  tray::{TrayIconBuilder, TrayIconEvent},
  Emitter, Manager,
};

use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

use crate::api_server::spawn_api_server;
use crate::menu::{build_menu, show_main_window};
use crate::serial::{
  close_serial_port, list_serial_ports, open_serial_port, read_serial_data, write_serial_data,
  SerialState,
};
use crate::system::system_info_string;
use crate::logs::save_session_log;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      list_serial_ports,
      open_serial_port,
      close_serial_port,
      write_serial_data,
      read_serial_data,
      save_session_log
    ])
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
    .setup(|app| {
      // 1) Spawn embedded Rust REST/WS backend
      let handle = app.handle().clone();
      if let Err(e) = spawn_api_server(&handle) {
        let _ = handle.emit("backend:spawn_failed", format!("{e:?}"));
      }

      // 2) App menu
      let menu = build_menu(&handle)?;
      app.set_menu(menu)?;

      // 3) Tray menu + tray icon
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
      app.manage(SerialState {
        port: Mutex::new(None),
      });

      Ok(())
    })
    .on_menu_event(|app, event| {
      let id = event.id().0.as_str();

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
