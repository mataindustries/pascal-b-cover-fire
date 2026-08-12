import { clamp } from '../math';

type AudioContextConstructor = typeof AudioContext;
type AudioFamily = 'general' | 'impact' | 'chain' | 'mine' | 'burst';

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private chargeOscillator: OscillatorNode | null = null;
  private chargeRumble: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private ascentOscillator: OscillatorNode | null = null;
  private ascentGain: GainNode | null = null;
  private overdriveOscillator: OscillatorNode | null = null;
  private overdriveGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly activeVoices: Record<AudioFamily, number> = {
    general: 0,
    impact: 0,
    chain: 0,
    mine: 0,
    burst: 0,
  };
  private lastChainTickTime = -1;
  private muted: boolean;
  private volume: number;

  public constructor(volume: number, muted: boolean) {
    this.volume = clamp(volume, 0, 1);
    this.muted = muted;
  }

  public async unlock(): Promise<void> {
    if (!this.context) {
      const Context = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
      if (!Context) return;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.applyVolume();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  public setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
    this.applyVolume();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  public destroy(): void {
    this.stopCharge(false);
    this.stopAscent();
    if (this.context && this.overdriveGain && this.overdriveOscillator) {
      const now = this.context.currentTime;
      this.overdriveGain.gain.setTargetAtTime(0.0001, now, 0.01);
      this.overdriveOscillator.stop(now + 0.04);
    }
    this.overdriveOscillator = null;
    this.overdriveGain = null;
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
    for (const family of Object.keys(this.activeVoices) as AudioFamily[]) this.activeVoices[family] = 0;
    this.lastChainTickTime = -1;
  }

  public startCharge(): void {
    if (!this.context || !this.master || this.chargeOscillator) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const rumble = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    rumble.type = 'square';
    oscillator.frequency.setValueAtTime(45, now);
    rumble.frequency.setValueAtTime(25, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.08);
    oscillator.connect(gain);
    rumble.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    rumble.start(now);
    this.chargeOscillator = oscillator;
    this.chargeRumble = rumble;
    this.chargeGain = gain;
  }

  public updateCharge(amount: number): void {
    if (!this.context || !this.chargeOscillator || !this.chargeGain) return;
    const now = this.context.currentTime;
    this.chargeOscillator.frequency.setTargetAtTime(48 + amount * 165, now, 0.035);
    this.chargeRumble?.frequency.setTargetAtTime(25 + amount * 42, now, 0.055);
    this.chargeGain.gain.setTargetAtTime(0.035 + amount * 0.095, now, 0.04);
  }

  public chargeAuthorization(stage: number): void {
    const frequency = stage >= 3 ? 960 : 520 + stage * 105;
    this.tone(frequency, stage >= 3 ? 0.12 : 0.065, 'square', 0.045 + stage * 0.008, frequency * 0.86);
  }

  public stopCharge(launch: boolean): void {
    if (!this.context || !this.chargeOscillator || !this.chargeGain) return;
    const now = this.context.currentTime;
    this.chargeGain.gain.cancelScheduledValues(now);
    this.chargeGain.gain.setValueAtTime(Math.max(0.0001, this.chargeGain.gain.value), now);
    this.chargeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    this.chargeOscillator.stop(now + 0.07);
    this.chargeRumble?.stop(now + 0.07);
    this.chargeOscillator = null;
    this.chargeRumble = null;
    this.chargeGain = null;
    if (launch) {
      this.noiseBurst(0.48, 0.34, 150);
      this.noiseBurst(0.18, 0.16, 1_800, 0.018);
      this.tone(52, 0.52, 'square', 0.24, 29);
      this.tone(96, 0.31, 'sawtooth', 0.12, 42, 0.025);
    }
  }

  public startAscent(): void {
    if (!this.context || !this.master || this.ascentOscillator) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(72, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.026, now + 0.16);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    this.ascentOscillator = oscillator;
    this.ascentGain = gain;
  }

  public updateAscent(progress: number, speedRatio: number, steering: number): void {
    if (!this.context || !this.ascentOscillator || !this.ascentGain) return;
    const now = this.context.currentTime;
    const intensity = clamp(speedRatio, 0, 1);
    this.ascentOscillator.frequency.setTargetAtTime(72 + progress * 92 + intensity * 58, now, 0.08);
    this.ascentGain.gain.setTargetAtTime(0.022 + intensity * 0.044 + Math.abs(steering) * 0.008, now, 0.08);
  }

  public stopAscent(): void {
    if (!this.context || !this.ascentOscillator || !this.ascentGain) return;
    const now = this.context.currentTime;
    this.ascentGain.gain.cancelScheduledValues(now);
    this.ascentGain.gain.setValueAtTime(Math.max(0.0001, this.ascentGain.gain.value), now);
    this.ascentGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    this.ascentOscillator.stop(now + 0.17);
    this.ascentOscillator = null;
    this.ascentGain = null;
  }

  public impact(tier: 1 | 2 | 3): void {
    const frequency = tier === 3 ? 62 : tier === 2 ? 105 : 210;
    const duration = tier === 3 ? 0.32 : tier === 2 ? 0.18 : 0.09;
    const gain = tier === 3 ? 0.22 : tier === 2 ? 0.14 : 0.07;
    this.tone(frequency, duration, tier === 1 ? 'triangle' : 'square', gain, frequency * 0.55, 0, 'impact');
    if (tier > 1) {
      this.noiseBurst(duration * 0.75, gain * 0.75, tier === 3 ? 90 : 260, 0, 'impact');
      this.tone(frequency * 2.25, duration * 0.55, 'triangle', gain * 0.38, frequency * 0.8, 0.008, 'impact');
    }
  }

  public chainTick(combo: number, volatile: boolean): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (this.lastChainTickTime >= 0 && now - this.lastChainTickTime < 0.024) return;
    this.lastChainTickTime = now;
    const step = Math.min(18, Math.max(0, combo - 1));
    const frequency = 220 * 2 ** (step / 12);
    this.tone(frequency, volatile ? 0.11 : 0.065, 'triangle', volatile ? 0.055 : 0.032, frequency * 1.16, 0, 'chain');
  }

  public chainMilestone(combo: number): void {
    const root = combo >= 50 ? 110 : combo >= 30 ? 138 : combo >= 15 ? 165 : 196;
    [1, 1.5, 2].forEach((ratio, index) => {
      this.tone(root * ratio, 0.2, index === 0 ? 'square' : 'triangle', 0.055, root * ratio * 1.08, index * 0.045, 'chain');
    });
  }

  public minePrime(): void {
    this.tone(310, 0.14, 'square', 0.038, 620, 0, 'mine');
  }

  public mineDetonate(): void {
    this.tone(72, 0.3, 'square', 0.12, 38, 0, 'mine');
    this.noiseBurst(0.22, 0.09, 180, 0, 'mine');
  }

  public capture(tier: number): void {
    const frequency = 460 + Math.min(4, tier) * 58;
    this.tone(frequency, 0.085, 'triangle', 0.032, frequency * 1.42, 0, 'chain');
  }

  public coreBurst(): void {
    this.tone(48, 0.62, 'sawtooth', 0.22, 24, 0, 'burst');
    this.tone(820, 0.18, 'square', 0.08, 190, 0.015, 'burst');
    this.noiseBurst(0.58, 0.2, 1_100, 0.02, 'burst');
    [220, 330, 495].forEach((frequency, index) => {
      this.tone(frequency, 0.32, 'triangle', 0.055, frequency * 1.35, 0.11 + index * 0.045, 'burst');
    });
  }

  public updateOverdrive(value: number, high: boolean): void {
    if (!this.context || !this.master) return;
    if (!this.overdriveOscillator || !this.overdriveGain) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = 46;
      gain.gain.value = 0.0001;
      oscillator.connect(gain).connect(this.master);
      oscillator.start();
      this.overdriveOscillator = oscillator;
      this.overdriveGain = gain;
    }
    const now = this.context.currentTime;
    this.overdriveOscillator.frequency.setTargetAtTime(46 + value * (high ? 92 : 54), now, 0.08);
    this.overdriveGain.gain.setTargetAtTime(value > 0.08 ? 0.004 + value * (high ? 0.025 : 0.014) : 0.0001, now, 0.1);
  }

  public haloThreshold(tier: number): void {
    const root = 150 + tier * 32;
    this.tone(root, 0.28, 'triangle', 0.075, root * 1.5);
    this.tone(root * 1.5, 0.32, 'sine', 0.055, root * 2, 0.075);
  }

  public warning(): void {
    this.tone(740, 0.12, 'square', 0.06, 520);
  }

  public bossEntrance(): void {
    this.tone(46, 0.85, 'sawtooth', 0.2, 78);
    this.tone(92, 0.5, 'square', 0.12, 46, 0.18);
    this.tone(620, 0.11, 'square', 0.065, 410, 0.08);
    this.tone(620, 0.11, 'square', 0.065, 410, 0.34);
  }

  public bossDamage(remainingRatio: number): void {
    const frequency = 360 + (1 - clamp(remainingRatio, 0, 1)) * 340;
    this.tone(frequency, 0.12, 'square', 0.055, frequency * 0.62);
  }

  public bossDestroyed(): void {
    this.noiseBurst(0.72, 0.32, 180);
    this.noiseBurst(0.26, 0.15, 2_400, 0.035);
    this.tone(44, 0.9, 'sawtooth', 0.24, 24);
    [147, 196, 247, 330].forEach((frequency, index) => {
      this.tone(frequency, 0.54, 'triangle', 0.085, frequency * 1.06, 0.18 + index * 0.095);
    });
  }

  public resultsTally(victory: boolean): void {
    const notes = victory ? [330, 392, 494] : [294, 247, 196];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.13, 'square', 0.038, frequency * 1.08, 0.16 + index * 0.105);
    });
  }

  public ui(): void {
    this.tone(420, 0.055, 'square', 0.035, 560);
  }

  private applyVolume(): void {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.55, this.context.currentTime, 0.015);
  }

  private tone(
    startFrequency: number,
    duration: number,
    type: OscillatorType,
    gainAmount: number,
    endFrequency: number,
    delay = 0,
    family: AudioFamily = 'general',
  ): void {
    if (!this.context || !this.master || this.muted) return;
    if (!this.claimVoice(family)) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainAmount, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    oscillator.addEventListener('ended', () => this.releaseVoice(family), { once: true });
  }

  private noiseBurst(
    duration: number,
    gainAmount: number,
    lowpass: number,
    delay = 0,
    family: AudioFamily = 'general',
  ): void {
    if (!this.context || !this.master || this.muted) return;
    if (!this.claimVoice(family)) return;
    const buffer = this.ensureNoiseBuffer();
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const startTime = this.context.currentTime + delay;
    gain.gain.setValueAtTime(Math.max(0.0001, gainAmount), startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.min(duration, buffer.duration));
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.master);
    source.start(startTime, 0, Math.min(duration, buffer.duration));
    source.addEventListener('ended', () => this.releaseVoice(family), { once: true });
  }

  private ensureNoiseBuffer(): AudioBuffer {
    if (!this.context) throw new Error('Audio context is unavailable.');
    if (this.noiseBuffer) return this.noiseBuffer;
    const sampleCount = Math.max(1, Math.floor(this.context.sampleRate * 0.9));
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private claimVoice(family: AudioFamily): boolean {
    if (this.activeVoices[family] >= 8) return false;
    this.activeVoices[family] += 1;
    return true;
  }

  private releaseVoice(family: AudioFamily): void {
    this.activeVoices[family] = Math.max(0, this.activeVoices[family] - 1);
  }
}
