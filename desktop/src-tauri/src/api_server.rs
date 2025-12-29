//! Embedded REST + WS telemetry server (Rust backend).
//! Keeps the existing frontend paths working on 127.0.0.1:8000.

use std::net::SocketAddr;

use anyhow::Context;
use axum::{
  extract::{ws::Message, ws::WebSocket, ws::WebSocketUpgrade, Path, Query, State},
  http::StatusCode,
  response::IntoResponse,
  routing::get,
  Json, Router,
};
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{mysql::MySqlPoolOptions, QueryBuilder};
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;

use tauri::{AppHandle, Emitter, Runtime};

#[derive(Clone)]
struct ApiState {
  db: sqlx::MySqlPool,
  tx: broadcast::Sender<TelemetryEvent>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TelemetryEvent {
  pub ts: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub device_id: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub device_uid: Option<String>,
  pub metrics: Value,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub quality: Option<Value>,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
  status: &'static str,
}

#[derive(Debug, Deserialize)]
struct HistoryQuery {
  limit: Option<u32>,
  start: Option<String>,
  end: Option<String>,
}

#[derive(Debug, Serialize)]
struct HistoryPoint {
  ts: String,
  metrics: Value,
  #[serde(skip_serializing_if = "Option::is_none")]
  quality: Option<Value>,
}

#[derive(Debug, Serialize)]
struct HistoryResponse {
  device_uid: String,
  points: Vec<HistoryPoint>,
}

#[derive(Debug, sqlx::FromRow)]
struct HistoryRow {
  ts: NaiveDateTime,
  metrics_json: sqlx::types::Json<Value>,
  quality_json: Option<sqlx::types::Json<Value>>,
}

pub fn spawn_api_server<R: Runtime>(app: &AppHandle<R>) -> anyhow::Result<()> {
  let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
  let port = std::env::var("PORT")
    .ok()
    .and_then(|value| value.parse::<u16>().ok())
    .unwrap_or(8000);
  let database_url = std::env::var("DATABASE_URL")
    .or_else(|_| std::env::var("RS485_DATABASE_URL"))
    .unwrap_or_else(|_| "mysql://rs485:rs485@127.0.0.1:3306/rs485".to_string());

  let addr: SocketAddr = format!("{host}:{port}")
    .parse()
    .context("Failed to parse HOST/PORT")?;
  let app_handle = app.clone();

  tauri::async_runtime::spawn(async move {
    if let Err(err) = run_server(addr, database_url).await {
      let _ = app_handle.emit("backend:spawn_failed", format!("{err:?}"));
    }
  });

  let _ = app.emit("backend:spawned", ());
  Ok(())
}

async fn run_server(addr: SocketAddr, database_url: String) -> anyhow::Result<()> {
  let db = MySqlPoolOptions::new()
    .max_connections(5)
    .connect(&database_url)
    .await
    .context("Failed to connect to MySQL")?;
  let (tx, _rx) = broadcast::channel(1024);

  let state = ApiState { db, tx };
  let app = Router::new()
    .route("/api/health", get(health))
    .route("/api/telemetry/:device_uid/history", get(telemetry_history))
    .route("/ws/realtime", get(realtime_ws))
    .layer(CorsLayer::permissive())
    .with_state(state);

  let listener = tokio::net::TcpListener::bind(addr)
    .await
    .context("Failed to bind API server")?;

  axum::serve(listener, app)
    .await
    .context("API server exited unexpectedly")?;
  Ok(())
}

async fn health() -> Json<HealthResponse> {
  Json(HealthResponse { status: "ok" })
}

async fn telemetry_history(
  Path(device_uid): Path<String>,
  Query(query): Query<HistoryQuery>,
  State(state): State<ApiState>,
) -> Result<Json<HistoryResponse>, (StatusCode, String)> {
  let limit = query.limit.unwrap_or(1000).min(10_000);
  let start = parse_ts(query.start.as_deref())?;
  let end = parse_ts(query.end.as_deref())?;

  let mut builder = QueryBuilder::new(
    "SELECT t.ts, t.metrics_json, t.quality_json \
     FROM telemetry_samples t \
     JOIN devices d ON t.device_id = d.id \
     WHERE d.device_uid = ",
  );
  builder.push_bind(&device_uid);
  if let Some(start) = start {
    builder.push(" AND t.ts >= ");
    builder.push_bind(start);
  }
  if let Some(end) = end {
    builder.push(" AND t.ts <= ");
    builder.push_bind(end);
  }
  builder.push(" ORDER BY t.ts ASC LIMIT ");
  builder.push_bind(limit as i64);

  let rows = builder
    .build_query_as::<HistoryRow>()
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

  let points = rows
    .into_iter()
    .map(|row| HistoryPoint {
      ts: DateTime::<Utc>::from_naive_utc_and_offset(row.ts, Utc).to_rfc3339(),
      metrics: row.metrics_json.0,
      quality: row.quality_json.map(|value| value.0),
    })
    .collect();

  Ok(Json(HistoryResponse { device_uid, points }))
}

async fn realtime_ws(
  State(state): State<ApiState>,
  ws: WebSocketUpgrade,
) -> impl IntoResponse {
  ws.on_upgrade(move |socket| handle_ws(socket, state.tx.subscribe()))
}

async fn handle_ws(mut socket: WebSocket, mut rx: broadcast::Receiver<TelemetryEvent>) {
  loop {
    tokio::select! {
      msg = rx.recv() => match msg {
        Ok(event) => {
          let payload = match serde_json::to_string(&event) {
            Ok(payload) => payload,
            Err(_) => continue,
          };
          if socket.send(Message::Text(payload)).await.is_err() {
            break;
          }
        }
        Err(broadcast::error::RecvError::Lagged(_)) => continue,
        Err(_) => break,
      },
      inbound = socket.recv() => match inbound {
        Some(Ok(Message::Close(_))) | None => break,
        Some(Ok(_)) => {},
        Some(Err(_)) => break,
      }
    }
  }
}

fn parse_ts(input: Option<&str>) -> Result<Option<NaiveDateTime>, (StatusCode, String)> {
  let Some(raw) = input else {
    return Ok(None);
  };
  let parsed = DateTime::parse_from_rfc3339(raw)
    .map_err(|_| (StatusCode::BAD_REQUEST, format!("Invalid timestamp: {raw}")))?;
  Ok(Some(parsed.with_timezone(&Utc).naive_utc()))
}

fn internal_error(err: sqlx::Error) -> (StatusCode, String) {
  (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
}
