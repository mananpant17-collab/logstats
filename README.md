# Log Stats

## Contents

- [TL;DR](#tldr)
- [How to use the app](#how-to-use-the-app)


## TL;DR

Log Stats is a private, Google-authenticated, mobile-first daily tracker for health, workouts, mood, goals, nutrition, study, and work, with an analytics dashboard. It is built with React 19, TypeScript, Vite, Tailwind CSS v4, Firebase Authentication and Firestore, Recharts, and optional Google Sheets export. Data is stored per authenticated user and is private to that user.

## How to use the app

### Log

The date picker can log or edit any day. The form supports:

- Weight with a stepper
- Mood selection
- Multi-select workout categories, workout notes, and structured exercises
- Sleep, water, steps, and screen-time bucket selectors
- Home-cooked, outside, and healthy-outside nutrition
- Goals with done toggles
- Study and work journals with daily enjoyment ratings
- Persistent Learning Items and Work Items trackers, including progress, status, and enjoyment

Each section has its own save action. Health, goals, study, and work records are saved to Firestore for the selected date; health and goal saves also retain the existing Google Sheets append behavior.

### History

History is grouped by month and can be searched by date, mood, or workout. Tap a day to expand everything saved for that date, including goals, mood, weight, lifestyle buckets, workout details, nutrition, journals, learning items, and work items. The Edit action opens that date in Log. Import Data and Export All preserve the legacy CSV and Google Sheets workflows.

### Analytics

Analytics has Health, Study, and Work tabs. The 7D / 30D / ALL toggle affects only the Weight Trend and Mood Journey charts; all other statistics use the complete dataset. Health includes overview stats, monthly activity, mood distribution, correlations, weight projection, lifestyle bucket distributions, nutrition day counts, and goals completion. Study and Work summarize item status, completion or enjoyment, category/timeline information, and daily enjoyment trends where available.
