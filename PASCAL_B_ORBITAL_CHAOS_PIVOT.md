# PASCAL B: COVER FIRE

## Phase 3 — Orbital Chaos Gameplay Pivot

> **The cover is the bullet. The halo is the bomb.**

This document replaces the current orbit gameplay direction while preserving the working technical foundation, title screen, launch identity, responsive mobile presentation, settings, persistence, results flow, and upgrade architecture.

The current build is technically smooth but not yet fun enough. Its central weakness is structural: the player slowly steers through sparse, mostly passive objects and waits for collisions. More visual polish alone will not solve that.

The new target is a dense, reactive, vector-arcade experience inspired by the immediacy, geometric clarity, enemy density, cascading particles, and escalating danger of classic arena shooters. Do not copy Geometry Wars art, enemies, sounds, terminology, layouts, or exact mechanics. Build an original orbital-destruction game around a hypersonic steel cover and captured wreckage.

---

## Assignment

Redesign and implement the core gameplay so a first-time physical-phone test can answer one question:

> Is smashing through an increasingly chaotic orbital arena immediately fun?

Do not stop after planning. Inspect the current implementation, preserve working systems where useful, refactor or replace the slow orbit loop, implement the complete pivot, test it, tune it, and leave the branch runnable.

Do not add generated art, backend services, accounts, global leaderboards, campaigns, multiple planets, or large content systems during this pass.

---

## Preserve

- `PASCAL B: COVER FIRE` title and Cold War retro-futurist identity
- “One frame. Zero survivors.”
- Current full-screen mobile sizing
- Title, settings, pause, results, upgrades, and local persistence
- The charge-and-launch ritual, compressed as described below
- The steel cover as the unmistakable player object
- Wreckage collection as a signature mechanic
- Touch-first controls with keyboard support
- Existing accessibility and reduced-motion behavior
- Stable Android performance
- Existing automated test/build workflow

Preserve saved player data safely. Migrate or default fields defensively if progression data changes.

---

## New Core Fantasy

The Pascal-B cover did not simply reach orbit. Its arrival awakened an alien interception grid.

The player is a nearly indestructible, constantly moving steel projectile trapped inside a hostile orbital arena. Alien constructs, mines, satellites, and defensive formations pour into the playfield. Every collision can start a larger detonation. Destroyed matter becomes a rotating halo. The player can retain the halo for protection and contact damage or discharge it as a radial shrapnel weapon to escape danger and trigger enormous cascades.

The emotional arc should be:

1. **I am dangerously fast.**
2. **I can aim this chaos.**
3. **That one collision destroyed an entire formation.**
4. **My halo is becoming absurd.**
5. **I am barely controlling a screen-wide disaster.**

---

## New Run Structure

Target a 75–100 second run.

### 1. Launch ritual — 4–6 seconds

Keep the current pressure charge and aim interaction, but shorten the non-interactive portion.

- Hold to charge and adjust launch vector.
- Release produces the strongest visual/audio impact currently available.
- Launch quality determines initial arena velocity, integrity bonus, and starting burst charge.
- Move rapidly through atmosphere using a 2–3 second montage of altitude bands, heat, clouds, shock rings, and blackout.
- Enter the arena before the player’s excitement from the launch dissipates.

Do not make atmospheric steering a long separate game phase.

### 2. Orbital panic — approximately 60 seconds

The cover enters a bounded portrait arena with immediate targets and threats.

- The cover always carries momentum and should never feel like a walking character or conventional spaceship.
- The player bends its trajectory continuously.
- Enemies enter in readable formations from screen edges and portals.
- The arena becomes denser every 10–15 seconds.
- Destruction creates proximity shockwaves that can damage other vulnerable targets.
- Wreckage joins the halo and visibly increases its contact radius and destructive power.
- The player can discharge the halo with **CORE BURST**.
- Combo and destruction density build **OVERDRIVE**.
- Overdrive increases speed, scoring, color intensity, audio energy, and controlled spectacle without making the screen unreadable.

There must not be long stretches of empty travel. The player should encounter a target, threat, pickup, formation, or meaningful trajectory decision at least every 1–2 seconds.

### 3. Mothership breach — approximately 15–25 seconds

