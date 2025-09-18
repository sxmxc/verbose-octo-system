from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import Iterable, Optional

from fastapi import FastAPI

from .config import settings
from .toolkits.registry import get_toolkit, list_toolkits


_APP_REF: Optional[FastAPI] = None
_CELERY_REF = None
_LOADED_SLUGS: set[str] = set()


def register_app(app: FastAPI) -> None:
    global _APP_REF
    _APP_REF = app


def register_celery(celery_app) -> None:
    global _CELERY_REF
    _CELERY_REF = celery_app


def _ensure_sys_path(path: Path) -> None:
    path_str = str(path.resolve())
    if path_str not in sys.path:
        sys.path.insert(0, path_str)


def load_toolkit_backends(
    app: FastAPI,
    *,
    exclude: Iterable[str] = (),
    slugs: Iterable[str] | None = None,
) -> None:
    storage_dir = Path(settings.toolkit_storage_dir)
    exclude_set = {slug for slug in exclude}

    for toolkit in list_toolkits():
        if not toolkit.enabled:
            continue
        if slugs is not None and toolkit.slug not in slugs:
            continue
        if toolkit.slug in exclude_set:
            continue
        if not toolkit.backend_module:
            continue

        toolkit_root = storage_dir / toolkit.slug
        if not toolkit_root.exists():
            continue

        _ensure_sys_path(toolkit_root)

        try:
            module = importlib.import_module(toolkit.backend_module)
        except Exception as exc:  # pragma: no cover - defensive logging
            print(f"[toolkit] Failed to import backend module {toolkit.backend_module!r}: {exc}")
            continue

        router_attr = toolkit.backend_router_attr or "router"
        router = getattr(module, router_attr, None)
        if router is None:
            print(
                f"[toolkit] Backend module {toolkit.backend_module!r} missing router attr {router_attr!r}"
            )
            continue

        prefix = toolkit.base_path
        app.include_router(router, prefix=prefix, tags=[toolkit.slug])
        _LOADED_SLUGS.add(toolkit.slug)


def load_toolkit_workers(
    celery_app,
    *,
    exclude: Iterable[str] = (),
    slugs: Iterable[str] | None = None,
) -> None:
    storage_dir = Path(settings.toolkit_storage_dir)
    exclude_set = {slug for slug in exclude}

    for toolkit in list_toolkits():
        if not toolkit.enabled:
            continue
        if slugs is not None and toolkit.slug not in slugs:
            continue
        if toolkit.slug in exclude_set:
            continue
        if not toolkit.worker_module:
            continue

        toolkit_root = storage_dir / toolkit.slug
        if not toolkit_root.exists():
            continue

        _ensure_sys_path(toolkit_root)

        try:
            module = importlib.import_module(toolkit.worker_module)
        except Exception as exc:  # pragma: no cover - defensive logging
            print(f"[toolkit] Failed to import worker module {toolkit.worker_module!r}: {exc}")
            continue

        register_attr = toolkit.worker_register_attr or "register"
        register = getattr(module, register_attr, None)
        if callable(register):
            try:
                register(celery_app)
            except Exception as exc:  # pragma: no cover - defensive logging
                print(
                    f"[toolkit] Worker register callable failed for {toolkit.worker_module!r}: {exc}"
                )
        else:
            print(
                f"[toolkit] Worker module {toolkit.worker_module!r} missing register callable {register_attr!r}"
            )
        _LOADED_SLUGS.add(toolkit.slug)


def activate_toolkit(slug: str) -> None:
    toolkit = get_toolkit(slug)
    if not toolkit or not toolkit.enabled:
        return
    if slug in _LOADED_SLUGS:
        return

    if _APP_REF:
        load_toolkit_backends(_APP_REF, slugs={slug})
    if _CELERY_REF:
        load_toolkit_workers(_CELERY_REF, slugs={slug})

    _LOADED_SLUGS.add(slug)


def mark_toolkit_removed(slug: str) -> None:
    _LOADED_SLUGS.discard(slug)
