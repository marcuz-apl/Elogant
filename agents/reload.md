# Hot Reload Configuration for Elogant

## Backend Reloading
- For FastAPI development, run the server with `--reload` to monitor changes:
  ```bash
  .venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
  ```
- Any file changes under `backend/` will automatically trigger a reload.

## Frontend Reloading
- For Next.js development, the hot reload is handled automatically by:
  ```bash
  npm run dev -- -p 3000
  ```
- React Hot Module Replacement (HMR) will automatically compile and display edits on save.