The mothership is the climax of the chaos rather than a slow obstacle with a frustrating escape timer.

- Remove the current generic countdown failure as the primary boss mechanic.
- The mothership enters with escort formations and three readable weak points.
- Each destroyed weak point changes the attack pattern and releases a dense wave of volatile targets.
- Shockwave chains and Core Burst can damage weak points.
- The final weak point triggers a screen-filling but bounded destruction sequence.
- Failure should come from integrity depletion, not simply the boss leaving while the player circles it.

---

## Touch Controls and Player Agency

### Steering

Use relative drag steering anywhere on the main playfield:

- Touch and drag to indicate the direction in which the player wants to bend the cover’s momentum.
- The cover accelerates/curves toward the input direction with inertia.
- Releasing input preserves momentum.
- Show a subtle vector line or curved wake so steering influence is immediately legible.
- Input should be forgiving when the finger obscures part of the screen.
- The player must be able to intentionally line up a formation within about one second, but cannot instantly reverse direction.

Desktop: WASD or arrow keys bend the vector.

### CORE BURST

Add one large, thumb-friendly action button in the lower-right safe area.

- Label: `CORE BURST`
- Keyboard: Space
- Available only when enough burst energy or halo mass exists.
- On activation, fire captured halo fragments outward in all directions.
- Fragments penetrate or damage several targets before expiring.
- Emit a strong radial shockwave that primes volatile targets.
- Briefly reduce danger immediately around the cover.
- Preserve some halo mass so using it is powerful without completely resetting the player.
- Give clear ready, charging, and unavailable states.

Core Burst is the missing deliberate action. The player must decide whether to keep a large protective halo or spend it to trigger a massive cascade.

---

## Enemy and Target Roster

Implement only the following compact roster for this pass. Give every type a distinct silhouette, color, movement pattern, and destruction behavior.

### 1. Swarmers

- Small bright triangular alien drones
- Enter in arcs, spirals, wedges, or rings
- Try to converge on the player
- Low durability
- Explode into sharp directional particles
- Primary source of rapid combo building

### 2. Volatile mines

- Pulsing polygonal cores with a clear danger radius
- Drift or anchor in formation
- Detonate when struck, hit by a shockwave, or caught in Core Burst
- Their blast primes nearby mines and enemies
- Primary source of large chain reactions

### 3. Splitters

- Medium geometric enemies with two-stage health
- First hit cracks them into 3–5 smaller aggressive fragments
- Fragments are easy to destroy and excellent combo fuel
- Their breakup should visibly change the playfield

### 4. Orbital debris

- Satellites and junk remain as neutral material
- Denser, more readable silhouettes than the current sparse objects
- Can be collected, smashed, or caught in explosions
- Provides halo mass and tactical opportunities

### Mothership escorts

- Reuse Swarmers, mines, and Splitters in deliberate boss formations
- Do not build an additional full enemy system for escorts

---

## Chain-Reaction System

This is the heart of the pivot.

### Rules

- Every destroyed target emits a short-lived shockwave.
- Shockwaves damage or prime nearby volatile targets.
- Primed targets flash for a fraction of a second before detonating.
- A chain continues while a new destruction occurs inside the combo window.
- Large chains increase the radius or effectiveness of subsequent shockwaves within safe limits.
- Core Burst sends multiple independent chain starters across the arena.
- Major chain thresholds briefly slow time without interrupting control.

### Readability

The player must understand what caused the cascade:

- Use outward rings for shockwaves.
- Use thin connector flashes or directional streaks between linked detonations.
- Use distinct colors for enemy fire, collectible wreckage, player halo, and explosion danger.
- Do not cover targets with large opaque white fills.
- Keep the central cover visible at all times.

### Chain milestones

Use concise, escalating feedback:

- x5: `CASCADE`
- x15: `ORBITAL PANIC`
- x30: `MASS EVENT`
- x50+: `ONE FRAME`

Avoid stacking multiple large text banners at once. The current build displays too many overlapping labels during action.

---

## Halo Redesign

The current halo reads as an outline with tiny orbiting fragments but does not yet feel powerful enough.

Change it into a clear gameplay system:

