/**
 * Audio Manager using Web Audio API for procedural sounds
 * - Ambient wind/city atmosphere
 * - Footsteps
 * - Collection sound
 * - Background drone
 */
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Ambient oscillators
  private ambientOscillators: OscillatorNode[] = [];
  private ambientLFO: OscillatorNode | null = null;

  // Footstep timing
  private lastFootstepTime = 0;
  private footstepInterval = 0.4; // seconds between footsteps

  // Fragment proximity ping
  private lastPingTime = 0;
  private currentProximity = 0; // 0 = far, 1 = very close

  private isInitialized = false;
  private isMuted = false;

  /**
   * Initialize audio context (must be called after user interaction)
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new AudioContext();

      // Master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.audioContext.destination);

      // Ambient gain
      this.ambientGain = this.audioContext.createGain();
      this.ambientGain.gain.value = 0.3;
      this.ambientGain.connect(this.masterGain);

      // SFX gain
      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.masterGain);

      // Start ambient sounds
      this.startAmbient();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Audio initialization failed:', e);
    }
  }

  private startAmbient(): void {
    if (!this.audioContext || !this.ambientGain) return;

    // Create multiple oscillators for a rich ambient drone
    const frequencies = [55, 82.5, 110, 165]; // A1, E2, A2, E3 (low ambient chord)

    frequencies.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      // Vary volume based on frequency
      gain.gain.value = 0.15 / (i + 1);

      // Add slight detuning for richness
      osc.detune.value = (Math.random() - 0.5) * 10;

      osc.connect(gain);
      gain.connect(this.ambientGain!);
      osc.start();

      this.ambientOscillators.push(osc);
    });

    // Add filtered noise for wind
    this.createWindNoise();

    // LFO for subtle pulsing
    this.ambientLFO = this.audioContext.createOscillator();
    this.ambientLFO.type = 'sine';
    this.ambientLFO.frequency.value = 0.1; // Very slow
    const lfoGain = this.audioContext.createGain();
    lfoGain.gain.value = 0.05;
    this.ambientLFO.connect(lfoGain);
    lfoGain.connect(this.ambientGain.gain);
    this.ambientLFO.start();
  }

  private createWindNoise(): void {
    if (!this.audioContext || !this.ambientGain) return;

    // Create noise buffer
    const bufferSize = this.audioContext.sampleRate * 2;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    // Create noise source
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Filter for wind-like sound
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 1;

    // Gain for noise
    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.value = 0.08;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ambientGain);
    noise.start();

    // Modulate filter for wind gusts
    const gustLFO = this.audioContext.createOscillator();
    gustLFO.type = 'sine';
    gustLFO.frequency.value = 0.05;
    const gustGain = this.audioContext.createGain();
    gustGain.gain.value = 200;
    gustLFO.connect(gustGain);
    gustGain.connect(filter.frequency);
    gustLFO.start();
  }

  /**
   * Play footstep sound
   */
  playFootstep(): void {
    if (!this.audioContext || !this.sfxGain || this.isMuted) return;

    const now = this.audioContext.currentTime;

    // Create a short noise burst for footstep
    const bufferSize = this.audioContext.sampleRate * 0.05; // 50ms
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Envelope: quick attack, quick decay
      const env = Math.exp(-i / (bufferSize * 0.1));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Filter for thud-like sound
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800 + Math.random() * 400;

    // Gain envelope
    const gain = this.audioContext.createGain();
    gain.gain.value = 0.15 + Math.random() * 0.1;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    source.start(now);
    source.stop(now + 0.1);
  }

  /**
   * Play collection/pickup sound
   */
  playCollect(): void {
    if (!this.audioContext || !this.sfxGain || this.isMuted) return;

    const now = this.audioContext.currentTime;

    // Ascending arpeggio
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5

    notes.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      // Stagger timing
      const startTime = now + i * 0.06;
      const duration = 0.3 - i * 0.05;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });

    // Add sparkle with high-frequency noise
    const sparkleBuffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * 0.2,
      this.audioContext.sampleRate
    );
    const sparkleData = sparkleBuffer.getChannelData(0);
    for (let i = 0; i < sparkleData.length; i++) {
      const env = Math.exp(-i / (sparkleData.length * 0.1));
      sparkleData[i] = (Math.random() * 2 - 1) * env * 0.3;
    }

    const sparkle = this.audioContext.createBufferSource();
    sparkle.buffer = sparkleBuffer;

    const sparkleFilter = this.audioContext.createBiquadFilter();
    sparkleFilter.type = 'highpass';
    sparkleFilter.frequency.value = 4000;

    const sparkleGain = this.audioContext.createGain();
    sparkleGain.gain.value = 0.1;

    sparkle.connect(sparkleFilter);
    sparkleFilter.connect(sparkleGain);
    sparkleGain.connect(this.sfxGain);

    sparkle.start(now);
  }

  /**
   * Play proximity ping sound (beep that increases in frequency as player gets closer)
   */
  private playProximityPing(): void {
    if (!this.audioContext || !this.sfxGain || this.isMuted) return;

    const now = this.audioContext.currentTime;

    // Higher pitch and volume as proximity increases
    const baseFreq = 600 + this.currentProximity * 800; // 600-1400 Hz
    const volume = 0.05 + this.currentProximity * 0.15; // 0.05-0.2

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.value = baseFreq;

    // Quick attack, decay
    const duration = 0.08;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Update proximity (0-1) for fragment detection sound
   * Call this with the distance to the nearest uncollected fragment
   */
  setFragmentProximity(distance: number, maxDistance: number = 60): void {
    // Only activate within maxDistance units
    if (distance > maxDistance) {
      this.currentProximity = 0;
    } else {
      // Inverse relationship: closer = higher proximity (0-1)
      this.currentProximity = 1 - (distance / maxDistance);
    }
  }

  /**
   * Update footsteps based on player movement
   */
  update(delta: number, isMoving: boolean, isSprinting: boolean): void {
    if (!this.isInitialized || this.isMuted) return;

    // Adjust footstep interval based on sprinting
    this.footstepInterval = isSprinting ? 0.25 : 0.4;

    if (isMoving) {
      this.lastFootstepTime += delta;
      if (this.lastFootstepTime >= this.footstepInterval) {
        this.playFootstep();
        this.lastFootstepTime = 0;
      }
    } else {
      this.lastFootstepTime = this.footstepInterval; // Ready for immediate footstep when moving starts
    }

    // Fragment proximity ping (only if proximity > 0)
    if (this.currentProximity > 0) {
      // Ping interval decreases as proximity increases (faster beeping when closer)
      // Range: 1.5s (far) to 0.2s (very close)
      const pingInterval = 1.5 - this.currentProximity * 1.3;

      this.lastPingTime += delta;
      if (this.lastPingTime >= pingInterval) {
        this.playProximityPing();
        this.lastPingTime = 0;
      }
    } else {
      this.lastPingTime = 0;
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 0.5;
    }
    return this.isMuted;
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume)) * (this.isMuted ? 0 : 1);
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.ambientOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    });

    if (this.ambientLFO) {
      try {
        this.ambientLFO.stop();
      } catch (e) {
        // Ignore
      }
    }

    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
