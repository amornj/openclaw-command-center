# OpenClaw Command Center

A local dashboard for monitoring the OpenClaw workspace.

## What it is

OpenClaw Command Center is a small local React/Vite app that gives a dashboard view of:

- **Org Chart** — Brodie, Silver, Geo, Echo and their roles
- **Calendar** — cron schedule views (daily / weekly / monthly / yearly)
- **Cron Tracker** — job state overview
- **Usage** — local OpenClaw/session usage signals
- **Projects** — summaries of projects inside `/Users/home/projects`

This app is designed for local use on Amornj's machine.

## Agent model

- **Brodie** = main GPT-5.4 orchestrator
- **Silver** = Claude ACP coding agent
- **Geo** = Claude ACP research / writing / summarization agent
- **Echo** = GPT-5.4 responsible for cron jobs

## Current data model

The app uses a mix of:

- **live local data** where practical
- **inferred local data** where direct live wiring is partial
- **seeded fallback data** when a local bridge is not yet available

### Current intent

- Prefer **live local OpenClaw/session data** over provider usage APIs
- Treat provider billing/usage bridges as **future optional enhancements**
- Prefer **real local project scanning** for the Projects page
- Prefer **real local cron data** for calendar/tracker views when feasible

## Pages

### Org Chart
Shows the current agent map and activity state.

Goals:
- active vs idle cues
- current task when available
- refresh button to re-pull state

### Calendar
Shows cron scheduling across:
- daily
- weekly
- monthly
- yearly

### Cron Tracker
Shows job-level status such as:
- Scheduled
- Running
- Succeeded
- Failed
- Partial
- Disabled
- Unknown

### Usage
Shows local OpenClaw/session usage first.

Future option:
- provider-specific usage bridge for OpenAI / Anthropic

### Projects
Scans `/Users/home/projects` and renders project cards with inferred descriptions.

## Local run

```bash
cd /Users/home/projects/openclaw-command-center
npm install
npm run dev
```

## Build

```bash
cd /Users/home/projects/openclaw-command-center
npm run build
```

## Command launcher

This project is also exposed through the shell shortcut:

```bash
openclaw command center
```

Current launch target:

- `http://localhost:3849`

## Notes

This project is intentionally pragmatic:
- local-first
- dashboard-oriented
- easy to iterate
- okay with mixed live/inferred/seeded data while bridges are still being built