- Collected fragments orbit in 2–3 organized bands rather than one oversized empty ellipse.
- Band radius remains compact enough for portrait play.
- Halo fragments visibly collide with enemies.
- Each mass tier changes color, density, sound, and contact damage.
- Important tier transitions emit a clean pulse and a short label.
- Halo fragments should be brighter and more legible than background debris.
- The halo should feel dangerous before it becomes visually enormous.
- Core Burst visibly consumes and launches a portion of the fragments.

Suggested tiers:

1. `SCRAP RING`
2. `SHRAPNEL FIELD`
3. `CRITICAL MASS`
4. `ORBITAL CATASTROPHE`

Do not simulate the halo as a compound rigid body. Continue using pooled visual/attack orbiters and a lightweight collision radius.

---

## OVERDRIVE

Add a temporary intensity state earned through aggressive play.

- Build Overdrive through rapid destructions, grazing danger, and sustaining chains.
- Drain it gradually when the player stops destroying targets.
- At high Overdrive:
  - increase controlled spawn density
  - increase score multiplier
  - brighten the cover trail and halo
  - raise music/synth intensity
  - add restrained chromatic separation or color pulses
  - increase debris attraction slightly
- Do not simply make the player invincible.
- Make Overdrive obvious without adding another large permanent HUD panel. A ring around the cover or thin edge meter is preferred.

---

## Visual Target

The current declassified UI and title screen are strong. Preserve them.

The arena must become more visually alive:

- Dark background for maximum contrast
- Bright geometric enemies in controlled coral, amber, ion blue, and radiation lime
- Dense vector particle sprays with decay trails
- Additive shock rings
- Directional shards that inherit impact velocity
- Brief enemy silhouette afterimages on destruction
- Small local camera impulses for routine hits
- Stronger shake and hit-stop only at milestone events
- Subtle arena grid deformation or wave ripples around major blasts
- Persistent but bounded trails that make trajectories visible
- Portal/edge telegraphs before formations enter

Do not solve chaos by covering the screen in bloom. Use crisp lines, motion, contrast, propagation, and density.

### Explosion tiers

Create one reusable pooled explosion system with at least four tiers:

1. **Spark** — tiny drone or fragment
2. **Burst** — ordinary enemy/debris
3. **Cascade** — mine or multi-kill
4. **Catastrophe** — Core Burst milestone or mothership phase

Each tier should combine a bounded selection of:

- radial shards
- directional impact streaks
- expanding ring
- core flash
- short-lived afterimage
- audio layer
- camera impulse
- hit-stop

---

## Audio Target

Use the existing audio architecture and original Web Audio synthesis.

- Rapid small kills should produce musical, pitch-varied ticks rather than one repeated sound.
- Chain pitch rises with combo count, then resets cleanly.
- Mines need a recognizable charge and low-frequency detonation.
- Halo collection should produce satisfying metallic/magnetic accents.
- Core Burst needs a charge snap, deep impact, expanding noise wash, and debris stingers.
- Overdrive adds an intensity layer rather than abruptly replacing audio.
- Mothership weak points need distinct confirmation hits.

Keep all sound bounded, avoid clipping, honor volume/mute, and start only after user gesture.

---

## Pacing Targets

Use these measurable targets as tuning guidance:

- First enemy contact within 1 second of arena entry
- First 5-kill chain within the first 8 seconds for a new player
- At least 15–25 active targets during the middle of a normal run
- Short peaks of 35–50 lightweight enemies/targets when performance allows
- A meaningful chain reaction at least every 5–8 seconds
- First Core Burst available within approximately 15–25 seconds
- No more than 2 seconds of empty play without a target or threat
- Mothership encounter reached in roughly 55–70 seconds
- Full successful run in roughly 75–100 seconds

Tune for fun before difficulty. A first-time player should reach the mothership and experience at least one large cascade.

---

## Progression Changes

Keep the existing three upgrade families but change their value propositions where needed:

1. **Launch Pressure** — starting velocity, starting Overdrive, or arena-entry impact
2. **Reinforced Cover** — integrity, contact damage, and collision recovery
3. **Magnetic Rim** — halo capture radius, retained mass after Core Burst, and fragment attraction

