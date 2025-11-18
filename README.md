#+ MCP Full-Stack (Node) — Doctor Appointment Assistant

This repository contains a minimal Node.js implementation of the internship assignment described in the prompt. It demonstrates an MCP-style backend where tools (availability, scheduling, reporting) are exposed and can be invoked by an LLM agent. A tiny React-based frontend (delivered via CDN) provides a prompt box and displays tool-driven results.

This scaffold uses plain Node (ESM) + Express for the backend and a lightweight React frontend served as static files. External integrations (Google Calendar, email) are implemented as pluggable modules; the provided versions are simple mocks you can replace with real API calls.

Structure

- `backend/` — Express server exposing MCP endpoints and tools.
- `frontend/` — Minimal React UI (CDN-based) to send prompts and view responses.

Prerequisites

- Node 18+ (for native fetch and ESM support)
- PostgreSQL (optional; the server can run with an in-memory fallback)

Quick start

1. Backend: install dependencies and start server

```bash
cd mcp_node_project/backend
npm install
# create a .env file or set env vars: DATABASE_URL, GOOGLE_CREDENTIALS, EMAIL_API_KEY
node index.js
```

2. Frontend: open `mcp_node_project/frontend/index.html` in your browser.

API (MCP-like)

- `GET /mcp/tools` — list available tools and signatures
- `POST /mcp/invoke` — invoke a tool: { tool: string, input: object, sessionId?: string }

Notes

- The scaffold includes a `db.init()` routine that will create tables and insert sample doctors and sample availability if a PostgreSQL `DATABASE_URL` is provided.
- Replace `backend/integrations/calendar.js` and `backend/integrations/email.js` with real implementations and credentials for Google Calendar / Gmail / SendGrid.

LLM / Gemini integration

- Do NOT paste your API keys directly into source files. Put them in a local `.env` file (or a secrets manager) and never commit that file.
- The backend will read `GEMINI_API_KEY` and `GEMINI_API_URL` from the environment. See `backend/.env.example` for placeholders.
- A small adapter is included at `backend/integrations/llm.js` that demonstrates how to call an LLM endpoint — it falls back to a mock response when no key is present.

If you want me to wire your Gemini key into the environment locally, tell me how you'd like the key stored (local `.env`, OS secrets store, CI secrets) and I can show exact commands. I will not place the key directly into the repository.

Next steps (suggested)

- Hook up a real LLM agent that performs tool-calling (OpenAI function-calling, or an open-source agent) to call `/mcp/invoke`.
- Add authentication (doctor/patient roles) and persist session/context for multi-turn conversations.
