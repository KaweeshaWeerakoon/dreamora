# DREAMORA — Study Beyond

A responsive, installable web-app starter for DREAMORA.

## Build 02 — online accounts and cloud sync

Build 02 adds Supabase email/password registration and sign-in, project connection settings, per-account local storage separation, row-level-secured cloud progress snapshots, and cross-device restore/sync. Guest mode remains available.

### Connect your Supabase project

1. Create a Supabase project at https://supabase.com/.
2. Open **SQL Editor** in the Supabase dashboard.
3. Open `supabase/schema.sql` from this project, copy all of it, paste it into a new SQL query, and click **Run**.
4. In Supabase **Project Settings → API** (or **API Keys**), copy the **Project URL** and the **anon / publishable public key**. Do not copy the `service_role` secret.
5. Run DREAMORA, click **Guest mode / Cloud** in the top bar, paste the Project URL and public key, and click **Save project connection**.
6. Choose **Create account**, enter an email, password (8+ characters), and display name. If email confirmation is enabled, verify the email before signing in.
7. Sign in. The app will restore the account’s cloud save or upload the current guest progress if the account has no save yet.

Supabase project URL format: `https://YOUR-PROJECT-REF.supabase.co`. The public anon/publishable key is intended for browser use when Row Level Security is enabled. Never paste a `service_role` key into DREAMORA or share it.

### What Build 02 currently syncs

The complete study-state snapshot (profile, subjects/topics, focus sessions, XP totals, quests, streaks and preferences) is stored in a private `user_state` row per authenticated user. Supabase Row Level Security restricts each account to its own row. Account data is separated in local browser storage as well.

**Important security boundary:** Build 02 is an MVP cloud-sync implementation. The client currently writes its own progress snapshot, so XP is not yet tamper-proof. Do not use this as a competitive leaderboard or award prizes based on XP. Server-verified focus sessions and XP rewards, abuse protection, password reset flow, privacy/terms pages and production monitoring are Build 03 / launch requirements.

## Included in this starter

- Dark fantasy responsive interface
- Dashboard and study overview
- Pomodoro, extended, deep-focus and stopwatch timers
- Focus session history and local XP rewards
- Daily quest board and achievements
- Subject and topic tracker
- Character profile and companion selection
- Analytics with weekly focus and subject distribution
- Local data export/reset
- PWA manifest and offline app-shell caching
- Capacitor configuration for Android packaging
- Supabase starter schema with row-level security policies

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run start
```

Open the local URL printed by Vite.

## Build the web app

```bash
npm run build
npm run preview
```

Deploy the contents of `dist/` to a static web host with HTTPS.

## Install as a PWA

Deploy over HTTPS, then open the website in a supported browser and use its
"Install app" / "Add to Home Screen" option. PWA installation availability
depends on browser and operating system.

## Android APK

Install Android Studio and the Android SDK first.

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, build a debug APK for testing or a signed release APK for
distribution. `npm run android:add` is only needed once. After web changes,
run `npm run build` and `npx cap sync android` again.

## Current limitations — read before public launch

Build 02 includes working Supabase Auth and cloud snapshot sync when the project
has been configured and `supabase/schema.sql` has been run. Guest mode still uses
browser localStorage. This is not yet a production launch: XP is client-managed,
and there is no server-side session validation, password reset, account deletion,
live guilds, licensed soundscape library, or device-wide app blocking.

The included SQL enables Row Level Security for per-user cloud data. Test with at
least two separate accounts before public launch. Never place the Supabase
service-role key in client-side code.

## Next production milestones

1. Server-side focus-session validation and XP ledger.
2. Password reset, email change, account deletion and privacy controls.
3. Spaced repetition flashcards.
4. Companion unlocks, inventory and visual room customization.
5. Soundscape audio assets and licensing.
6. Guilds, live rooms, moderation and reporting.
7. Accessibility, privacy review, automated tests and release pipeline.
