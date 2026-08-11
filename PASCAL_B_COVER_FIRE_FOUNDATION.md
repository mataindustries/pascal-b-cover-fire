# PASCAL B: COVER FIRE

## Foundation Build Brief — Version 0.1

> **One frame. Zero survivors.**

This document is the source of truth for the first playable foundation of **PASCAL B: COVER FIRE**, a premium, mobile-first 2D browser game inspired by the unresolved legend of the steel shaft cap launched during the 1957 Pascal-B underground nuclear test.

The historical event is only the creative spark. This is fictional arcade science fantasy—not a simulation of nuclear weapons or a historically exact recreation.

---

## Your Assignment

Build the complete playable foundation described below in this repository.

Do not stop after planning, scaffolding, or writing a design document. Inspect the repository, make reasonable implementation decisions, create the application, run it, test it, fix problems you find, and leave the repository in a clean, runnable state.

The result must feel like a small real game, not a UI mockup, animation demo, or collection of disconnected systems.

### Definition of done

A player can open the game on a phone, start a run, charge and aim a steel cover, launch through the atmosphere, enter orbit, smash through debris, build a visible rotating wreckage halo, maintain a combo, destroy an alien mothership, see a results screen, purchase at least one persistent upgrade, and immediately play again.

---

## Product Identity

**Title:** PASCAL B: COVER FIRE  
**Tagline:** One frame. Zero survivors.  
**Genre:** Vertical launch arcade roguelite / orbital chain-reaction game  
**Platform:** Mobile-first browser game with desktop support  
**Session length:** Approximately 60–90 seconds per successful run  
**Primary emotion:** “I cannot believe that impact just caused all of that.”

### Opening premise

Use this concise setup on the title/introduction screen:

> In 1957, a camera captured the Pascal-B steel cap in a single frame.
>
> History assumed it vanished.
>
> History was wrong.

Keep any history note cautious: the real speed and fate of the cap were never directly established. Do not present the popular “fastest human-made object” claim as settled fact.

---

## Creative North Star

The game begins with one heavy steel disc and ends with a spinning orbital catastrophe.

It should combine:

- The satisfaction of charging and releasing a physical launch
- The speed and vertical spectacle of breaking through the atmosphere
- The readable ricochets and collisions of an arcade physics game
- The escalating accumulation of a Katamari-like growth loop
- The cascading destruction of an explosive chain-reaction game
- The short-run replayability and upgrades of a lightweight roguelite

Do not imitate Katamari’s characters, art, terminology, music, or exact mechanics. The original twist here is that destroyed orbital objects become a rotating **wreckage halo** around a hypersonic steel cover.

---

## The First Playable Loop

### 1. Launch setup

The player sees a dramatic underground shaft cross-section beneath a desert test site.

- A steel cover rests at the mouth of the shaft.
- A curved aiming guide shows the initial departure direction.
- Drag horizontally or swipe to adjust the angle within a limited readable range.
- Press and hold anywhere in the main play area to charge launch power.
- Release to detonate and launch.
- Show a rising power meter, trembling cover, dust, warning lights, and escalating audio while charging.
- Give the release a brief hit-stop, white flash, expanding shock ring, heavy screen shake, and satisfying launch trail.

The player should understand the controls without opening a separate tutorial.

### 2. Atmospheric ascent

The camera follows the cover upward through a rapidly changing vertical environment.

- Desert gives way to clouds, upper atmosphere, darkness, and stars.
- The player gets limited left/right steering using drag, touch regions, or keyboard input.
- Steering should bend the trajectory rather than make the cover feel like a spaceship.
- The cover can strike a few lightweight objects such as weather balloons, test instruments, aircraft silhouettes, or falling fragments.
- Impacts add score and small amounts of momentum or armor.
- A heat meter rises during ascent but should not end most first-time runs.
- Transition smoothly into orbit without a loading screen.

This phase should last roughly 12–18 seconds.

