# syntax=docker/dockerfile:1.7

############################################
# RS-485 Backend - Production Docker Image  #
# - FastAPI + Uvicorn                        #
# - MySQL via PyMySQL                        #
# - Non-root user                            #
# - Small, cache-friendly layers             #
############################################

FROM python:3.11-slim AS base

# Safer defaults + cleaner logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# OS deps (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

############################################
# Builder: installs deps into a venv        #
############################################
FROM base AS builder

# Create venv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy only dependency manifests first (best caching)
COPY backend/pyproject.toml backend/README.md* backend/ /app/backend/

# Install backend deps in editable mode (prod)
# If your backend dependencies are defined inside backend/pyproject.toml
RUN pip install --upgrade pip setuptools wheel \
 && pip install -e /app/backend

############################################
# Runtime: minimal final image              #
############################################
FROM base AS runtime

# Non-root user
RUN useradd -m -u 10001 appuser
USER appuser

# Bring venv + app code
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy backend source
COPY --chown=appuser:appuser backend /app/backend
WORKDIR /app/backend

# Expose app port
EXPOSE 8000

# Healthcheck (optional but “enterprise”)
# Uses python to avoid curl dependency
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health').read()" || exit 1

# Production launch
CMD ["uvicorn", "rs485_app.main:app", "--host", "0.0.0.0", "--port", "8000"]
