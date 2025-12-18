import * as Tone from 'tone';
import { type SoundConfig } from '../sharedTypes';
import { getInstrumentDefinition } from './instrumentConfig';
import type { TransportState } from '../automergeTypes';

type SynthInstrument = Tone.Synth | Tone.FMSynth | Tone.AMSynth | Tone.MonoSynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.PluckSynth | Tone.MetalSynth;
type Instrument = SynthInstrument | Tone.Loop | Tone.Player | Tone.Noise | Tone.Pattern<any>;
type InstrumentGroup = Instrument | Instrument[];

export class SoundPlayer {
  private static instance: SoundPlayer;
  private activeInstruments: InstrumentGroup[] = [];
  private instrumentMap: Map<string, InstrumentGroup> = new Map();
  private isSyncingTransport: boolean = false; // Prevent feedback loops during sync

  static getInstance(): SoundPlayer {
    if (!SoundPlayer.instance) {
      SoundPlayer.instance = new SoundPlayer();
    }
    return SoundPlayer.instance;
  }

  async playSingle(soundType: string, note: string): Promise<void> {
    await Tone.start();
    const timeLimit = 8000;
    // const timeLimit = 1e+20;

    const instrument = this.createInstrument(soundType);
    this.activeInstruments.push(instrument);  // Track it so stopAll() can kill it
    this.triggerInstrument(instrument, note);

    setTimeout(() => {
      this.destroyInstrument(instrument);
      // Remove from active instruments
      const index = this.activeInstruments.indexOf(instrument);
      if (index > -1) {
        this.activeInstruments.splice(index, 1);
      }
    }, timeLimit);
  }

  async playMultiple(sounds: SoundConfig[]): Promise<void> {
    await Tone.start();
    
    this.stopAll();
    
    const synthConfigs = sounds.map(({ soundType, note }) => {
      const instrument = this.createInstrument(soundType);
      this.activeInstruments.push(instrument);
      return { instrument, note };
    });
    
    const startTime = Tone.now() + 0.1;
    
    synthConfigs.forEach(({ instrument, note }) => {
      this.triggerInstrument(instrument, note, startTime);
    });
  }

  async startInstrument(instrumentId: string, note: string = "C4"): Promise<void> {
    // If already playing, don't start again
    if (this.instrumentMap.has(instrumentId)) {
      return;
    }

    await Tone.start();
    const instrument = this.createInstrument(instrumentId);
    this.instrumentMap.set(instrumentId, instrument);
    this.activeInstruments.push(instrument);
    this.triggerInstrument(instrument, note);
  }

  stopInstrument(instrumentId: string): void {
    const instrument = this.instrumentMap.get(instrumentId);
    if (instrument) {
      this.destroyInstrument(instrument);
      this.instrumentMap.delete(instrumentId);

      // Remove from active instruments
      const index = this.activeInstruments.indexOf(instrument);
      if (index > -1) {
        this.activeInstruments.splice(index, 1);
      }
    }
  }

  isInstrumentPlaying(instrumentId: string): boolean {
    return this.instrumentMap.has(instrumentId);
  }

  stopAll(): void {
    // Stop all tracked instruments
    this.activeInstruments.forEach(instrument => {
      this.destroyInstrument(instrument);
    });
    this.activeInstruments = [];
    this.instrumentMap.clear();

    // NUCLEAR OPTION: Stop Transport and silence everything
    Tone.getTransport().stop();
    Tone.getTransport().cancel();  // Cancel all scheduled events

    // Release all voices on Destination to silence any ongoing sounds
    Tone.getDestination().volume.rampTo(-Infinity, 0.1);
    setTimeout(() => {
      Tone.getDestination().volume.value = 0;  // Reset volume after silence
    }, 150);
  }

  private createInstrument(soundType: string): InstrumentGroup {
    const definition = getInstrumentDefinition(soundType);
    if (definition) {
      return definition.create();
    }
    // Fallback to default synth
    return new Tone.Synth().toDestination();
  }

