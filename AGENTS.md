# Repository Working Rules

`PASCAL_B_COVER_FIRE_FOUNDATION.md` is the product source of truth. Preserve a complete, runnable title-to-results loop before expanding content or decoration.

## Product and scope

- Keep the game mobile-first, portrait-oriented, touch-safe, and fully playable with keyboard controls.
- Preserve every core state: boot, title, first-run hint, launch, ascent, orbit, mothership, victory/failure results, upgrades, pause/settings, and fast replay.
- Keep the cautious historical-fiction wording. Never state the cap's speed or fate as settled history.
- Do not add multiplayer, accounts, a backend, leaderboard, campaign map, additional planets, multiple bosses/covers, weapon simulation, a large inventory, or generated-image integration during foundation work.
- Use only repository-local or procedural assets. Never hot-link art, fonts, sound, scripts, or other runtime resources.

## Mobile and performance constraints

- Target 60 FPS on a midrange Android phone and remain simulation-safe at 30 FPS.
- Keep the fixed/bounded timestep, capped collision velocity, and swept checks for important impacts.
- Reuse the existing target, particle, shockwave, impact-text, and halo-orbiter pools. Do not introduce unbounded bodies, particles, timers, listeners, or tweens.
- The halo remains a lightweight gameplay radius with visual/attack orbiters—not a compound rigid body.
- Keep common budgets and gameplay tuning in `src/game/config.ts`.
- Preserve `touch-action`, overscroll, selection, zoom, resize/orientation, page-visibility pause, and device-pixel-ratio protections.
- New UI must remain readable at 360 CSS pixels wide and must not hide the central cover.
- Honor reduced-motion preferences and provide all gameplay information without requiring audio.

## Architecture and persistence

- Keep pure rules in `src/game/logic`, reusable runtime systems in `src/game/systems`, rendering in `src/game/render`, and lifecycle coordination in `Game.ts`.
- Do not fold the project into one giant source file or tightly couple persistent progression to rendering.
- Keep TypeScript strict and avoid `any` in application code.
- Treat the `pascal-b-cover-fire:v1` storage record as untrusted input. Clamp and default parsed values; version deliberately if the schema changes.
- Audio must begin only after a user gesture and remain synthesized or repository-local.
- Bind global and surface listeners once, clean them up on teardown, and verify that replay does not duplicate handlers.

## Required verification

Before handing off gameplay changes, run:

```bash
npm run typecheck
npm run test
npm run build
```

Run `npm run test:e2e` for changes to state transitions, controls, persistence, pause, restart, responsive UI, or browser behavior. Use `?debug=1` for FPS, state, bounds, pool counts, and fast phase jumps; debug UI must remain hidden in normal play.

Review a full phone-sized launch-to-results playthrough and the browser console. Confirm touch gestures do not scroll the page, results can purchase an upgrade, and at least two consecutive runs stay within pool budgets.

## Repository hygiene

- Never commit secrets, API keys, `node_modules`, `dist`, browser caches, screenshots, recordings, Playwright output, or unrelated binary files.
- Keep Cloudflare Pages compatibility: `npm run build`, `dist`, static client runtime, no required environment variables.
- Do not deploy, commit, or push unless the user explicitly requests it.
