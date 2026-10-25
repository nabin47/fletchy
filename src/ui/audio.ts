/* All sound is synthesized with WebAudio oscillators: no audio files, no licensing. */

type Wave = OscillatorType;

export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock(): void {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, type: Wave, gain: number, delay = 0, slideTo?: number): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Pitch climbs a semitone per combo step, capped at two octaves. */
  clear(combo: number): void {
    const f = 440 * Math.pow(2, Math.min(24, combo - 1) / 12);
    this.tone(f, 0.12, 'triangle', 0.18, 0, f * 1.5);
  }

  bump(): void {
    this.tone(140, 0.18, 'square', 0.08, 0, 70);
  }

  spawn(): void {
    this.tone(880, 0.05, 'sine', 0.04);
  }

  heart(): void {
    this.tone(660, 0.1, 'sine', 0.12);
    this.tone(990, 0.14, 'sine', 0.12, 0.08);
  }

  boardClear(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.14, i * 0.07));
  }

  gameOver(): void {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.25, 'sawtooth', 0.06, i * 0.14));
  }

  win(): void {
    [523, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, i * 0.09));
  }
}
