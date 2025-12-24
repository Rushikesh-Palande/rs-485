<%
    # -----------------------------
    # Enterprise Alembic Template
    # -----------------------------
    # Goals:
    # - enforce rich migration metadata
    # - encourage safe, reversible migrations
    # - provide helpers for MySQL (indexes, FKs, JSON, etc.)
    # - standardize structure across team
%>
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

Migration Notes
---------------
- Purpose:
  - TODO: Explain WHY this change is needed (business/feature reason).
- Safety:
  - TODO: Expected runtime, lock behavior, and rollback strategy.
- Data impact:
  - TODO: Any backfills? data migrations? defaults? NOT NULL conversions?
- Verification:
  - TODO: How to verify in staging/production (SQL queries / API checks).

Operational Guidance
--------------------
- MySQL Large Table Advice:
  - Prefer adding nullable columns first, then backfill, then add NOT NULL.
  - Avoid long blocking operations during peak usage.
  - For large tables, consider pt-online-schema-change / gh-ost.

"""

from __future__ import annotations

from typing import Iterable, Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.engine import Connection


# --- Alembic identifiers ---
revision: str = ${repr(up_revision)}
down_revision: str | None = ${repr(down_revision)}
branch_labels: Sequence[str] | None = ${repr(branch_labels)}
depends_on: Sequence[str] | None = ${repr(depends_on)}


# ---------------------------------------------------------------------
# Helpers (World-class ergonomics + safety)
# ---------------------------------------------------------------------
def _conn() -> Connection:
    """
    Get Alembic migration connection (single source of truth).
    """
    return op.get_bind()


def _mysql_current_db() -> str:
    """
    Resolve current database name (schema) in MySQL.
    """
    row = _conn().execute(text("SELECT DATABASE()")).fetchone()
    assert row and row[0], "DATABASE() returned NULL; ensure sqlalchemy.url selects a DB"
    return str(row[0])


def _index_exists(table: str, index: str) -> bool:
    """
    Check if an index exists (MySQL).
    Useful for safe operations and re-runs.
    """
    db = _mysql_current_db()
    q = text(
        """
        SELECT 1
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table AND INDEX_NAME = :index_name
        LIMIT 1
        """
    )
    return _conn().execute(q, {"db": db, "table": table, "index_name": index}).first() is not None


def _fk_exists(table: str, fk_name: str) -> bool:
    """
    Check if a foreign key constraint exists (MySQL).
    """
    db = _mysql_current_db()
    q = text(
        """
        SELECT 1
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = :db AND TABLE_NAME = :table AND CONSTRAINT_NAME = :fk_name
        LIMIT 1
        """
    )
    return _conn().execute(q, {"db": db, "table": table, "fk_name": fk_name}).first() is not None


def _cols(table: str) -> set[str]:
    """
    Return set of column names in a table.
    """
    db = _mysql_current_db()
    q = text(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table
        """
    )
    rows = _conn().execute(q, {"db": db, "table": table}).fetchall()
    return {str(r[0]) for r in rows}


def _ensure_indexes(table: str, indexes: Iterable[tuple[str, list[str]]]) -> None:
    """
    Create indexes if missing.
    indexes: [(index_name, [col1, col2, ...]), ...]
    """
    for idx_name, cols in indexes:
        if not _index_exists(table, idx_name):
            op.create_index(idx_name, table, cols)
        else:
            # Avoid noisy prints in prod: leave as comment.
            pass


# ---------------------------------------------------------------------
# Upgrade / Downgrade
# ---------------------------------------------------------------------
def upgrade() -> None:
    """
    Apply schema changes.

    Best practices:
    - keep operations ordered and small
    - for large tables, avoid long blocking locks
    - prefer additive changes; do destructive changes carefully
    """
    # -----------------------------------------------------------------
    # TODO: Write migration steps below.
    #
    # Example patterns:
    #
    # 1) Add nullable column first (safe)
    #    op.add_column("table", sa.Column("new_col", sa.String(50), nullable=True))
    #
    # 2) Backfill in controlled batches (optional)
    #    op.execute(sa.text("UPDATE table SET new_col='x' WHERE new_col IS NULL"))
    #
    # 3) Make NOT NULL (riskier) after backfill
    #    op.alter_column("table", "new_col", existing_type=sa.String(50), nullable=False)
    #
    # 4) Add indexes last
    #    _ensure_indexes("table", [("ix_table_new_col", ["new_col"])])
    # -----------------------------------------------------------------

    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """
    Revert schema changes.

    Rules:
    - Always try to implement downgrade.
    - If downgrade is unsafe (data loss), document clearly and raise.
    """
    # If downgrade would be destructive:
    # raise RuntimeError("Downgrade not supported: would cause irreversible data loss.")

    ${downgrades if downgrades else "pass"}