### 3. Orbital wreckage arena

Orbit is the core of the foundation build.

- Populate a vertically scrolling or bounded orbital combat space with satellites, solar panels, tanks, antenna clusters, small asteroids, and loose debris.
- Add one or two obvious gravity wells that curve the cover’s trajectory.
- Preserve the player’s sense of momentum.
- Allow restrained steering so skill matters but impacts still feel physical.
- Draw a short predicted trajectory arc when it improves readability.
- Colliding with a breakable object destroys it into fragments.
- Some fragments become visual members of the cover’s rotating wreckage halo.
- The halo grows wider, denser, brighter, and more dangerous as mass increases.
- Halo fragments can hit nearby targets, allowing indirect chain reactions.
- Each quick consecutive destruction increases the combo multiplier.
- Large impacts briefly slow time and display concise impact text such as `CHAIN x6`, `ORBITAL CASCADE`, or `MASS CRITICAL`.

The halo must look physical, but do not model it as one large compound rigid body. Represent collected debris as pooled visual/attack orbiters attached to a lightweight gameplay radius so mobile performance remains stable.

### 4. Alien interception finale

After the player reaches a clear score, mass, or distance threshold, introduce a compact alien mothership encounter.

- Give it a strong entrance silhouette and readable weak points.
- It deploys a small formation of drones or shields.
- The player uses momentum, gravity wells, and the wreckage halo to smash through the defense.
- Destroying the mothership triggers the largest chain reaction of the run.
- Use expanding shock rings, debris silhouettes, particle streaks, controlled screen shake, hit-stop, and a bold victory card.

This is an arcade finale, not a full boss system. It should be finishable during a strong 60–90 second run.

### 5. Results and upgrade

Show a crisp end-of-run report containing:

- Maximum velocity
- Objects destroyed
- Largest combo
- Wreckage mass
- Total score
- Scrap earned
- Whether the mothership was destroyed

Allow the player to spend scrap on at least three simple persistent upgrade tracks:

1. **Launch Pressure** — higher starting velocity
2. **Reinforced Cover** — greater durability and impact power
3. **Magnetic Rim** — faster wreckage-halo growth

Persist upgrades and best score in `localStorage`. Include a clearly labeled reset option in settings.

---

## Controls

### Touch

- Drag/swipe during setup: aim
- Press and hold: charge
- Release: launch
- Drag left/right during flight: restrained steering
- One-tap pause button

### Keyboard

- Left/right arrows or A/D: aim and steer
- Space: hold to charge, release to launch
- Escape or P: pause
- R: restart from results or game-over state

Prevent browser scrolling, zoom gestures, text selection, and accidental double-tap behavior inside the game surface while preserving ordinary accessibility outside it.

---

## Game Feel Requirements

The foundation succeeds or fails on game feel. Prioritize these over content volume:

- Immediate response to input
- Clear launch anticipation
- Weighty impacts
- Short, controlled hit-stop on important collisions
- Layered but bounded screen shake
- Speed lines and atmospheric streaks
- Strong pitch and volume progression during charge
- Distinct collision sounds based on impact tier
- Readable combo feedback
- Visible trajectory curvature near gravity wells
- A wreckage halo that becomes dramatically more dangerous
- Fast restart with minimal menu friction

Use Web Audio synthesis or small original/generated audio assets. Do not rely on copyrighted music or externally hot-linked assets. Start audio only after a user gesture and provide mute plus volume controls.

---

## Art Direction

Create a premium Cold War retro-futurist presentation—not a goofy sewer game and not a generic neon space shooter.

### Palette

- Near-black space: `#06080D`
- Gunmetal: `#222A33`
- Aged steel: `#7D8994`
- Warning ivory: `#F3E7CE`
- Atomic amber: `#FFB000`
- Emergency coral: `#FF4E3D`
- Ion blue: `#44C7F4`
- Radiation-lime accent, used sparingly: `#B9E937`

