from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, ForeignKey, Index, String, func
from sqlalchemy.dialects.mysql import DATETIME, JSON, LONGBLOB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Device(Base):
    """
    Devices table:
    - device_uid is stable across reboots (like board-01)
    - metadata_json stores arbitrary device metadata (future-proof)
    """

    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    device_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)

    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String(255), nullable=True)

    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=6),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=6),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    telemetry: Mapped[list[TelemetrySample]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan",
    )


class TelemetrySample(Base):
    """
    Telemetry samples:
    - metrics_json stores ANY parameters from RS-485 without schema changes
    - quality_json stores crc_ok, seq, parse_version, etc.
    - raw_frame optionally stores original bytes (LONGBLOB)
    """

    __tablename__ = "telemetry_samples"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    device_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    ts: Mapped[datetime] = mapped_column(DATETIME(fsp=6), nullable=False, index=True)

    metrics_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    quality_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    crc_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    frame_seq: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    raw_frame: Mapped[bytes | None] = mapped_column(LONGBLOB, nullable=True)
    source: Mapped[str | None] = mapped_column(String(32), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=6),
        server_default=func.now(),
        nullable=False,
    )

    device: Mapped[Device] = relationship(back_populates="telemetry")


Index("ix_telemetry_device_ts", TelemetrySample.device_id, TelemetrySample.ts)
