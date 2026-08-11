import { UPGRADE_DEFINITIONS } from '../config';
import { formatNumber } from '../math';
import { upgradePrice } from '../logic/upgrades';
import type { DebugSnapshot, GamePhase, Outcome, PersistedState, RunStats, UpgradeKey } from '../types';

export interface HudState {
  velocity: number;
  combo: number;
  comboProgress: number;
  mass: number;
  massProgress: number;
  heat: number;
  integrity: number;
  maxIntegrity: number;
  score: number;
  phaseLabel: string;
  bossProgress?: number;
  bossTime?: number;
}

export interface UICallbacks {
  start(): void;
  armTest(): void;
  replay(): void;
  pause(): void;
  resume(): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  purchaseUpgrade(key: UpgradeKey): void;
  resetProgress(): void;
  jumpToOrbit(): void;
  triggerBoss(): void;
}

const queryRequired = <T extends Element>(parent: ParentNode, selector: string): T => {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required UI element: ${selector}`);
  return element;
};

export class UIController {
  public readonly canvas: HTMLCanvasElement;
  private readonly hud: HTMLElement;
  private readonly bootScreen: HTMLElement;
  private readonly titleScreen: HTMLElement;
  private readonly hintScreen: HTMLElement;
  private readonly resultsScreen: HTMLElement;
  private readonly pauseScreen: HTMLElement;
  private readonly settingsScreen: HTMLElement;
  private readonly announcer: HTMLElement;
  private readonly debugPanel: HTMLElement | null;
  private readonly upgradeList: HTMLElement;
  private readonly muteButtons: HTMLButtonElement[];
  private readonly volumeInputs: HTMLInputElement[];
  private resetArmed = false;
  private announceTimer = 0;

  public constructor(
    app: HTMLElement,
    private readonly callbacks: UICallbacks,
    debugEnabled: boolean,
  ) {
    app.innerHTML = this.template(debugEnabled);
    this.canvas = queryRequired<HTMLCanvasElement>(app, '#game-canvas');
    this.hud = queryRequired(app, '#hud');
    this.bootScreen = queryRequired(app, '#boot-screen');
    this.titleScreen = queryRequired(app, '#title-screen');
    this.hintScreen = queryRequired(app, '#hint-screen');
    this.resultsScreen = queryRequired(app, '#results-screen');
    this.pauseScreen = queryRequired(app, '#pause-screen');
    this.settingsScreen = queryRequired(app, '#settings-screen');
    this.announcer = queryRequired(app, '#announcer');
    this.debugPanel = app.querySelector('#debug-panel');
    this.upgradeList = queryRequired(app, '#upgrade-list');
    this.muteButtons = Array.from(app.querySelectorAll<HTMLButtonElement>('[data-action="mute"]'));
    this.volumeInputs = Array.from(app.querySelectorAll<HTMLInputElement>('[data-setting="volume"]'));
    this.bind(app);
  }

  public showPhase(phase: GamePhase): void {
    this.bootScreen.classList.toggle('is-active', phase === 'boot');
    this.titleScreen.classList.toggle('is-active', phase === 'title');
    this.hintScreen.classList.toggle('is-active', phase === 'hint');
    this.resultsScreen.classList.toggle('is-active', phase === 'results');
    this.hud.classList.toggle('is-visible', ['launch', 'ascent', 'orbit', 'boss'].includes(phase));
    document.body.dataset.phase = phase;
  }

  public setPaused(paused: boolean): void {
    this.pauseScreen.classList.toggle('is-active', paused);
  }

  public updateHud(state: HudState): void {
    this.setText('#hud-velocity', `${state.velocity.toFixed(1)} km/s`);
    this.setText('#hud-combo', state.combo > 1 ? `x${state.combo}` : '—');
    this.setText('#hud-mass', `${state.mass.toFixed(1)} t`);
    this.setText('#hud-score', formatNumber(state.score));
    this.setText('#phase-label', state.phaseLabel);
    this.setBar('#combo-bar', state.comboProgress);
    this.setBar('#mass-bar', state.massProgress);
    this.setBar('#heat-bar', state.heat);
    this.setBar('#integrity-bar', state.integrity / Math.max(1, state.maxIntegrity));
    const statusLabel = queryRequired<HTMLElement>(this.hud, '#condition-label');
    statusLabel.textContent = state.heat > 0.82 ? 'THERMAL' : state.integrity < state.maxIntegrity * 0.35 ? 'INTEGRITY' : 'NOMINAL';
    statusLabel.classList.toggle('is-danger', state.heat > 0.82 || state.integrity < state.maxIntegrity * 0.35);

    const bossMeter = queryRequired<HTMLElement>(this.hud, '#boss-meter');
    bossMeter.classList.toggle('is-visible', state.bossProgress !== undefined);
    if (state.bossProgress !== undefined) {
      this.setBar('#boss-bar', state.bossProgress);
      this.setText('#boss-time', `${Math.max(0, Math.ceil(state.bossTime ?? 0))}s`);
    }
  }

  public showResults(outcome: Outcome, stats: RunStats, persisted: PersistedState, reason: string): void {
    const victory = outcome === 'victory';
    const kicker = queryRequired<HTMLElement>(this.resultsScreen, '#results-kicker');
    kicker.textContent = victory ? 'INTERCEPT CONFIRMED' : 'SIGNAL LOST';
    kicker.classList.toggle('is-victory', victory);
    this.setText('#results-title', victory ? 'ZERO SURVIVORS' : 'COVER RECOVERED');
    this.setText('#results-reason', reason);
    this.setText('#result-velocity', `${stats.maximumVelocity.toFixed(1)} km/s`);
    this.setText('#result-destroyed', formatNumber(stats.objectsDestroyed));
    this.setText('#result-combo', `x${stats.largestCombo}`);
    this.setText('#result-mass', `${stats.wreckageMass.toFixed(1)} t`);
    this.setText('#result-score', formatNumber(stats.totalScore));
    this.setText('#result-scrap', `+${formatNumber(stats.scrapEarned)}`);
    this.setText('#result-mothership', stats.mothershipDestroyed ? 'DESTROYED' : 'ESCAPED');
    this.setText('#result-best', `BEST ${formatNumber(persisted.bestScore)}`);
    this.updateUpgradePanel(persisted);
  }

  public updateUpgradePanel(state: PersistedState, message = ''): void {
    this.setText('#scrap-balance', `${formatNumber(state.scrap)} SCRAP`);
    this.setText('#upgrade-message', message);
    this.upgradeList.innerHTML = (Object.keys(UPGRADE_DEFINITIONS) as UpgradeKey[]).map((key) => {
      const definition = UPGRADE_DEFINITIONS[key];
      const level = state.upgrades[key];
      const maxed = level >= definition.maxLevel;
      const price = upgradePrice(level);
      const disabled = maxed || state.scrap < price;
      const levels = Array.from({ length: definition.maxLevel }, (_, index) =>
        `<i class="upgrade-pip ${index < level ? 'is-filled' : ''}"></i>`).join('');
      return `
        <article class="upgrade-card">
          <div class="upgrade-code">${definition.code}</div>
          <div class="upgrade-copy">
            <h3>${definition.name}</h3>
            <p>${definition.description}</p>
            <div class="upgrade-levels" aria-label="Level ${level} of ${definition.maxLevel}">${levels}</div>
          </div>
          <button class="upgrade-buy" data-upgrade="${key}" ${disabled ? 'disabled' : ''}>
            ${maxed ? 'MAX' : `${price} S`}
          </button>
        </article>`;
    }).join('');
  }

  public syncSettings(state: PersistedState): void {
    for (const button of this.muteButtons) {
      button.dataset.muted = String(state.muted);
      button.setAttribute('aria-pressed', String(state.muted));
      const label = state.muted ? 'Sound off' : 'Sound on';
      button.setAttribute('aria-label', label);
      button.title = label;
      button.textContent = state.muted ? 'SOUND OFF' : 'SOUND ON';
    }
    for (const input of this.volumeInputs) input.value = String(Math.round(state.volume * 100));
  }

  public announce(text: string, tone: 'neutral' | 'warning' | 'victory' = 'neutral'): void {
    window.clearTimeout(this.announceTimer);
    this.announcer.textContent = text;
    this.announcer.dataset.tone = tone;
    this.announcer.classList.remove('is-active');
    requestAnimationFrame(() => this.announcer.classList.add('is-active'));
    this.announceTimer = window.setTimeout(() => this.announcer.classList.remove('is-active'), 1600);
  }

  public updateDebug(snapshot: DebugSnapshot): void {
    if (!this.debugPanel) return;
    const readout = queryRequired<HTMLElement>(this.debugPanel, '#debug-readout');
    readout.textContent = [
      `FPS ${snapshot.fps.toFixed(0)}`,
      `STATE ${snapshot.phase.toUpperCase()}`,
      `VEC ${snapshot.velocityX.toFixed(0)}, ${snapshot.velocityY.toFixed(0)}`,
      `OBJECTS ${snapshot.targets}`,
      `PARTICLES ${snapshot.particles}`,
      `HALO ${snapshot.haloOrbiters}`,
      `COMBO T ${snapshot.comboTimer.toFixed(2)}`,
    ].join('\n');
  }

  public openSettings(open: boolean): void {
    this.settingsScreen.classList.toggle('is-active', open);
    if (!open) this.resetArmed = false;
  }

  private setText(selector: string, text: string): void {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = text;
  }

  private setBar(selector: string, progress: number): void {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.style.setProperty('--progress', String(Math.max(0, Math.min(1, progress))));
  }

  private bind(app: HTMLElement): void {
    queryRequired<HTMLButtonElement>(app, '#start-button').addEventListener('click', this.callbacks.start);
    queryRequired<HTMLButtonElement>(app, '#arm-button').addEventListener('click', this.callbacks.armTest);
    queryRequired<HTMLButtonElement>(app, '#replay-button').addEventListener('click', this.callbacks.replay);
    queryRequired<HTMLButtonElement>(app, '#pause-button').addEventListener('click', this.callbacks.pause);
    queryRequired<HTMLButtonElement>(app, '#resume-button').addEventListener('click', this.callbacks.resume);
    if (this.debugPanel) {
      queryRequired<HTMLButtonElement>(app, '#debug-orbit').addEventListener('click', this.callbacks.jumpToOrbit);
      queryRequired<HTMLButtonElement>(app, '#debug-boss').addEventListener('click', this.callbacks.triggerBoss);
    }

    app.querySelectorAll<HTMLButtonElement>('[data-action="settings-open"]').forEach((button) => {
      button.addEventListener('click', () => this.openSettings(true));
    });
    queryRequired<HTMLButtonElement>(app, '#settings-close').addEventListener('click', () => this.openSettings(false));

    for (const button of this.muteButtons) {
      button.addEventListener('click', () => this.callbacks.setMuted(button.dataset.muted !== 'true'));
    }
    for (const input of this.volumeInputs) {
      input.addEventListener('input', () => this.callbacks.setVolume(Number(input.value) / 100));
    }

    this.upgradeList.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-upgrade]');
      if (!button || button.disabled) return;
      this.callbacks.purchaseUpgrade(button.dataset.upgrade as UpgradeKey);
    });

    queryRequired<HTMLButtonElement>(app, '#reset-progress').addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      if (!this.resetArmed) {
        this.resetArmed = true;
        button.textContent = 'TAP AGAIN TO CONFIRM';
        return;
      }
      this.callbacks.resetProgress();
      button.textContent = 'RESET ALL PROGRESS';
      this.resetArmed = false;
    });
  }

  private template(debugEnabled: boolean): string {
    return `
      <div class="app-surround">
        <section class="game-shell" aria-label="PASCAL B: COVER FIRE game">
          <canvas id="game-canvas" width="450" height="800" aria-label="Game playfield"></canvas>
          <div class="film-grain" aria-hidden="true"></div>

          <header id="hud" class="hud" aria-label="Run status">
            <div class="hud-row hud-primary">
              <div class="hud-stat"><small>VELOCITY</small><strong id="hud-velocity">0.0 km/s</strong></div>
              <div class="hud-stat hud-score"><small>SCORE</small><strong id="hud-score">0</strong></div>
              <button id="pause-button" class="icon-button" aria-label="Pause game">II</button>
            </div>
            <div class="hud-row hud-secondary">
              <div class="micro-stat combo-stat"><span>CHAIN <b id="hud-combo">—</b></span><i id="combo-bar" class="micro-bar"></i></div>
              <div class="micro-stat"><span>HALO <b id="hud-mass">0.0 t</b></span><i id="mass-bar" class="micro-bar"></i></div>
              <div class="condition-block">
                <span id="condition-label">NOMINAL</span>
                <i id="integrity-bar" class="micro-bar integrity"></i>
                <i id="heat-bar" class="micro-bar heat"></i>
              </div>
            </div>
            <div id="boss-meter" class="boss-meter">
              <span>INTERCEPT <b id="boss-time">29s</b></span><i id="boss-bar" class="micro-bar"></i>
            </div>
            <div id="phase-label" class="phase-label">TEST SHAFT / ARMED</div>
          </header>

          <div id="announcer" class="announcer" role="status"></div>

          <section id="boot-screen" class="screen boot-screen is-active" aria-label="Loading game">
            <div class="boot-mark"><i></i><span>PB</span></div>
            <p>PROJECT 57-B // FILM REEL RECOVERED</p>
            <div class="boot-line"><i></i></div>
          </section>

          <section id="title-screen" class="screen title-screen">
            <div class="title-topline"><span>DECLASSIFIED // TEST 57-B</span><button data-action="mute" class="text-button" type="button">SOUND ON</button></div>
            <div class="cover-motif" aria-hidden="true"><i class="motif-ring ring-a"></i><i class="motif-ring ring-b"></i><i class="motif-disc">57</i><i class="frame-line"></i></div>
            <div class="title-lockup">
              <p class="eyebrow">ONE FRAME. ZERO SURVIVORS.</p>
              <h1><span>PASCAL B</span><strong>COVER FIRE</strong></h1>
              <div class="premise">
                <p>In 1957, a camera captured the Pascal-B steel cap in a single frame.</p>
                <p>History assumed it vanished.</p>
                <p><b>History was wrong.</b></p>
              </div>
              <button id="start-button" class="primary-button">INITIATE TEST <span>→</span></button>
              <div class="title-actions"><button data-action="settings-open" class="text-button">SETTINGS</button></div>
              <details class="history-note">
                <summary>HISTORICAL-FICTION NOTE</summary>
                <p>Inspired by a real 1957 underground test. The cap's actual speed and fate were never directly established. Everything beyond that mystery is arcade science fantasy.</p>
              </details>
            </div>
          </section>

          <section id="hint-screen" class="screen hint-screen">
            <div class="panel control-card">
              <p class="eyebrow">FIELD PROCEDURE // 01</p>
              <h2>CHARGE. RELEASE. STEER THE IMPOSSIBLE.</h2>
              <div class="gesture-diagram" aria-hidden="true"><i class="finger"></i><i class="gesture-line"></i><i class="gesture-disc"></i></div>
              <ol>
                <li><b>DRAG</b><span>Set the launch angle</span></li>
                <li><b>HOLD + RELEASE</b><span>Charge the shaft</span></li>
                <li><b>DRAG IN FLIGHT</b><span>Bend the trajectory</span></li>
              </ol>
              <p class="keyboard-hint">KEYBOARD: A/D OR ←/→ · HOLD SPACE · P TO PAUSE</p>
              <button id="arm-button" class="primary-button">ARM TEST SHAFT <span>→</span></button>
            </div>
          </section>

          <section id="results-screen" class="screen results-screen">
            <div class="results-scroll">
              <p id="results-kicker" class="eyebrow">INTERCEPT CONFIRMED</p>
              <h2 id="results-title">ZERO SURVIVORS</h2>
              <p id="results-reason" class="results-reason"></p>
              <div class="results-grid">
                <div><small>MAX VELOCITY</small><strong id="result-velocity">0.0 km/s</strong></div>
                <div><small>OBJECTS DESTROYED</small><strong id="result-destroyed">0</strong></div>
                <div><small>LARGEST CHAIN</small><strong id="result-combo">x0</strong></div>
                <div><small>WRECKAGE MASS</small><strong id="result-mass">0.0 t</strong></div>
                <div class="result-score"><small>TOTAL SCORE</small><strong id="result-score">0</strong><em id="result-best">BEST 0</em></div>
                <div><small>SCRAP RECOVERED</small><strong id="result-scrap">+0</strong></div>
                <div class="result-wide"><small>MOTHERSHIP</small><strong id="result-mothership">ESCAPED</strong></div>
              </div>
              <div class="upgrade-header"><div><small>FIELD MODIFICATIONS</small><strong id="scrap-balance">0 SCRAP</strong></div><span id="upgrade-message" role="status"></span></div>
              <div id="upgrade-list" class="upgrade-list"></div>
              <button id="replay-button" class="primary-button">RUN ANOTHER TEST <span>R</span></button>
            </div>
          </section>

          <section id="pause-screen" class="screen pause-screen">
            <div class="panel pause-panel">
              <p class="eyebrow">SIMULATION HOLD</p><h2>PAUSED</h2>
              <button id="resume-button" class="primary-button">RESUME <span>P</span></button>
              <button data-action="settings-open" class="secondary-button">SETTINGS</button>
            </div>
          </section>

          <section id="settings-screen" class="screen settings-screen" aria-label="Settings">
            <div class="panel settings-panel">
              <p class="eyebrow">INSTRUMENT CONTROL</p><h2>SETTINGS</h2>
              <label class="volume-control"><span>MASTER VOLUME</span><input data-setting="volume" type="range" min="0" max="100" value="72" /></label>
              <button data-action="mute" class="secondary-button" type="button">SOUND ON</button>
              <p class="comfort-note">Reduced-motion preferences are detected automatically. Gameplay information never relies on sound alone.</p>
              <button id="reset-progress" class="danger-button" type="button">RESET ALL PROGRESS</button>
              <button id="settings-close" class="primary-button" type="button">DONE</button>
            </div>
          </section>

          ${debugEnabled ? `
            <section id="debug-panel" class="debug-panel is-visible" aria-label="Developer debug controls">
              <pre id="debug-readout">DEBUG INITIALIZING</pre>
              <div><button id="debug-orbit">JUMP ORBIT</button><button id="debug-boss">TRIGGER BOSS</button></div>
            </section>` : ''}
        </section>
        <aside class="desktop-placard" aria-hidden="true"><span>PROJECT 57-B</span><b>ORBITAL INCIDENT CONSOLE</b><small>AUTHORIZED PERSONNEL ONLY</small></aside>
      </div>`;
  }
}