### Visual language

- Declassified test-film typography
- Heavy industrial labels and stamped serial numbers
- Film grain and subtle scan artifacts
- Stark desert silhouettes
- Instrument-panel UI details
- White-hot launch flash transitioning to black space
- Metallic debris with strong silhouettes
- Amber warning graphics contrasted with cold ion-blue orbital effects

Use restrained effects. The game should feel expensive, sharp, cinematic, and readable on a small screen. Avoid muddy bloom, excessive glow, tiny text, crowded HUD panels, and placeholder emoji.

### The cover

The player object must remain identifiable at speed:

- Thick circular steel silhouette
- Chunky rim
- Radial grooves or industrial reinforcement pattern
- Hot leading edge during ascent
- A readable spin
- Bright specular flash on major impacts
- Growing debris halo that never completely hides the central disc

For this foundation, use polished procedural/code-drawn artwork and local SVG/canvas shapes where practical. Build the visual asset system so generated title art and premium cover illustrations can be integrated later without rewriting gameplay.

---

## HUD and Screens

### Title screen

- Strong `PASCAL B` title
- `COVER FIRE` subtitle
- Tagline
- Animated single-frame steel-cover motif
- Large `INITIATE TEST` button
- Sound control
- Short historical-fiction disclaimer accessible without blocking play

### In-run HUD

Keep it minimal:

- Velocity
- Combo
- Mass/halo meter
- Heat or integrity meter
- Pause button

### Required states

- Boot/loading
- Title
- Brief first-run control hint
- Launch setup
- Atmospheric ascent
- Orbital arena
- Mothership finale
- Victory/results
- Failure/results
- Upgrade panel
- Pause/settings

Transitions should be quick and cinematic. Do not make the player navigate a complicated menu tree.

---

## Failure Conditions

Keep failure legible and forgiving in the foundation:

- Integrity reaches zero after repeated heavy impacts
- Velocity falls below a recoverable threshold for several seconds
- Heat reaches maximum and remains there long enough to destabilize the cover
- The player misses or fails the finale and drifts out of the combat zone

Do not frequently kill new players during the atmosphere section. The first run should reach orbit unless the player makes an extreme mistake.

---

## Technical Direction

Use a maintainable modern browser-game stack:

- Vite
- TypeScript with strict mode
- Phaser 3 unless repository inspection reveals a compelling reason to use a focused custom Canvas implementation
- Responsive HTML/CSS shell
- Local assets only
- No backend for this foundation
- No API keys or external services

### Architecture expectations

Organize systems so later passes can add covers, encounters, upgrades, art, sound, and a leaderboard without rewriting the foundation.

Suggested separation:

- Game configuration and tuning constants
- Scene/state management
- Player/cover controller
- Launch system
- Flight and steering system
- Gravity-well system
- Collision and destruction system
- Debris pooling
- Wreckage-halo system
- Combo/scoring system
- Mothership encounter
- Upgrade persistence
- Audio manager
- Effects manager
- Responsive UI/HUD

Avoid a single giant source file. Avoid premature abstraction, but keep physics, presentation, and persistent progression from becoming tightly coupled.

### Physics and simulation

- Use a fixed or carefully bounded timestep.
- Cap extreme velocities used by collision detection while preserving the visual fantasy through speed scaling and effects.
- Prevent tunneling through important targets using swept checks, enlarged hit zones, substeps, or another efficient technique.
- Use object pooling for particles and common debris.
- Use simple circles/convex bounds for collisions even when artwork is more detailed.
- Keep the collected halo lightweight as described above.
- Make tuning values easy to find and modify.

### Performance target

- Target a stable 60 FPS on a typical midrange Android phone.
- Degrade gracefully to 30 FPS without breaking simulation.
- Avoid unbounded particles, fragments, listeners, timers, tweens, or physics bodies.
- Pause simulation when the page is hidden.
- Resize cleanly on orientation and viewport changes.
- Prefer a portrait game stage around 9:16, centered with an attractive desktop surround on wider screens.

