class SoundFxEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined' || this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    this.getContext();
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType,
    volume: number,
    delaySec = 0
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  /**
   * Plays countdown tick.
   * For <= 10 seconds (urgent), plays a snappy double "Beep Beep" effect.
   */
  playCountdownTick(remainingSec: number): void {
    if (remainingSec <= 0) return;
    if (remainingSec <= 10) {
      // Exciting "Beep Beep" double pulse as time runs low (10s -> 1s)
      const pitchBoost = (11 - remainingSec) * 28;
      this.playTone(880 + pitchBoost, 0.085, 'square', 0.08, 0);
      this.playTone(1140 + pitchBoost, 0.095, 'square', 0.09, 0.11);
    } else {
      // Subtle studio clock tick above 10s
      this.playTone(540, 0.055, 'triangle', 0.05, 0);
    }
  }

  playTimeUp(): void {
    this.playTone(392, 0.15, 'sawtooth', 0.08, 0);
    this.playTone(293.66, 0.28, 'sawtooth', 0.09, 0.14);
  }

  playAnswerLock(): void {
    this.playTone(660, 0.08, 'sine', 0.1, 0);
    this.playTone(880, 0.11, 'sine', 0.1, 0.07);
  }

  playReveal(isCorrect?: boolean): void {
    if (isCorrect === false) {
      this.playTone(310, 0.14, 'triangle', 0.1, 0);
      this.playTone(240, 0.22, 'triangle', 0.1, 0.12);
      return;
    }
    this.playTone(523.25, 0.11, 'triangle', 0.11, 0);
    this.playTone(659.25, 0.11, 'triangle', 0.11, 0.09);
    this.playTone(783.99, 0.18, 'triangle', 0.12, 0.18);
  }

  playPodiumFanfare(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, idx === notes.length - 1 ? 0.38 : 0.13, 'triangle', 0.11, idx * 0.1);
    });
  }
}

export const soundFx = new SoundFxEngine();
