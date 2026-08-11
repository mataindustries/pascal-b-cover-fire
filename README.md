# PASCAL B: COVER FIRE

> One frame. Zero survivors.

A complete mobile-first browser-game foundation about a steel cover becoming an orbital chain reaction. The visual art is procedural Canvas/CSS, sound is synthesized with Web Audio, and progress is stored locally—there are no remote assets, API keys, or backend services.

## Run it

Requires Node.js 20.19+ (Node 22+ recommended).

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The server listens on all interfaces for Codespaces and phone testing.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on `0.0.0.0` |
| `npm run build` | Strict TypeScript compile and production build |
| `npm run preview` | Preview the production build on `0.0.0.0` |
| `npm run typecheck` | Run strict TypeScript checks without emitting files |
| `npm run test` | Run pure-logic Vitest coverage |
| `npm run test:e2e` | Run the mobile Chromium launch-to-results browser test |

The first browser-test setup also needs:

```bash
npx playwright install chromium
```

On minimal Linux images, run `npx playwright install-deps chromium` once if Chromium reports missing shared libraries.

## Controls

Touch:

- Drag while the shaft is armed to choose a launch angle.
- Hold anywhere on the playfield to build pressure; release to launch.
- Drag left or right during ascent and orbit to bend the trajectory.
- Tap the `II` button to pause.

Keyboard:

- `A` / `D` or left / right arrows: aim and steer
- Hold and release `Space`: charge and launch
- `P` or `Escape`: pause / resume
- `R`: replay from results

Audio starts only after a user gesture. Sound, volume, reset, reduced-motion support, focus styles, and high-contrast non-audio status feedback are built in.

## Gameplay loop

The playable run moves without loading screens through shaft setup, a forgiving atmospheric ascent, a gravity-curved orbital debris arena, a growing attack halo, an alien interception, results, persistent upgrades, and immediate replay. Successful runs yield enough scrap for the first modification. Failure can result from integrity loss, sustained overheating, a long stall, or missing the finale window.

Three persistent tracks are available: Launch Pressure, Reinforced Cover, and Magnetic Rim. Progress and best score use the versioned `pascal-b-cover-fire:v1` `localStorage` record. Settings includes a two-step reset control.

## Architecture

- `src/game/Game.ts` owns the fixed-step state machine and run lifecycle.
- `src/game/config.ts` centralizes mobile budgets and tuning.
- `src/game/logic/` contains tested pure combo, scoring, persistence, and upgrade rules.
- `src/game/systems/` separates input, audio, pooled effects, pooled halo debris, UI, and bounded world objects.
- `src/game/render/Renderer.ts` draws procedural environments, entities, trajectory prediction, the cover, and debug bounds.
- `tests/` contains pure-logic coverage plus a Playwright mobile flow that completes a run, buys an upgrade, and restarts.

Simulation uses a fixed 60 Hz step with bounded catch-up, swept cover collision checks, 30 reusable targets, 28 halo orbiters, 120 particles, and capped effect pools. The canvas preserves its geometry while extending safely into tall phone viewports and caps device-pixel ratio at 2.

## Debug mode

Append `?debug=1` to the URL. It shows FPS, state, velocity vector, collision bounds, active target / particle / halo counts, combo time, plus `JUMP ORBIT` and `TRIGGER BOSS` controls. The panel and bounds are hidden in normal play.

## Phone preview in Codespaces

1. Run `npm run dev`.
2. Open the Codespaces **Ports** panel and locate port `5173`.
3. Set the port visibility as needed for your device, then use **Open in Browser** or copy the forwarded HTTPS URL to the phone.
4. For a clean first-run hint, use a private tab or reset progress in Settings.

The forwarded HTTPS URL is the most reliable phone method because Web Audio and browser security behavior match deployment more closely than a raw LAN address.

## Cloudflare Pages

- Framework preset: Vite (or none)
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: repository root
- Environment variables: none

The application is a single static entry point and uses no client router, server runtime, or secret configuration. Do not commit `dist`; Cloudflare creates it during deployment.

## Current limitations

- One cover, one orbital arena, and one compact boss encounter are intentionally in scope.
- Art and audio are polished procedural foundations, not final commissioned assets or a music score.
- Progress is browser-local; there are no accounts, cloud sync, or leaderboard.
- The automated browser pass targets mobile Chromium. Physical-device Safari and a wider Android hardware matrix remain a release-testing task.
- There is no installable/offline PWA layer yet.
