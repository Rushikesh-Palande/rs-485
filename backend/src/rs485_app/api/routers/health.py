from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """
    Kubernetes / load balancers will hit this endpoint.
    Keep it fast and dependency-free.
    """
    return {"status": "ok"}
