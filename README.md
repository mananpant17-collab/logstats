# Log Stats

## TL;DR

Log Stats is a private, Google-authenticated, mobile-first daily tracker for health, workouts, mood, goals, nutrition, study, and work, with an analytics dashboard. It is built with React 19, TypeScript, Vite, Tailwind CSS v4, Firebase Authentication and Firestore, Recharts, and optional Google Sheets export. Data is stored per authenticated user and is private to that user.

## Quick start

### Prerequisites

- Node.js 20.19+ (or Node.js 22.12+)
- npm
- A Firebase web application with Google Authentication enabled

### Install and configure

```bash
npm install
cp .env.example .env
```

Fill in the `VITE_FIREBASE_*` values in `.env` with the Firebase web configuration:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Add `localhost` (and the eventual deployment domain) to Firebase Authentication's authorized domains. Google sign-in requests the Google Sheets scope so the app can optionally create, append to, and export each user's spreadsheet.

### Run

```bash
npm run dev       # Vite development server, port 3000
npm run build     # Production build in dist/
npm run preview   # Preview the production build
```

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

## Architecture and project structure

```text
src/
  App.tsx                 Firebase initialization, auth, Google Sheets token
  components/Layout.tsx   App shell, header, and bottom navigation
  pages/Home.tsx          Log form and persistent item trackers
  pages/History.tsx       Month-grouped history, import/export, editing
  pages/Analytics.tsx     Health, Study, and Work analytics
  lib/moods.ts            Shared mood definitions, labels, scores, emojis
  lib/insights.ts         Correlations, regression, metric buckets, workout detection
  lib/sheets.ts           Google Sheets creation, append, and export helpers
index.css                 Design tokens and typography
firestore.rules           Per-user Firestore access rules
```

`index.css` defines the `#080a0c` dark palette, `#c8925a` amber and `#5a9e8f` teal accents, and the Cormorant Garamond, Outfit, and Space Mono fonts.

Firestore data is scoped under `users/{uid}/`:

- `daily/{yyyy-MM-dd}`: `date`, `goals[]` with text and done state
- `healthLogs/{yyyy-MM-dd}`: `date`, `weight`, `mood`, `workoutCategories[]`, legacy `workoutCategory`, numeric `workoutDone` when imported, `workoutNotes`, `sleepBucket`, `waterBucket`, `stepsBucket`, `screenBucket`, `foodHome[]`, `foodOutside[]`, `foodHealthyOutside[]`, legacy nutrition arrays where present, and `exercises[]`
- `moodLogs/{yyyy-MM-dd}`: backwards-compatible mood record
- `studyLogs/{yyyy-MM-dd}`: `schoolNotes`, `learningNotes`, legacy `practiceHours`, and `studyEnjoyment`
- `workLogs/{yyyy-MM-dd}`: `workNotes`, `networkNotes`, and `workEnjoyment`
- `learningItems/{autoId}`: title, category, status, progress values, unit, enjoyment, notes, start and updated dates, and timestamps
- `workItems/{autoId}`: title, category, status, enjoyment, notes, start and updated dates, and timestamps
- `settings/sheets`: per-user spreadsheet configuration

The key workout helper is `isWorkoutDay(log)`. When a numeric `workoutDone` field exists, it is authoritative. Otherwise it falls back to non-empty workout categories, meaningful legacy workout categories, or structured exercises.

## Google Sheets

Google Sheets is an optional export and append integration. Each user gets an auto-created spreadsheet named `Log Stats – Comprehensive Tracker`. The established flattened layout is ten columns, `A:J`. Export All is available in History, and the existing Log saves append their established rows.

Firestore remains the source of truth. Newer fields such as lifestyle buckets, structured exercises, learning and work items, enjoyment ratings, and goal done-state are not fully mirrored to Sheets. The Sheets payload and `src/lib/sheets.ts` should be treated as compatibility-sensitive code.

## Maintenance and extending the app

### Adding a logged field

For a new daily field:

1. Add state and controls in `Home.tsx`.
2. Load it from the selected date's document.
3. Save it to the appropriate Firestore document.
4. Render it in the History expanded view.
5. Add an Analytics view only if the field has useful cross-day analysis.

Keep the existing `practiceHours` / Study Hours field and save logic intact for legacy compatibility.

### Adding analytics

Add data derivation near the existing memoized analytics values in `Analytics.tsx`, then add a small card or section using the existing design tokens. Recharts chart definitions and their grid, axis, line, and tooltip styling live in that file. Shared colors and typography live in `src/index.css`.

### Workout-count gotcha

Do not infer a workout from arbitrary workout text or notes. Use `isWorkoutDay(log)`. Imported spreadsheet rows use the numeric Done column as `workoutDone`, and that numeric value takes precedence over category text.

### Configuration and deployment

`.env` is gitignored. Firebase configuration changes are local environment changes and must be applied manually; they do not arrive through `git pull`. Build the static site with `npm run build`; the resulting `dist/` directory works with Vercel or Firebase Hosting. Set the same `VITE_FIREBASE_*` variables in the deployment environment and add the deployment domain to Firebase Authentication's authorized domains.

If a new Firestore collection is added, update `firestore.rules` and confirm that its path remains scoped to the authenticated user's `users/{uid}` document.
