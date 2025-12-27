//! Menu and tray helpers for the desktop app.
//! Provides menu construction and window focus helpers.

use tauri::{
  menu::{MenuBuilder, MenuItem, PredefinedMenuItem},
  AppHandle, Manager, Runtime,
};

pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
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

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
  if let Some(w) = app.get_webview_window("main") {
    let _ = w.show();
    let _ = w.set_focus();
  }
}
