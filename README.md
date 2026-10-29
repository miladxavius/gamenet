# Game Net

A small arcade for friends: pick an avatar and a unique gamertag, play games, and compare scores on shared leaderboards.

Play: https://miladxavius.github.io/gamenet/

## How it works

- Static site hosted on GitHub Pages (`index.html`, `js/`, `vendor/`).
- Profiles and scores live in Supabase. Players sign in anonymously on their device, so nobody needs an account.
- `supabase/schema.sql` creates the tables and the rules (anyone can read, each player can only change their own profile and scores).
- `js/config.js` holds the Supabase project URL and its publishable key, which is meant to be public.

## Adding a game

1. Add `js/<game>.js` with a `createX(canvas, hooks)` function, like `createFirefly` in `js/firefly.js`. Call `hooks.onGameOver(score)` when a round ends, use `hooks.getBest()` for the best score, and return `{ destroy() }`.
2. Add a thumbnail drawer (see `js/thumb.js`).
3. Add one entry to `GAMES` in `js/app.js` and a `<script>` tag in `index.html`.

Scores are stored per game id in the `scores` table, so no database change is needed.
