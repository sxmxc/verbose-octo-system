from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routes.dashboard import router as dashboard_router
from .routes.jobs import router as jobs_router
from .routes.toolkits import router as toolkits_router
from .routes.toolkit_docs import router as toolkit_docs_router
from .toolkit_loader import load_toolkit_backends, register_app
from .toolkits.seeder import ensure_bundled_toolkits_installed

app = FastAPI(title=settings.app_name)
register_app(app)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

toolkit_assets_dir = Path(settings.toolkit_storage_dir)
toolkit_assets_dir.mkdir(parents=True, exist_ok=True)
app.mount(
    "/toolkit-assets",
    StaticFiles(directory=toolkit_assets_dir, check_dir=False),
    name="toolkit-assets",
)

@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}

# Routers
app.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
app.include_router(jobs_router, prefix="/jobs", tags=["jobs"])
app.include_router(toolkits_router, prefix="/toolkits", tags=["toolkits"])
app.include_router(toolkit_docs_router, prefix="/toolkits/docs", tags=["toolkits"])


@app.on_event("startup")
def load_dynamic_toolkits() -> None:  # pragma: no cover - integration hook
    ensure_bundled_toolkits_installed()
    load_toolkit_backends(app)
