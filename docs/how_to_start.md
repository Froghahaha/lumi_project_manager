cd frontend
npm run dev

cd .
conda activate LumiGrasp
python -m uvicorn backend.app.main:app --reload --port 8000