# PASCAL B: COVER FIRE

> One frame. Zero survivors.

A complete mobile-first browser-game foundation about a steel cover becoming an orbital chain reaction. The presentation combines procedural Canvas/CSS effects with repository-local premium target art, sound is synthesized with Web Audio, and progress is stored locally—there are no remote assets, API keys, or backend services.

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
| `npm run assets:premium` | Alpha-crop and resize the six preserved premium source PNGs into transparent runtime WebP files |
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
- Drag in any direction during ascent and orbit to bend the momentum vector. Releasing preserves momentum.
- Tap the lower-right `CORE BURST` control when ready to discharge part of the halo as penetrating radial shrapnel.
- Tap the `II` button to pause.

Keyboard:

- `WASD` or arrow keys: aim horizontally during setup; bend the flight vector in the arena
- Hold and release `Space`: charge and launch; tap `Space` in orbit for Core Burst
- `P` or `Escape`: pause / resume
- `R`: replay from results

Audio starts only after a user gesture. Sound, volume, reset, reduced-motion support, focus styles, and high-contrast non-audio status feedback are built in.

## Gameplay loop

The playable run moves without loading screens through a short shaft ritual, a 2.75-second ascent montage, about 60 seconds of formation-driven orbital panic, a three-weak-point mothership breach, results, persistent upgrades, and immediate replay. Swarmers converge in wedges, arcs, rings, and spirals; volatile mines and premium fuel depots prime nearby targets; Splitters and premium interceptors become aggressive fragments; communications satellites, solar stations, gold telescopes, observation modules, and junk supply neutral halo mass. Every destruction can propagate a bounded gameplay shockwave. Three to eight recognizable premium targets share the arena with the small vector roster, depending on wave pressure.

Collected wreckage forms a compact 2–3-band contact-damage halo with four named tiers at 8, 24, 54, and 96 tonnes. Active halo mass is capped at 128 tonnes while peak captured mass remains a result stat. Keeping mass improves protection and contact power; Core Burst requires 15 tonnes plus full charge, retains 56–73.5% depending on Magnetic Rim, always drops a full halo by at least one tier, and launches up to 28 penetrating shards plus a mine-priming radial wave. Rapid destruction and danger grazing build temporary Overdrive, which raises speed, score, spawn pressure, color, and synth intensity without granting invulnerability. The mothership uses the same contacts, shockwaves, mines, and Core Burst rules as the arena—there is no boss-escape countdown.

Three persistent tracks are available: Launch Pressure, Reinforced Cover, and Magnetic Rim. Progress and best score use the versioned `pascal-b-cover-fire:v1` `localStorage` record. Settings includes a two-step reset control.

## Architecture

- `src/game/Game.ts` owns the fixed-step state machine and run lifecycle.
- `art-source/premium-targets/` preserves the untouched supplied RGBA PNGs; `public/assets/premium/` contains alpha-cropped WebP runtime derivatives.
- `src/game/assets/` defines preload/fallback behavior, target-to-art mapping, palettes, scale, and authored fragment crop regions.
- `src/game/config.ts` centralizes mobile budgets and tuning.
- `src/game/logic/` contains tested pure combo, chain eligibility/milestones, halo/Core Burst, Overdrive, scoring, persistence, and upgrade rules.
- `src/game/systems/` separates 2-D input, voice-limited audio, gameplay-wave/Burst pools, visual effects, halo debris, UI, and formation-driven world objects.
- `src/game/render/Renderer.ts` draws environments, preloaded premium sprites, procedural fallbacks, trajectory prediction, the cover, and debug bounds.
- `tests/` contains pure-logic coverage plus a Playwright mobile flow that completes a run, buys an upgrade, and restarts.

Simulation uses a fixed 60 Hz step with bounded catch-up and remains safe when rendering falls toward 30 FPS. Cover and Core Burst impacts use swept checks. The runtime preallocates 72 target slots with a 50-active gameplay peak, 36 halo orbiters, 28 Burst shards, 12 gameplay waves, 220 cosmetic particles, 12 visual rings, 24 causal connector flashes, 48 recognizable premium wreckage pieces, and 8 staged-breakup cues. Splitter and boss payloads recycle lower-priority pooled targets at saturation, and Burst/mine waves recycle an expiring ordinary gameplay wave rather than losing the signature action. Propagation is non-recursive and processes at most 16 target-wave impacts per fixed step. Slow frame-time hysteresis reduces cosmetic emissions without changing enemy logic. The canvas preserves its geometry in tall phone viewports, reserves the lower action-button zone, and caps device-pixel ratio at 2.

## Debug mode

Append `?debug=1` to the URL. It shows FPS, state/time, position and velocity, enemy/target counts, visual and gameplay waves, Burst shards, particles, halo tier/charge, Overdrive, spawn pressure, run seed, peak counts, drops, and combo timing. Controls enter the arena, start the mothership, spawn Swarmer/mine/Splitter formations, and fill Core Burst. The panel and collision bounds are absent in normal play.

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

- One cover, one orbital arena, one compact enemy roster, and one mothership are intentionally in scope.
- Premium target and mothership art is integrated; the player cover, small swarm roster, environments, UI, and most effects remain procedural.
- Progress is browser-local; there are no accounts, cloud sync, or leaderboard.
- The automated browser pass targets mobile Chromium. Physical-device Safari and a wider Android hardware matrix remain a release-testing task.
- There is no installable/offline PWA layer yet.
