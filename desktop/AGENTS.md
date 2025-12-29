# Repository Guidelines

## Project Structure & Module Organization
- `src-tauri/` contains the Tauri (Rust) desktop shell, configuration, and backend launcher.
- `src-tauri/src/main.rs` is the entry point; it wires modules in `src-tauri/src/` (`backend/`, `logs.rs`, `menu.rs`, `serial.rs`, `system.rs`).
- `src-tauri/capabilities/` holds Tauri capability configuration.
- `src-tauri/target/` is build output (do not edit or commit).
- The Tauri config expects a web frontend in `../frontend` (sibling directory) with build output in `../frontend/dist`.

## Build, Test, and Development Commands
- `npm run dev` (from this repo): starts the Tauri app in dev mode. It will run `npm --prefix ../frontend run dev` per `src-tauri/tauri.conf.json`.
- `npm run build`: builds the Tauri app for distribution; runs `npm --prefix ../frontend run build` first and bundles `src-tauri/bin/rs485-backend`.
- `cargo build` (from `src-tauri/`): builds the Rust shell only; useful for backend-only checks.

## Coding Style & Naming Conventions
- Rust follows the 2021 edition; use `cargo fmt` (rustfmt defaults) before committing.
- Keep Rust types and functions in `snake_case`; constants in `SCREAMING_SNAKE_CASE`.
- JSON config (`src-tauri/tauri.conf.json`) uses 2-space indentation.

## Testing Guidelines
- No automated tests are configured in this repo today.
- If adding Rust tests, place `#[cfg(test)]` modules alongside code in `src-tauri/src/` and run with `cargo test`.
- If adding frontend tests, align with the toolchain in `../frontend` and document the command here.

## Commit & Pull Request Guidelines
- Commit messages follow a Conventional Commits style (e.g., `chore: initial enterprise rs-485 monorepo scaffold`).
- PRs should include a brief description of changes, the motivation, and any UI screenshots for tray/menu changes.

## Configuration & Security Notes
- The app launches a sidecar binary named `rs485-backend`; keep the binary in `src-tauri/bin/` for bundling.
- The backend health probe assumes `HOST=127.0.0.1` and `PORT=8000` (see `src-tauri/src/main.rs`). Update both frontend and backend if these change.
