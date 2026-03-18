# CLAUDE.md

Guidance for Claude / Silver when working in this repository.

## Project purpose

This repo is the **OpenClaw Command Center** — a local dashboard for monitoring:

- agents
- cron jobs
- calendar schedules
- local usage
- projects in `/Users/home/projects`

## Product direction

Keep the app:
- local-first
- fast to load
- readable at a glance
- visually calm, not flashy
- dashboard-like rather than app-like

## Named roles

These names are user-facing and should stay stable:

- **Brodie** = main agent = Claude Opus 4.6 (anthropic/claude-opus-4-6)
- **Silver** = Claude ACP — coding/development
- **Geo** = Claude ACP — research/writing/summarization
- **Echo** = Gemini ACP (gemini-3.0-flash) — cron jobs
- **Harvey** = MiniMax ACP (MiniMax-M2.5) — code review & secondary coding agent
- **Hunter** = Gemini ACP (gemini-3-pro-image-preview) — visual engineer

## UI priorities

1. **Org Chart**
   - show working vs idle clearly
   - subtle breathing/pulsing animation for active agents
   - show current task when available
   - include refresh action

2. **Calendar**
   - must support daily / weekly / monthly / yearly views
   - should expand well with larger window sizes
   - cron ownership by Echo should be obvious

3. **Cron Tracker**
   - operator-friendly statuses
   - preferred vocabulary:
     - Scheduled
     - Running
     - Succeeded
     - Failed
     - Partial
     - Disabled
     - Unknown

4. **Usage**
   - prioritize **live local OpenClaw/session usage**
   - provider usage APIs are optional future enhancement
   - clearly label whether data is live, inferred, or fallback

5. **Projects**
   - prefer local scanning of `/Users/home/projects`
   - infer summaries from package.json / README / folder names / light metadata

## Data philosophy

Prefer this order:
1. **live local data**
2. **inferred local data**
3. **seeded fallback data**

Do not overengineer backend plumbing if a local lightweight bridge/plugin is enough.

## Visual guidance

The user shared screenshots as guidance. Match the spirit:
- clean control-center feeling
- responsive layout
- information-dense but not cramped
- avoid dead empty space

## Engineering guidance

- Keep TypeScript builds clean
- Avoid brittle provider-specific integrations unless clearly worth it
- For local-only data, a small Vite plugin or lightweight local adapter is acceptable
- Make fallback states explicit and readable
- Do not break the shell command launcher expectation:
  - `openclaw command center`
  - target URL should be `http://localhost:3852`

## Safe assumptions

- This is a personal local dashboard
- It does not need heavy auth for local use
- Practicality beats purity

## When updating docs

Keep README.md aligned with actual implemented pages and data sources.
