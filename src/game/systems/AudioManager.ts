import { clamp } from '../math';

type AudioContextConstructor = typeof AudioContext;

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private chargeOscillator: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
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

  public startCharge(): void {
    if (!this.context || !this.master || this.chargeOscillator) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(45, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.08);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    this.chargeOscillator = oscillator;
    this.chargeGain = gain;
  }

  public updateCharge(amount: number): void {
    if (!this.context || !this.chargeOscillator || !this.chargeGain) return;
    const now = this.context.currentTime;
    this.chargeOscillator.frequency.setTargetAtTime(48 + amount * 165, now, 0.035);
    this.chargeGain.gain.setTargetAtTime(0.035 + amount * 0.095, now, 0.04);
  }

  public stopCharge(launch: boolean): void {
    if (!this.context || !this.chargeOscillator || !this.chargeGain) return;
    const now = this.context.currentTime;
    this.chargeGain.gain.cancelScheduledValues(now);
    this.chargeGain.gain.setValueAtTime(Math.max(0.0001, this.chargeGain.gain.value), now);
    this.chargeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    this.chargeOscillator.stop(now + 0.07);
    this.chargeOscillator = null;
    this.chargeGain = null;
    if (launch) {
      this.noiseBurst(0.38, 0.34, 130);
      this.tone(52, 0.42, 'square', 0.24, 32);
    }
  }

  public impact(tier: 1 | 2 | 3): void {
    const frequency = tier === 3 ? 62 : tier === 2 ? 105 : 210;
    const duration = tier === 3 ? 0.32 : tier === 2 ? 0.18 : 0.09;
    const gain = tier === 3 ? 0.22 : tier === 2 ? 0.14 : 0.07;
    this.tone(frequency, duration, tier === 1 ? 'triangle' : 'square', gain, frequency * 0.55);
    if (tier > 1) this.noiseBurst(duration * 0.75, gain * 0.75, tier === 3 ? 90 : 260);
  }

  public warning(): void {
    this.tone(740, 0.12, 'square', 0.06, 520);
  }

  public bossEntrance(): void {
    this.tone(46, 0.85, 'sawtooth', 0.2, 78);
    window.setTimeout(() => this.tone(92, 0.5, 'square', 0.12, 46), 180);
  }

  public victory(): void {
    [196, 247, 294, 392].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.42, 'triangle', 0.1, frequency * 1.04), index * 110);
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
  ): void {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
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
  }

  private noiseBurst(duration: number, gainAmount: number, lowpass: number): void {
    if (!this.context || !this.master || this.muted) return;
    const sampleCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const envelope = 1 - index / data.length;
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    gain.gain.value = gainAmount;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }
}
