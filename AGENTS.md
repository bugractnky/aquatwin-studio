# AquaTwin repository instructions for AI assistants

## Mandatory start of every development session

Before editing, automatically follow [docs/SESSION_START.md](docs/SESSION_START.md), including resumed work. Inspect local changes and unfinished Git operations, fetch origin, then verify the base. New tasks start on a new branch from current main; continuing tasks preserve their branch and integrate missing main commits safely. Never automatically discard, stash, commit or mix others' work, reset history or rebase published work. Stop dependent edits on fetch failures, conflicts or unresolved base decisions. Re-read guidance after synchronization and briefly report branch/base status.

## Read first

Before proposing or editing code, read these tracked files in order:

1. [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) — project context, current implementation, detailed ordered roadmap and acceptance criteria.
2. [DEVELOPMENT_DECISIONS.md](DEVELOPMENT_DECISIONS.md) — dated decisions and implementation evidence.
3. [docs/MEASUREMENT_CONTRACT.md](docs/MEASUREMENT_CONTRACT.md) — measurement v1 semantics.
4. [README.md](README.md) and, for backend/data work, [backend/README.md](backend/README.md).
5. The source and tests relevant to the user's requested change.

These instructions cover the entire repository. The user's explicit current request takes precedence. The roadmap is context, not permission to implement every phase. If source, tests and documents disagree, verify actual behavior and report the discrepancy before treating it as established fact.

## Current baseline

- React/Vite/Three.js demo plus FastAPI/PostgreSQL measurement API.
- Separate API workspace reads persistent measurements and plots supported local points.
- Hardware procurement is coordinated by the university/supervisors; delivery and exact specifications were unconfirmed at the last handoff. Update only from new evidence.
- No real device telemetry, motor commands, offline device queue, GNSS transform or API interpolation yet.
- Persistent sampling plans and separate operator sessions are implemented (M3). Read `docs/MISSION_PLANNING.md` before planning/auth changes.
- The user prioritized M3 over infrastructure work. M2 remains pending; the next software feature is M4 telemetry/events unless the user directs otherwise.

## Preserve these contracts

- Keep demo and API data separate; never silently fall back to demo on API errors.
- Do not invent sensor values, coordinates, calibration, hardware capabilities or field test results.
- Missing parameters remain missing; measured, interpolated, simulated and device data stay distinguishable.
- Keep UTC measurement/receipt timestamps and target/actual depth separate.
- Preserve immutable UUID ingestion and same-payload retry behavior; never silently overwrite a conflicting measurement.
- Follow the v1 parameter units, quality mapping and coordinate reference rules. Read `backend/app/schemas.py` and `src/api.js` before changing their boundary.
- Preserve the existing stack. Do not introduce a second API, database or replacement frontend as an unsolicited rewrite.
- Never put ingest tokens in frontend variables, tracked files or logs. Do not run tests on field data.
- API poll freshness is not device telemetry. Animation and command acceptance are not physical execution evidence.

## Work and verification

- Check `git status --short --branch` and current history first. Preserve other contributors' uncommitted work.
- Use a separate branch from the appropriate current base. Make logical commits with descriptive messages; push verified milestones as requested by the project owner. Do not force push.
- Merge/deploy only with explicit current authorization. A request to update docs or push a branch does not authorize merging it.
- Frontend checks: `npm test`, `npm run build`.
- Backend checks: separate `aquatwin_test*` PostgreSQL DB, `TEST_DATABASE_URL`, `PYTHONPATH=backend`, then `.venv/bin/python -m pytest -q backend/tests`.
- E2E: running API and Vite required, matching ingest token, then `npm run test:e2e`. Setup and configurable ports are in the handoff.
- Run checks appropriate to the change. Documentation-only work needs source/link consistency checks; do not claim unrun runtime tests passed.
- Update decisions, contracts/setup and milestone status with delivered changes. Keep historical verification dates separate from fresh results.

For complete rationale, file ownership, current limits and each next milestone, return to [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md).
