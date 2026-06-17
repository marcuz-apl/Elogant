# Developer Rules for Agent Pair Programming

This document defines environment rules and boundaries to align AI agents and human developers on the Elogant project.

## Code Standards
- All python code must follow PEP8.
- Maintain transparent API design; decouple database operations, parse logs, and computation engines.
- Write clear TypeScript for React and NestJS (if any) or Next.js code.
- Write responsive Tailwind classes to implement premium styling.

## DB Management
- SQLite database is located at `/root/projects/ElogAnt/data/elogant.db`.
- Database schemas must use dynamic pivots to support arbitrary sets of curves.
- Schema revisions should be handled automatically via python startup checks.

## Tech Stack
- Frontend: Next.js (TypeScript, Tailwind CSS, Plotly.js/Recharts).
- Backend: FastAPI, Pandas, NumPy, SQLite, XGBoost, Scikit-learn.
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