---

## Testing and Developer Support

Create enough support to make phone-based iteration efficient.

### Required scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`
- `npm run test`

### Required checks

- Production build succeeds
- TypeScript check succeeds
- Automated tests cover important pure logic such as upgrade pricing, combo behavior, score calculation, and persisted-state parsing
- No obvious console errors during a complete run
- Touch controls work without scrolling the page
- A run can progress from title to results
- Restarting does not duplicate handlers or progressively degrade performance

### Developer/debug mode

Include a non-intrusive debug mode activated by a query parameter such as `?debug=1`.

It should optionally show:

- FPS
- Current game state
- Velocity vector
- Collision bounds
- Active object counts
- Current combo timer
- Buttons to jump to orbit and trigger the mothership encounter

Debug UI must remain absent during normal play.

---

## Repository Deliverables

Create or update all files required for a clean project, including:

- Working application source
- `package.json` and lockfile
- `index.html`
- Responsive styling
- Local assets
- Automated tests
- `README.md`
- `AGENTS.md`
- Appropriate `.gitignore`

The README should contain concise setup, scripts, controls, architecture notes, deployment instructions for Cloudflare Pages, and current limitations.

The repo-level `AGENTS.md` should preserve the important development rules from this brief, especially mobile-first behavior, performance bounds, verification commands, no external hot-linked assets, and the requirement to maintain a complete playable loop.

Do not commit secrets, generated build directories, browser caches, recordings, or unnecessary binary assets.

---

## Cloudflare Pages Compatibility

Prepare the project for straightforward deployment:

- Build command: `npm run build`
- Output directory: `dist`
- No server-only runtime dependency
- No required environment variables
- Client routes must not cause refresh failures

Do not deploy from this task unless the current environment explicitly authorizes deployment. Do ensure the production build is deployment-ready.

---

## Scope Guardrails

Do **not** spend the foundation run building:

- Multiplayer
- Accounts or authentication
- Global leaderboard
- Backend services
- Multiple planets
- A campaign map
- Narrative cutscenes
- More than one boss encounter
- More than one fully playable cover
- Realistic nuclear-weapon simulation
- Historically exact locations, personnel, devices, or procedures
- A large inventory system
- A full achievement system
- Generated image integration
- Advanced accessibility menus beyond sensible semantic controls, contrast, reduced motion, and volume options

Structure the code to permit later expansion, but finish and polish the one complete loop first.

---

## Accessibility and Comfort

- Provide mute and volume controls.
- Honor `prefers-reduced-motion` by reducing shake, flashes, and excessive particles.
- Avoid rapid full-screen flashing patterns.
- Maintain strong contrast and readable type.
- Provide visible focus states for HTML controls.
- Do not require audio to understand gameplay.

---

## Implementation Order

Use this order unless repository conditions require a better sequence:

1. Inspect repository and establish the project
2. Create architecture, tuning config, and scene/state skeleton
3. Implement the complete gray-box loop
4. Make launch and collisions feel excellent
5. Implement orbit, gravity wells, combo, debris, and halo growth
6. Implement mothership finale
7. Implement results, upgrades, and persistence
8. Add responsive UI, art direction, audio, and effects
9. Add debug tools and automated tests
10. Run every verification command
11. Play through the full loop, fix discovered issues, and review the final diff

If time becomes constrained, protect the complete playable loop and cut secondary decoration. Never leave several impressive but disconnected systems.

---

## Final Report Required From Codex

When implementation is complete, report:

1. What was built
2. The exact commands run and whether each passed
3. How to launch and test it in the Codespace
4. The best phone-preview method available in the environment
5. Any remaining known issues
6. The five highest-value observations for the next iteration
7. Current git status and whether all intended changes are saved

Do not claim success without running the relevant checks.

Now build the foundation.
