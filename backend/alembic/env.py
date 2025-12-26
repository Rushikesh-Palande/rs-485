from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from rs485_app.infra.db.models import Base
from rs485_app.settings import load_settings

# ---------------------------------------------------------------------------
# Alembic config + logging
# ---------------------------------------------------------------------------
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Autogenerate support (alembic revision --autogenerate)
target_metadata = Base.metadata


def get_url() -> str:
    """
    Single source of truth for the DB URL.
    This ensures Alembic uses the same DATABASE_URL as the app.
    """
    return load_settings().database_url


def run_migrations_online() -> None:
    """
    Online migrations (normal mode).

    Notes:
    - MySQL DDL is "non-transactional" in Alembic terms, so Alembic will log
      "Will assume non-transactional DDL." That's expected.
    - We set compare_type=True so column type changes are detected correctly.
    """
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


# In your project we only run online migrations.
run_migrations_online()
