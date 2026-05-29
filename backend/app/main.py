from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException

from .db import init_db
from .routers import auth, customers, misc, persons, projects

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(customers.router)
app.include_router(projects.router)
app.include_router(persons.router)
app.include_router(misc.router)
app.include_router(auth.router)


class _SPAStaticFiles(StaticFiles):
    """StaticFiles that serves index.html for any unmatched path (SPA fallback)."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


if getattr(sys, 'frozen', False):
    STATIC_DIR = Path(sys._MEIPASS) / 'backend' / 'static'
else:
    STATIC_DIR = Path(__file__).resolve().parent.parent / 'static'

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
    app.mount("/", _SPAStaticFiles(directory=STATIC_DIR, html=True), name="static")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
