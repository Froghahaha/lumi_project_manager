from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.on_event("startup")
def on_startup() -> None:
    init_db()
