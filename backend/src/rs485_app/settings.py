from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Typed application configuration.

    Designed for high-rate telemetry ingestion:
    - Async pipeline pushes events into a bounded queue
    - Batch writer flushes to MySQL in bursts
    - Device UID -> DB id is cached to minimize DB lookups
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    app_name: str = Field(default="rs485-enterprise", alias="APP_NAME")
    app_env: str = Field(default="dev", alias="APP_ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # Web server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    # Database
    database_url: str = Field(
        default="mysql+pymysql://rs485:rs485@127.0.0.1:3306/rs485?charset=utf8mb4",
        alias="DATABASE_URL",
        description="SQLAlchemy database URL",
    )

    # DB writer tuning
    db_write_batch_size: int = Field(
        default=200,
        alias="DB_WRITE_BATCH_SIZE",
        description=(
            "How many telemetry rows to insert per DB flush " "(higher = faster, more latency)."
        ),
    )
    db_write_flush_ms: int = Field(
        default=200,
        alias="DB_WRITE_FLUSH_MS",
        description=(
            "Max time to wait before flushing even if batch not full " "(lower = lower latency)."
        ),
    )
    db_queue_maxsize: int = Field(
        default=20000,
        alias="DB_QUEUE_MAXSIZE",
        description="Bounded ingestion queue size. Prevents memory blow-up during spikes.",
    )
    db_device_cache_size: int = Field(
        default=5000,
        alias="DB_DEVICE_CACHE_SIZE",
        description="LRU cache size for device_uid -> device_id (reduces DB lookups).",
    )

    # Ingestion
    serial_mode: str = Field(
        default="simulator",
        alias="SERIAL_MODE",
        description="simulator | serial | wireless (future)",
    )
    serial_port: str = Field(default="/dev/ttyUSB0", alias="SERIAL_PORT")
    serial_baudrate: int = Field(default=115200, alias="SERIAL_BAUDRATE")

    # Simulator
    sim_device_id: str = Field(default="board-01", alias="SIM_DEVICE_ID")
    sim_interval_ms: int = Field(default=300, alias="SIM_INTERVAL_MS")


def load_settings() -> Settings:
    return Settings()
