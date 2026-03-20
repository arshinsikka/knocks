import { useState, useEffect } from 'react';

// ── Module-level listener registry for React mute-state sync ──────────────────
let muteListeners: Array<(muted: boolean) => void> = [];

// ── SoundManager ──────────────────────────────────────────────────────────────
class SoundManager {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastPlayed: Record<string, number> = {};

  // Minimum ms between successive plays of the same sound (dedup guard)
  private readonly minInterval: Record<string, number> = {
    click:        100,
    deal:          80,
    yourTurn:    2000,
    showdown:    2000,
    knock:        800,
    challenge:    800,
    gameOverWin: 8000,
    gameOverLose: 8000,
    timerTick:    900,
  };

  // ── Audio context ────────────────────────────────────────────────────────────

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  // ── Mute ─────────────────────────────────────────────────────────────────────

  isMuted(): boolean { return this.muted; }

  toggleMute(): boolean {
    this.muted = !this.muted;
    muteListeners.forEach((fn) => fn(this.muted));
    return this.muted;
  }

  // ── Dedup guard — returns ctx if allowed to play, null otherwise ──────────────

  private allow(id: string): AudioContext | null {
    if (this.muted) return null;
    const ctx = this.getCtx();
    if (!ctx) return null;
    const now = Date.now();
    if (now - (this.lastPlayed[id] ?? 0) < (this.minInterval[id] ?? 200)) return null;
    this.lastPlayed[id] = now;
    return ctx;
  }

  // ── Haptics ───────────────────────────────────────────────────────────────────

  vibrate(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  }

  // ── Sounds ────────────────────────────────────────────────────────────────────

  /** Soft noise whoosh when a card slides in. pitchMod varies the texture. */
  deal(pitchMod = 1.0) {
    const ctx = this.allow('deal');
    if (!ctx) return;
    const dur = 0.13;
    const n   = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 1100 * pitchMod;
    bpf.Q.value = 0.8;

    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination);
    src.start(t);
  }

  /** Short crisp sine tap for button presses. */
  click() {
    const ctx = this.allow('click');
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.045);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.045);
  }

  /** Two-note ascending ping when it becomes your turn. */
  yourTurn() {
    const ctx = this.allow('yourTurn');
    if (!ctx) return;
    const t = ctx.currentTime;

    ([[880, 1100], [1100, 1320]] as [number, number][]).forEach(([f0, f1], i) => {
      const dt = i * 0.1;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, t + dt);
      osc.frequency.linearRampToValueAtTime(f1, t + dt + 0.1);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + dt);
      gain.gain.linearRampToValueAtTime(0.06, t + dt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.2);

      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + dt); osc.stop(t + dt + 0.2);
    });
  }

  /** Noise sweep + accent tone for the showdown reveal. */
  showdown() {
    const ctx = this.allow('showdown');
    if (!ctx) return;
    const t   = ctx.currentTime;
    const dur = 0.55;

    // Filtered noise sweep
    const n   = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(3500, t);
    lpf.frequency.exponentialRampToValueAtTime(450, t + dur);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.065, t + 0.06);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(lpf); lpf.connect(noiseGain); noiseGain.connect(ctx.destination);
    src.start(t);

    // Accent sine tone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.38);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, t);
    oscGain.gain.linearRampToValueAtTime(0.045, t + 0.04);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(oscGain); oscGain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.38);
  }

  /** Double knock on wood — deep bandpass noise burst. */
  knock() {
    const ctx = this.allow('knock');
    if (!ctx) return;
    const t   = ctx.currentTime;
    const dur = 0.26;

    const n   = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 155;
    bpf.Q.value = 4.5;

    const playHit = (when: number, vol: number) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
      src.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination);
      src.start(when);
    };

    playHit(t,        0.55);
    playHit(t + 0.18, 0.40);
  }

  /** Brief descending two-note tension when a challenge opens. */
  challenge() {
    const ctx = this.allow('challenge');
    if (!ctx) return;
    const t = ctx.currentTime;

    ([480, 420] as number[]).forEach((freq, i) => {
      const dt = i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + dt);
      gain.gain.linearRampToValueAtTime(0.042, t + dt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.13);

      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + dt); osc.stop(t + dt + 0.13);
    });
  }

  /** Ascending C–E–G–C major arpeggio for the winner. */
  gameOverWin() {
    const ctx = this.allow('gameOverWin');
    if (!ctx) return;
    const t     = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6

    notes.forEach((freq, i) => {
      const s = t + i * 0.14;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(0.07, s + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, s + 0.3);

      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(s); osc.stop(s + 0.3);
    });
  }

  /** Subdued C→A descending tones for non-winners. */
  gameOverLose() {
    const ctx = this.allow('gameOverLose');
    if (!ctx) return;
    const t     = ctx.currentTime;
    const notes = [523.25, 440]; // C5 → A4

    notes.forEach((freq, i) => {
      const s = t + i * 0.22;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(0.05, s + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, s + 0.34);

      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(s); osc.stop(s + 0.34);
    });
  }

  /** Soft tick that rises in pitch and volume as countdown → 0. */
  timerTick(countdown: number) {
    const ctx = this.allow('timerTick');
    if (!ctx) return;
    const t       = ctx.currentTime;
    const urgency = Math.max(0, Math.min(1, (5 - countdown) / 4));

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 700 + urgency * 300;

    const gain = ctx.createGain();
    const vol  = 0.022 + urgency * 0.055;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.05);
  }
}

// ── Singleton export ───────────────────────────────────────────────────────────
export const sounds = new SoundManager();

// ── React hook for mute state ─────────────────────────────────────────────────
export function useMute(): { muted: boolean; toggleMute: () => void } {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const handler = (m: boolean) => setMuted(m);
    muteListeners.push(handler);
    return () => {
      muteListeners = muteListeners.filter((fn) => fn !== handler);
    };
  }, []);

  return { muted, toggleMute: () => sounds.toggleMute() };
}
