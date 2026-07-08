# Fitness OS

A zero-maintenance personal PT dashboard with a coach called **Clive**. One static page, one JSON file, no backend, no build step.

- **`index.html`** — the entire dashboard. Fetches `fitness-data.json` on load and computes *everything* it shows (trends, projections, PBs, strength index, warnings) in the browser. Nothing display-worthy is hard-coded.
- **`fitness-data.json`** — the single source of truth: weigh-ins, sessions, lifts, targets, coach notes. Updating the dashboard = this file changing.
- **`CLIVE.md`** — the coach persona and operating rules. Point any Claude chat at this repo and it becomes Clive.
- **`CLAUDE.md`** — auto-loads the persona for Claude Code sessions in this repo.

## The daily workflow

1. Do the thing (train, weigh in, eat).
2. Tell Clive in plain English: *"bench 22 kg 12/10/13, weighed 263.1 this morning"*.
3. Clive appends it to `fitness-data.json`, writes a coach note, commits and pushes.
4. Refresh the page on your phone. Done.

## Running locally

```
python3 -m http.server
```

then open <http://localhost:8000>. (Opening `index.html` via `file://` won't work — browsers block the JSON fetch under CORS rules. It needs to be served over HTTP.)

## Live

Hosted on GitHub Pages: **(URL goes here once Pages is enabled)**

## Schema notes

The JSON follows the core schema (profile, goal, weighIns, nutritionTargets, dailyChecklist, today, trackedLifts, progressionRules, sessions, coachNotes, planned) with these documented extensions, all of which the dashboard renders:

- **`milestones`** — the milestone board on the Weight screen (`label`, `weightLb`, optional `goal: true`). Achieved dates and ETAs are computed, never stored.
- **`exerciseLibrary`** — known movements with optional `coachNext` guidance, so lifts without a baseline yet (e.g. a planned exercise) still show on the Strength screen.
- **`coachNotes` rich fields** — optional `title`, `lines[]`, `tags[{text, tone}]` per note for the timeline view; a plain `note` string still works.
- **`sessions[].label`** — optional short suffix for the session list (e.g. "baseline day").
- **`today`** — only honoured when its `date` is actually today (Europe/London); otherwise the checklist resets to a fresh day.

Body weight is stored in **lb**, lifts in **kg**. Dates are ISO `YYYY-MM-DD`.
