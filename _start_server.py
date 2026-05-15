"""Start the backend server."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from backend.app.models import *
from backend.app.db import init_db
init_db()
import uvicorn
uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000)
