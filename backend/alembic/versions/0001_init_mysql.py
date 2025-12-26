"""init mysql schema: devices + telemetry_samples

Revision ID: 0001_init_mysql
Revises: None
Create Date: 2025-12-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision = "0001_init_mysql"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # devices: stable identity for hardware boards/gateways
    # -----------------------------------------------------------------------
    op.create_table(
        "devices",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("device_uid", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("model", sa.String(length=255), nullable=True),
        sa.Column("firmware_version", sa.String(length=255), nullable=True),
        sa.Column("metadata_json", mysql.JSON(), nullable=True),
        sa.Column(
            "created_at",
            mysql.DATETIME(fsp=6),
            server_default=sa.text("CURRENT_TIMESTAMP(6)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            mysql.DATETIME(fsp=6),
            server_default=sa.text("CURRENT_TIMESTAMP(6)"),
            nullable=False,
        ),
        sa.UniqueConstraint("device_uid", name="uq_devices_device_uid"),
    )
    op.create_index("ix_devices_device_uid", "devices", ["device_uid"])

    # -----------------------------------------------------------------------
    # telemetry_samples: append-only time series. "metrics_json" is schema-less.
    # device_id is a FK to devices.id (fast joins + referential integrity)
    # -----------------------------------------------------------------------
    op.create_table(
        "telemetry_samples",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "device_id",
            sa.BigInteger(),
            sa.ForeignKey("devices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ts", mysql.DATETIME(fsp=6), nullable=False),
        sa.Column("metrics_json", mysql.JSON(), nullable=False),
        sa.Column("quality_json", mysql.JSON(), nullable=True),
        sa.Column("crc_ok", sa.Boolean(), nullable=True),
        sa.Column("frame_seq", sa.BigInteger(), nullable=True),
        sa.Column("raw_frame", mysql.LONGBLOB(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=True),
        sa.Column(
            "created_at",
            mysql.DATETIME(fsp=6),
            server_default=sa.text("CURRENT_TIMESTAMP(6)"),
            nullable=False,
        ),
    )

    # Indexes:
    # - device_id: for device-scoped queries
    # - ts: for global time filtering
    # - (device_id, ts): critical for charts (fast range scan per device)
    op.create_index("ix_telemetry_samples_device_id", "telemetry_samples", ["device_id"])
    op.create_index("ix_telemetry_samples_ts", "telemetry_samples", ["ts"])
    op.create_index("ix_telemetry_device_ts", "telemetry_samples", ["device_id", "ts"])


def downgrade() -> None:
    op.drop_index("ix_telemetry_device_ts", table_name="telemetry_samples")
    op.drop_index("ix_telemetry_samples_ts", table_name="telemetry_samples")
    op.drop_index("ix_telemetry_samples_device_id", table_name="telemetry_samples")
    op.drop_table("telemetry_samples")

    op.drop_index("ix_devices_device_uid", table_name="devices")
    op.drop_table("devices")
