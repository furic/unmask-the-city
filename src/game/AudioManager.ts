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

  // Night sounds
  private nightAmount = 0; // 0 = day, 1 = night
  private cricketTimer = 0;
  private owlTimer = 0;
  private nextOwlTime = 15; // Owls hoot every 15-30 seconds

  // Water ambience
  private waterAmbienceGain: GainNode | null = null;
  private waterAmbienceSource: AudioBufferSourceNode | null = null;
  private waterProximity = 0; // 0 = far, 1 = very close

  // Echo/reverb for urban canyons
  private reverbGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;
  private buildingProximity = 0; // 0 = open, 1 = surrounded by buildings

  // Wind noise (louder in open areas)
  private windGain: GainNode | null = null;
  private windFilterFreq: AudioParam | null = null;

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

      // Echo/reverb for urban canyons
      this.setupEchoEffect();

      // Start ambient sounds
      this.startAmbient();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Audio initialization failed:', e);
    }
  }

  private setupEchoEffect(): void {
    if (!this.audioContext || !this.sfxGain || !this.masterGain) return;

    // Create delay node for echo effect
    this.delayNode = this.audioContext.createDelay(1.0);
    this.delayNode.delayTime.value = 0.15; // 150ms delay

    // Feedback gain (controls echo decay)
    this.feedbackGain = this.audioContext.createGain();
    this.feedbackGain.gain.value = 0.0; // Start with no echo

    // Reverb wet/dry mix
    this.reverbGain = this.audioContext.createGain();
    this.reverbGain.gain.value = 0.0; // Start with no reverb

    // Connect the echo feedback loop
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);

    // Connect delay output to reverb gain
    this.delayNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);
  }

  /**
   * Update echo effect based on building proximity
   * @param proximity 0 = open area, 1 = surrounded by tall buildings
   */
  setBuildingProximity(proximity: number): void {
    this.buildingProximity = Math.max(0, Math.min(1, proximity));

    if (this.feedbackGain && this.reverbGain && this.delayNode) {
      // Increase echo feedback and wet mix when near buildings
      this.feedbackGain.gain.value = this.buildingProximity * 0.4;
      this.reverbGain.gain.value = this.buildingProximity * 0.3;

      // Vary delay time based on proximity (tighter spaces = shorter delay)
      this.delayNode.delayTime.value = 0.1 + (1 - this.buildingProximity) * 0.1;
    }

    // Distance-based wind: louder in open areas, quieter between buildings
    if (this.windGain) {
      // Base wind volume 0.04, up to 0.15 in open areas
      const openness = 1 - this.buildingProximity;
      this.windGain.gain.value = 0.04 + openness * 0.11;
    }

    // Vary wind filter - higher frequencies in open areas (more whistling)
    if (this.windFilterFreq) {
      const openness = 1 - this.buildingProximity;
      this.windFilterFreq.value = 300 + openness * 400; // 300-700 Hz
    }
  }

  /**
   * Connect a sound source to the echo effect
   */
  connectToEcho(source: AudioNode): void {
    if (this.delayNode) {
      source.connect(this.delayNode);
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

    // Create water ambience (starts silent, controlled by proximity)
    this.createWaterAmbience();

    // Create distant traffic rumble
    this.createTrafficAmbience();

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
    this.windFilterFreq = filter.frequency; // Store for dynamic adjustment

    // Gain for noise (store reference for distance-based wind)
    this.windGain = this.audioContext.createGain();
    this.windGain.gain.value = 0.08;

    noise.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.ambientGain);
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

  private createWaterAmbience(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Water ambience gain (starts at 0, controlled by proximity)
    this.waterAmbienceGain = this.audioContext.createGain();
    this.waterAmbienceGain.gain.value = 0;
    this.waterAmbienceGain.connect(this.masterGain);

    // Create water sound using filtered noise with modulation
    const bufferSize = this.audioContext.sampleRate * 4; // 4 seconds, looped
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Generate water-like noise with some variation
    for (let i = 0; i < bufferSize; i++) {
      const t = i / this.audioContext.sampleRate;
      // Base noise with some low-frequency modulation
      const mod = Math.sin(t * 0.5) * 0.3 + Math.sin(t * 1.3) * 0.2;
      output[i] = (Math.random() * 2 - 1) * (0.7 + mod * 0.3);
    }

    // Create and connect the noise source
    this.waterAmbienceSource = this.audioContext.createBufferSource();
    this.waterAmbienceSource.buffer = noiseBuffer;
    this.waterAmbienceSource.loop = true;

    // Bandpass filter for water-like frequencies
    const bandpass = this.audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 800;
    bandpass.Q.value = 0.8;

    // Low pass for removing harsh high frequencies
    const lowpass = this.audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2000;

    // Modulate the filter frequency for lapping water effect
    const filterLFO = this.audioContext.createOscillator();
    filterLFO.type = 'sine';
    filterLFO.frequency.value = 0.2;
    const filterLFOGain = this.audioContext.createGain();
    filterLFOGain.gain.value = 300;
    filterLFO.connect(filterLFOGain);
    filterLFOGain.connect(bandpass.frequency);
    filterLFO.start();

    // Connect the chain
    this.waterAmbienceSource.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(this.waterAmbienceGain);
    this.waterAmbienceSource.start();
  }

  /**
   * Set water proximity for ambience volume
   * @param distance Distance to nearest water body
   * @param maxDistance Maximum distance at which water is audible (default 50)
   */
  setWaterProximity(distance: number, maxDistance: number = 50): void {
    if (distance > maxDistance) {
      this.waterProximity = 0;
    } else {
      // Inverse relationship: closer = louder (0-1)
      this.waterProximity = 1 - (distance / maxDistance);
      // Apply ease-in curve for more natural falloff
      this.waterProximity = this.waterProximity * this.waterProximity;
    }

    // Update water ambience gain
    if (this.waterAmbienceGain) {
      // Volume ranges from 0 to 0.15 based on proximity
      this.waterAmbienceGain.gain.setTargetAtTime(
        this.waterProximity * 0.15,
        this.audioContext?.currentTime || 0,
        0.3 // Smooth transition
      );
    }
  }

  /**
   * Play footstep sound based on surface type
   */
  playFootstep(surfaceType: 'grass' | 'concrete' | 'water' = 'concrete'): void {
    if (!this.audioContext || !this.sfxGain || this.isMuted) return;

    const now = this.audioContext.currentTime;

    // Surface-specific parameters
    let filterFreq: number;
    let filterQ: number;
    let volume: number;
    let duration: number;
    let noiseType: 'dense' | 'sparse' | 'crunch';

    switch (surfaceType) {
      case 'grass':
        // Soft, muffled footsteps on grass
        filterFreq = 400 + Math.random() * 200;
        filterQ = 0.5;
        volume = 0.08 + Math.random() * 0.05;
        duration = 0.06;
        noiseType = 'sparse';
        break;
      case 'water':
        // Splashy footsteps in water
        filterFreq = 1500 + Math.random() * 500;
        filterQ = 2;
        volume = 0.2 + Math.random() * 0.1;
        duration = 0.12;
        noiseType = 'dense';
        break;
      case 'concrete':
      default:
        // Hard, crisp footsteps on concrete
        filterFreq = 800 + Math.random() * 400;
        filterQ = 1;
        volume = 0.15 + Math.random() * 0.1;
        duration = 0.05;
        noiseType = 'crunch';
        break;
    }

    const bufferSize = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Envelope: quick attack, decay varies by surface
      const decayRate = surfaceType === 'water' ? 0.05 : 0.1;
      const env = Math.exp(-i / (bufferSize * decayRate));

      // Different noise characteristics per surface
      let noise: number;
      switch (noiseType) {
        case 'sparse':
          // Softer, less dense noise for grass
          noise = (Math.random() < 0.7) ? (Math.random() * 2 - 1) * 0.5 : 0;
          break;
        case 'dense':
          // Denser noise with some low frequency for water splash
          noise = (Math.random() * 2 - 1) + Math.sin(i * 0.1) * 0.3;
          break;
        case 'crunch':
        default:
          // Standard noise for concrete
          noise = Math.random() * 2 - 1;
          break;
      }

      data[i] = noise * env;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Apply surface-specific filter
    const filter = this.audioContext.createBiquadFilter();
    filter.type = surfaceType === 'water' ? 'bandpass' : 'lowpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    // Gain
    const gain = this.audioContext.createGain();
    gain.gain.value = volume;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    // Connect to echo for concrete surfaces (urban canyon effect)
    if (surfaceType === 'concrete' && this.buildingProximity > 0.3) {
      this.connectToEcho(gain);
    }

    source.start(now);
    source.stop(now + duration * 2);

    // For water, add a secondary splash sound
    if (surfaceType === 'water') {
      this.playSplashDetail(now);
    }
  }

  /**
   * Additional splash detail for water footsteps
   */
  private playSplashDetail(startTime: number): void {
    if (!this.audioContext || !this.sfxGain) return;

    const duration = 0.08;
    const bufferSize = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // High frequency sparkle
      const env = Math.exp(-i / (bufferSize * 0.03));
      data[i] = (Math.random() * 2 - 1) * env * 0.5;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0.08;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    source.start(startTime + 0.02);
  }

  private createTrafficAmbience(): void {
    if (!this.audioContext || !this.ambientGain) return;

    // Create low-frequency rumble for distant traffic
    const bufferSize = this.audioContext.sampleRate * 4; // 4 second loop
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate rumble noise with low-frequency modulation
    for (let i = 0; i < bufferSize; i++) {
      const t = i / this.audioContext.sampleRate;
      // Multiple low frequencies mixed
      const rumble1 = Math.sin(t * 20) * 0.3;
      const rumble2 = Math.sin(t * 35 + 0.5) * 0.2;
      const rumble3 = Math.sin(t * 12) * 0.15;
      // Add some noise
      const noise = (Math.random() * 2 - 1) * 0.1;
      // Slow volume modulation (like traffic waves)
      const mod = 0.7 + Math.sin(t * 0.3) * 0.3;

      data[i] = (rumble1 + rumble2 + rumble3 + noise) * mod;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Very low pass filter for distant rumble
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    filter.Q.value = 0.5;

    // Quiet volume
    const gain = this.audioContext.createGain();
    gain.gain.value = 0.04;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    source.start();
  }

  /**
   * Play collection/pickup sound based on fragment type
   * @param fragmentType 'common' | 'rare' | 'hidden'
   */
  playCollect(fragmentType: 'common' | 'rare' | 'hidden' = 'common'): void {
    if (!this.audioContext || !this.sfxGain || this.isMuted) return;

    const now = this.audioContext.currentTime;

    // Different musical patterns for each fragment type
    let notes: number[];
    let oscType: OscillatorType;
    let volume: number;
    let timing: number;

    switch (fragmentType) {
      case 'rare':
        // Gold/rare: triumphant major chord with higher pitch
        notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        oscType = 'triangle';
        volume = 0.25;
        timing = 0.08;
        break;
      case 'hidden':
        // Purple/hidden: mysterious diminished chord
        notes = [311.13, 369.99, 440, 523.25]; // Eb4, F#4, A4, C5
        oscType = 'sine';
        volume = 0.18;
        timing = 0.1;
        break;
      case 'common':
      default:
        // Green/common: standard ascending arpeggio
        notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
        oscType = 'sine';
        volume = 0.2;
        timing = 0.06;
        break;
    }

    notes.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = oscType;
      osc.frequency.value = freq;

      // Stagger timing
      const startTime = now + i * timing;
      const duration = fragmentType === 'rare' ? 0.4 : (0.3 - i * 0.05);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });

    // Add sparkle with high-frequency noise (more sparkle for rare)
    const sparkleBuffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * (fragmentType === 'rare' ? 0.3 : 0.2),
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
    sparkleFilter.frequency.value = fragmentType === 'hidden' ? 3000 : 4000;

    const sparkleGain = this.audioContext.createGain();
    sparkleGain.gain.value = fragmentType === 'rare' ? 0.15 : 0.1;

    sparkle.connect(sparkleFilter);
    sparkleFilter.connect(sparkleGain);
    sparkleGain.connect(this.sfxGain);

    sparkle.start(now);
  }

  /**
   * Play thunder sound for lightning
   */
  playThunder(): void {
    if (!this.audioContext || !this.sfxGain || this.isMuted) return;

    const now = this.audioContext.currentTime;

    // Create thunder using filtered noise with rumble
    const duration = 1.5 + Math.random();
    const buffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * duration,
      this.audioContext.sampleRate
    );
    const data = buffer.getChannelData(0);

    // Create rumbling thunder sound
    for (let i = 0; i < data.length; i++) {
      const t = i / this.audioContext.sampleRate;
      // Multiple layered noise with envelope
      const env = Math.exp(-t * 1.5) * (1 - Math.exp(-t * 20));
      const rumble = Math.sin(t * 30 + Math.random() * 0.5) * 0.5;
      const crack = Math.random() * 2 - 1;
      data[i] = (rumble + crack * 0.5) * env;
    }

    const thunder = this.audioContext.createBufferSource();
    thunder.buffer = buffer;

    // Low pass filter for rumble
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200 + Math.random() * 100;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0.4;

    thunder.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    // Delay thunder slightly after lightning flash
    thunder.start(now + 0.1 + Math.random() * 0.3);
  }

  /**
   * Play milestone chime when collecting certain numbers of fragments
   */
  playMilestoneChime(milestone: number): void {
    if (!this.audioContext || !this.sfxGain || this.isMuted) return;

    const now = this.audioContext.currentTime;

    // More elaborate arpeggio for milestones
    const notes = milestone >= 5
      ? [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6 (major chord)
      : [440, 523.25, 659.25, 880]; // A4, C5, E5, A5

    notes.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const startTime = now + i * 0.1;
      const duration = 0.5;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
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
   * Play cricket chirps (multiple short high-frequency bursts)
   */
  private playCricketChirp(): void {
    if (!this.audioContext || !this.ambientGain || this.isMuted) return;

    const now = this.audioContext.currentTime;

    // Cricket chirp consists of 2-4 rapid short bursts
    const chirpCount = 2 + Math.floor(Math.random() * 3);
    const baseFreq = 4000 + Math.random() * 1000; // 4-5 kHz

    for (let i = 0; i < chirpCount; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.value = baseFreq + Math.random() * 200;

      const startTime = now + i * 0.08;
      const duration = 0.03 + Math.random() * 0.02;
      const volume = 0.03 * this.nightAmount; // Louder at night

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ambientGain);

      osc.start(startTime);
      osc.stop(startTime + duration);
    }
  }

  /**
   * Play owl hoot (low frequency with harmonics)
   */
  private playOwlHoot(): void {
    if (!this.audioContext || !this.ambientGain || this.isMuted) return;

    const now = this.audioContext.currentTime;

    // Owl hoot: "hoo-HOO-hoo" pattern (3 notes)
    const notes = [
      { freq: 350, duration: 0.3, volume: 0.04, delay: 0 },
      { freq: 420, duration: 0.4, volume: 0.06, delay: 0.35 },
      { freq: 350, duration: 0.25, volume: 0.03, delay: 0.8 },
    ];

    notes.forEach((note) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'sine';
      osc.frequency.value = note.freq;

      const startTime = now + note.delay;
      const volume = note.volume * this.nightAmount;

      // Soft attack and release for owl-like quality
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
      gain.gain.setValueAtTime(volume, startTime + note.duration - 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.duration);

      osc.connect(gain);
      gain.connect(this.ambientGain!);

      osc.start(startTime);
      osc.stop(startTime + note.duration);

      // Add a subtle harmonic for richer sound
      const harmonic = this.audioContext!.createOscillator();
      const harmGain = this.audioContext!.createGain();

      harmonic.type = 'sine';
      harmonic.frequency.value = note.freq * 2; // Octave above

      harmGain.gain.setValueAtTime(0, startTime);
      harmGain.gain.linearRampToValueAtTime(volume * 0.2, startTime + 0.05);
      harmGain.gain.exponentialRampToValueAtTime(0.001, startTime + note.duration);

      harmonic.connect(harmGain);
      harmGain.connect(this.ambientGain!);

      harmonic.start(startTime);
      harmonic.stop(startTime + note.duration);
    });
  }

  /**
   * Set night mode amount for night creature sounds
   * @param amount 0 = day (no night sounds), 1 = full night
   */
  setNightMode(amount: number): void {
    this.nightAmount = Math.max(0, Math.min(1, amount));
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
  update(delta: number, isMoving: boolean, isSprinting: boolean, surfaceType: 'grass' | 'concrete' | 'water' = 'concrete'): void {
    if (!this.isInitialized || this.isMuted) return;

    // Adjust footstep interval based on sprinting and surface
    const baseInterval = isSprinting ? 0.25 : 0.4;
    // Slower footsteps in water
    this.footstepInterval = surfaceType === 'water' ? baseInterval * 1.3 : baseInterval;

    if (isMoving) {
      this.lastFootstepTime += delta;
      if (this.lastFootstepTime >= this.footstepInterval) {
        this.playFootstep(surfaceType);
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

    // Night creature sounds (only when nightAmount > 0.3)
    if (this.nightAmount > 0.3) {
      // Cricket chirps every 0.5-2 seconds
      this.cricketTimer += delta;
      const cricketInterval = 0.5 + Math.random() * 1.5;
      if (this.cricketTimer >= cricketInterval) {
        this.playCricketChirp();
        this.cricketTimer = 0;
      }

      // Owl hoots occasionally
      this.owlTimer += delta;
      if (this.owlTimer >= this.nextOwlTime) {
        this.playOwlHoot();
        this.owlTimer = 0;
        this.nextOwlTime = 15 + Math.random() * 20; // 15-35 seconds
      }
    } else {
      this.cricketTimer = 0;
      this.owlTimer = 0;
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