  private triggerInstrument(instrument: InstrumentGroup, note: string, startTime?: number): void {
    const instruments = Array.isArray(instrument) ? instrument : [instrument];
    const time = startTime || Tone.now();

    instruments.forEach((inst) => {
      if (inst instanceof Tone.Loop || inst instanceof Tone.Pattern) {
        // Patterns and Loops need Transport to be running
        Tone.getTransport().start();
      } else if (inst instanceof Tone.Player) {
        inst.autostart = true;
      } else if (inst instanceof Tone.Noise) {
        // Noise sources just need to be started
        inst.start();
      } else if (this.isSynthInstrument(inst)) {
        // For synths, trigger a note (generative synths trigger themselves via onsilence)
        inst.triggerAttackRelease(note, '8n', time);
      }
    });
  }

  private destroyInstrument(instrument: InstrumentGroup): void {
    const instruments = Array.isArray(instrument) ? instrument : [instrument];

    instruments.forEach((inst) => {
      try {
        // Handle different instrument types
        if (inst instanceof Tone.Loop || inst instanceof Tone.Pattern) {
          inst.stop();
        } else if (inst instanceof Tone.Player) {
          inst.stop();
        } else if (inst instanceof Tone.Noise) {
          inst.stop();
        } else if (this.isSynthInstrument(inst)) {
          // For synths, trigger release and clear onsilence to break generative chains
          inst.triggerRelease();
          if ('onsilence' in inst) {
            inst.onsilence = () => {}; // Break the generative chain
          }
        }

        // Dispose the instrument to free resources
        inst.dispose();
      } catch (e) {
        console.warn('Error disposing instrument:', e);
      }
    });
  }

  private isSynthInstrument(inst: Instrument): inst is SynthInstrument {
    return 'triggerAttackRelease' in inst;
  }

  /**
   * Synchronize local Transport with shared state from Automerge
   * This should be called when transport state updates from other users
   */
  syncTransportState(transportState: TransportState): void {
    if (this.isSyncingTransport) return; // Prevent feedback loops

    this.isSyncingTransport = true;

    try {
      const transport = Tone.getTransport();

      // Update BPM if changed
      if (transport.bpm.value !== transportState.bpm) {
        transport.bpm.value = transportState.bpm;
      }

      // Update position if changed (with small tolerance for network latency)
      if (transport.position !== transportState.position) {
        transport.position = transportState.position;
      }

      // Update play/pause state
      if (transportState.isPlaying && transport.state !== 'started') {
        transport.start();
      } else if (!transportState.isPlaying && transport.state === 'started') {
        transport.pause();
      }
    } finally {
      this.isSyncingTransport = false;
    }
  }

  /**
   * Get current transport state to share with other users
   */
  getTransportState(masterId: string): TransportState {
    const transport = Tone.getTransport();
    return {
      bpm: transport.bpm.value,
      isPlaying: transport.state === 'started',
      position: transport.position.toString(),
      lastUpdated: Date.now(),
      masterId
    };
  }

  /**
   * Initialize transport with default settings
   */
  initializeTransport(bpm: number = 120): void {
    const transport = Tone.getTransport();
    transport.bpm.value = bpm;
    transport.loop = false; // Can be changed based on your needs
  }

  /**
   * Start the transport and return new state
   */
  startTransport(masterId: string): TransportState {
    if (!this.isSyncingTransport) {
      Tone.getTransport().start();
    }
    return this.getTransportState(masterId);
  }

  /**
   * Stop/pause the transport and return new state
   */
  stopTransport(masterId: string): TransportState {
    if (!this.isSyncingTransport) {
      Tone.getTransport().pause();
    }
    return this.getTransportState(masterId);
  }

  /**
   * Update BPM and return new state
   */
  setBPM(bpm: number, masterId: string): TransportState {
    if (!this.isSyncingTransport) {
      Tone.getTransport().bpm.value = bpm;
    }
    return this.getTransportState(masterId);
  }
}

export default SoundPlayer;