Do not focus this pass on perfect economy balance. The core loop must become fun before tuning grind or adding unlocks.

Make upgrades noticeably affect a run without allowing the first purchase to trivialize the arena.

---

## Remove or Reduce

- Long atmospheric travel
- Sparse free-flight sections
- Oversized empty planet occupying a large part of the combat area
- Passive satellites spread too far apart
- Slow circular waiting around the mothership
- Boss escape as the primary failure condition
- Multiple overlapping center-screen text messages
- Giant halo ellipses with little visible attack power
- Decorative particles that do not communicate force or causality

---

## Performance Guardrails

Target stable performance on a midrange Android phone.

- Pool enemies, projectiles, shards, rings, and common effects.
- Use fixed caps and graceful recycling.
- Use lightweight circles/polygons for collision.
- Avoid per-particle physics bodies when visual interpolation is sufficient.
- Limit simultaneous expensive catastrophe effects.
- Scale cosmetic particle density based on measured frame time while preserving enemy logic.
- Keep gameplay simulation correct at 30 FPS and target 60 FPS.
- Pause simulation when hidden.
- Prevent duplicate listeners/timers on restart.

Suggested starting caps, to tune after profiling:

- 60 lightweight enemies
- 100 neutral debris objects/fragments
- 220 cosmetic particles
- 36 active halo orbiters
- 12 simultaneous shock rings
- 8 simultaneous audio voices per effect family

These are not content goals; they are safety bounds.

---

## Debug and Test Support

Extend `?debug=1` with:

- enemy count
- particle count
- shockwave count
- current spawn intensity
- Overdrive value
- halo tier and burst charge
- button to enter arena immediately
- button to spawn each enemy formation
- button to fill Core Burst
- button to start mothership encounter

Add or update automated tests for pure logic:

- combo window and milestone calculation
- shockwave chain eligibility
- halo tier thresholds
- Core Burst mass consumption/retention
- Overdrive gain and decay
- saved-state migration/parsing

Run:

- `npm run typecheck`
- `npm run test`
- `npm run build`

Inspect the rendered game at phone dimensions and complete at least one full run through results and restart.

---

## Acceptance Test: Fun Before Finish

The pivot is successful only if all of the following are true:

- The player has a deliberate action beyond steering: Core Burst.
- The player can intentionally create a chain reaction.
- The first 10 seconds of orbit include multiple collisions and at least one cascade opportunity.
- Enemy formations visibly react to explosions and one another.
- The halo changes both offense and player decisions.
- A 20+ chain is visually and audibly exciting without becoming unreadable.
- The mothership fight uses the same chain-reaction mechanics rather than becoming a separate slow game.
- Restarting produces a different but readable formation sequence.
- Mobile performance remains stable.
- The game feels substantially faster and more dangerous than the current build.

Do not claim completion based only on passing tests. Play the game and tune spawn density, steering strength, chain radius, and Core Burst timing until the intended loop is evident.

---

## Implementation Strategy

1. Inspect current architecture and identify reusable systems.
2. Create a safe migration plan in your internal reasoning, then implement without stopping for approval on routine decisions.
3. Compress launch/atmosphere pacing.
4. Build steering and Core Burst.
5. Build the three enemy types and formation spawner.
6. Build shockwave propagation and chain readability.
7. Redesign halo tiers and Overdrive.
8. Rebuild mothership encounter around the new mechanics.
9. Tune density and game feel on a portrait viewport.
10. Verify persistence, results, restart, tests, typecheck, and build.

If scope becomes constrained, prioritize this playable vertical slice:

- short launch
- dense arena
- Swarmers
- volatile mines
- chain explosions
- meaningful halo
- Core Burst
- one mothership phase

Cut secondary decoration before cutting the new core loop.

---

## Final Report

Report:

1. What was preserved, refactored, replaced, and removed
2. Exact new controls
3. Enemy roster and formation behavior
4. Chain, halo, Core Burst, and Overdrive rules
5. Before/after pacing measurements
6. Performance caps and observed object counts
7. Commands run and results
8. Physical-phone checks still required
9. Current git status

Do not commit or push. The user must physically test whether the new loop is fun before it replaces the checkpointed version.

Now implement the orbital chaos pivot.
