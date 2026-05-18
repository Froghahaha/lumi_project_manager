"""Start the backend server."""
import sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, root)
os.chdir(root)
from backend.app.models import *
from backend.app.db import init_db
init_db()
import uvicorn
uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000)
