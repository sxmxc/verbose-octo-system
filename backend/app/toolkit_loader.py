from __future__ import annotations

import importlib
import importlib.machinery
import importlib.util
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from inspect import Parameter, signature
from pathlib import Path
from typing import Any, Iterable, Optional

from fastapi import FastAPI

from .config import settings
from .toolkits.registry import get_toolkit, list_toolkits


_APP_REF: Optional[FastAPI] = None
_CELERY_REF = None
_LOADED_SLUGS: set[str] = set()


@dataclass
class _ToolkitNamespaceFinder:
    root: Path
    namespaces: tuple[str, ...]

    def find_spec(self, fullname: str, path, target=None):  # pragma: no cover - import hook
        top_level = fullname.split(".", 1)[0]
        if top_level not in self.namespaces:
            return None

        search_paths = path or [str(self.root)]
        return importlib.machinery.PathFinder.find_spec(fullname, search_paths, target)


def _matching_module_names(prefixes: Iterable[str]) -> list[str]:
    names = []
    prefix_list = list(prefixes)
    for name in list(sys.modules.keys()):
        if any(name == prefix or name.startswith(f"{prefix}.") for prefix in prefix_list):
            names.append(name)
    return names


@contextmanager
def _module_namespace(*prefixes: str):
    preserved = {name: sys.modules[name] for name in _matching_module_names(prefixes)}
    for name in preserved:
        sys.modules.pop(name, None)
    try:
        yield
    finally:
        # Drop any modules imported for this namespace
        for name in _matching_module_names(prefixes):
            sys.modules.pop(name, None)
        # Restore originals
        for name, module in preserved.items():
            sys.modules[name] = module


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


def import_toolkit_module(
    module_name: str,
    *,
    slug: str,
    namespaces: Iterable[str] = ("backend",),
) -> Any:
    """Import a module from a toolkit bundle without polluting global namespaces."""

    storage_dir = Path(settings.toolkit_storage_dir)
    toolkit_root = storage_dir / slug
    if not toolkit_root.exists():
        raise ModuleNotFoundError(f"Toolkit '{slug}' assets not found")

    _ensure_sys_path(toolkit_root)

    finder = _ToolkitNamespaceFinder(toolkit_root, tuple(namespaces))

    with _module_namespace(*namespaces):
        sys.meta_path.insert(0, finder)
        try:
            return importlib.import_module(module_name)
        finally:
            if finder in sys.meta_path:
                sys.meta_path.remove(finder)


def _eligible_toolkits(
    *,
    exclude: Iterable[str],
    slugs: Iterable[str] | None,
):
    exclude_set = {slug for slug in exclude}
    allowed = None if slugs is None else {slug for slug in slugs}
    for toolkit in list_toolkits():
        if not toolkit.enabled:
            continue
        if toolkit.slug in exclude_set:
            continue
        if allowed is not None and toolkit.slug not in allowed:
            continue
        yield toolkit


def load_toolkit_backends(
    app: FastAPI,
    *,
    exclude: Iterable[str] = (),
    slugs: Iterable[str] | None = None,
) -> None:
    for toolkit in _eligible_toolkits(exclude=exclude, slugs=slugs):
        if not toolkit.backend_module:
            continue

        try:
            module = import_toolkit_module(
                toolkit.backend_module,
                slug=toolkit.slug,
                namespaces=("backend",),
            )
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
    for toolkit in _eligible_toolkits(exclude=exclude, slugs=slugs):
        if not toolkit.worker_module:
            continue

        try:
            module = import_toolkit_module(
                toolkit.worker_module,
                slug=toolkit.slug,
                namespaces=("backend", "worker"),
            )
        except Exception as exc:  # pragma: no cover - defensive logging
            print(f"[toolkit] Failed to import worker module {toolkit.worker_module!r}: {exc}")
            continue

        register_attr = toolkit.worker_register_attr or "register"
        register = getattr(module, register_attr, None)
        if callable(register):
            try:
                from worker.tasks import register_handler as core_register_handler

                sig = signature(register)
                kwargs = {}
                if any(
                    param.kind in (Parameter.POSITIONAL_OR_KEYWORD, Parameter.KEYWORD_ONLY)
                    and param.name == "register_handler"
                    for param in sig.parameters.values()
                ):
                    kwargs["register_handler"] = core_register_handler
                elif any(param.kind == Parameter.VAR_KEYWORD for param in sig.parameters.values()):
                    kwargs["register_handler"] = core_register_handler

                register(celery_app, **kwargs)
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
