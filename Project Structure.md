rs485/
├─ README.md
├─ pyproject.toml
├─ uv.lock                                # (or poetry.lock / requirements*.txt) dependency lock
├─ .env.example
├─ .gitignore
├─ .editorconfig
├─ .pre-commit-config.yaml
├─ Makefile
├─ docker-compose.yml
├─ Dockerfile
├─ CONTRIBUTING.md
├─ SECURITY.md
├─ LICENSE
│
├─ docs/
│  ├─ architecture.md                      # C4 style overview, data flow, decisions
│  ├─ api.md                               # API usage examples + websocket payloads
│  ├─ observability.md                     # logs/metrics/traces
│  ├─ rs485_protocol.md                    # frames, CRC, register map, device ids
│  ├─ runbooks/
│  │  ├─ incident_response.md
│  │  └─ troubleshooting_serial.md
│  └─ adr/                                 # architecture decision records
│     ├─ 0001-tech-stack.md
│     └─ 0002-storage-timeseries.md
│
├─ scripts/
│  ├─ dev_up.sh
│  ├─ dev_down.sh
│  ├─ lint.sh
│  ├─ test.sh
│  └─ seed_demo_data.py
│
├─ deploy/
│  ├─ nginx/
│  │  └─ nginx.conf
│  ├─ systemd/
│  │  └─ rs485-app.service
│  ├─ k8s/
│  │  ├─ deployment.yaml
│  │  ├─ service.yaml
│  │  ├─ ingress.yaml
│  │  ├─ configmap.yaml
│  │  └─ secrets.example.yaml
│  └─ helm/
│     └─ rs485-app-chart/                  # optional: helm chart
│
├─ backend/
│  ├─ src/
│  │  └─ rs485_app/
│  │     ├─ __init__.py
│  │     ├─ main.py                        # FastAPI entrypoint
│  │     ├─ settings.py                    # typed settings, env parsing
│  │     ├─ logging_config.py              # structured JSON logs
│  │     ├─ exceptions.py                  # domain + API exceptions
│  │     ├─ constants.py
│  │     │
│  │     ├─ api/                           # web layer (thin)
│  │     │  ├─ __init__.py
│  │     │  ├─ deps.py                     # dependency injection wiring
│  │     │  ├─ middleware.py               # request-id, timing, auth hooks
│  │     │  ├─ routers/
│  │     │  │  ├─ health.py
│  │     │  │  ├─ auth.py                  # optional enterprise auth
│  │     │  │  ├─ devices.py               # device mgmt, metadata
│  │     │  │  ├─ telemetry.py             # querying telemetry history
│  │     │  │  └─ ws_realtime.py           # websocket for live stream
│  │     │  └─ schemas/
│  │     │     ├─ common.py
│  │     │     ├─ device.py
│  │     │     └─ telemetry.py
│  │     │
│  │     ├─ domain/                        # pure business logic (no frameworks)
│  │     │  ├─ __init__.py
│  │     │  ├─ models/
│  │     │  │  ├─ device.py
│  │     │  │  ├─ telemetry.py
│  │     │  │  └─ protocol.py              # frame definitions, parsing contracts
│  │     │  ├─ services/
│  │     │  │  ├─ telemetry_service.py      # aggregation, validation
│  │     │  │  └─ analytics_service.py      # rolling stats, anomaly hooks
│  │     │  └─ ports/                       # interfaces (hexagonal)
│  │     │     ├─ telemetry_repo.py
│  │     │     ├─ event_bus.py
│  │     │     └─ clock.py
│  │     │
│  │     ├─ infra/                          # implementations (db, redis, serial, etc.)
│  │     │  ├─ __init__.py
│  │     │  ├─ db/
│  │     │  │  ├─ session.py                # SQLAlchemy session factory
│  │     │  │  ├─ models.py                 # ORM models
│  │     │  │  ├─ migrations/               # Alembic migrations
│  │     │  │  └─ repositories/
│  │     │  │     ├─ telemetry_repo_sql.py
│  │     │  │     └─ device_repo_sql.py
│  │     │  ├─ cache/
│  │     │  │  └─ redis_client.py
│  │     │  ├─ messaging/
│  │     │  │  ├─ event_bus_inmem.py
│  │     │  │  └─ event_bus_redis.py         # pub/sub for scaling websockets
│  │     │  ├─ rs485/
│  │     │  │  ├─ serial_manager.py          # pyserial-async reader
│  │     │  │  ├─ frame_codec.py             # encode/decode, CRC
│  │     │  │  ├─ parsers/
│  │     │  │  │  ├─ base.py
│  │     │  │  │  └─ board_v1.py             # board-specific mapping
│  │     │  │  └─ simulator.py               # dev simulator (no hardware needed)
│  │     │  └─ observability/
│  │     │     ├─ metrics.py                 # Prometheus metrics
│  │     │     └─ tracing.py                 # OpenTelemetry hooks
│  │     │
│  │     ├─ workers/                         # background jobs (optional)
│  │     │  ├─ celery_app.py                 # or rq/arq
│  │     │  └─ tasks.py                      # downsampling, retention, reports
│  │     │
│  │     ├─ utils/
│  │     │  ├─ ids.py                        # request id, correlation helpers
│  │     │  ├─ time.py
│  │     │  └─ validation.py
│  │     │
│  │     └─ bootstrap.py                     # app wiring: ports -> adapters
│  │
│  ├─ tests/
│  │  ├─ unit/
│  │  ├─ integration/
│  │  ├─ e2e/
│  │  └─ conftest.py
│  │
│  └─ alembic.ini
│
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.ts
│  ├─ tsconfig.json
│  ├─ index.html
│  └─ src/
│     ├─ app/
│     │  ├─ routes.tsx
│     │  └─ layout.tsx
│     ├─ pages/
│     │  ├─ Dashboard.tsx                   # graphs, KPIs
│     │  ├─ DeviceDetail.tsx                # per-parameter realtime
│     │  └─ Settings.tsx
│     ├─ components/
│     │  ├─ charts/
│     │  ├─ tables/
│     │  └─ ui/
│     ├─ lib/
│     │  ├─ api.ts                          # REST client
│     │  ├─ ws.ts                           # websocket client
│     │  └─ time.ts
│     └─ styles/
│        └─ global.css
│
└─ .github/
   ├─ workflows/
   │  ├─ ci.yml                              # lint, test, build
   │  └─ release.yml                          # docker build & push
   └─ CODEOWNERS
