from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
from .config import settings
from .zbx.client import ZbxClient
from .zbx.deps import get_zbx_client
from .routes.jobs import router as jobs_router
from .routes.actions import router as actions_router

app = FastAPI(title=settings.app_name)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}

# Routers
app.include_router(jobs_router, prefix="/jobs", tags=["jobs"])
app.include_router(actions_router, prefix="/actions", tags=["actions"])
