import * as Tone from 'tone';

export interface InstrumentDefinition {
  id: string;
  name: string;
  defaultNote: string;
  create: () => Instrument | Instrument[];
}

type SynthInstrument = Tone.Synth | Tone.FMSynth | Tone.AMSynth | Tone.MonoSynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.PluckSynth | Tone.MetalSynth;
type Instrument = SynthInstrument | Tone.Loop | Tone.Player | Tone.Noise | Tone.Pattern<any>;

export const INSTRUMENT_DEFINITIONS: InstrumentDefinition[] = [
  {
    id: 'fm-synth',
    name: 'FM Synth',
    defaultNote: 'C4',
    create: () => new Tone.FMSynth().toDestination()
  },
  {
    id: 'am-synth',
    name: 'AM Synth',
    defaultNote: 'G4',
    create: () => new Tone.AMSynth().toDestination()
  },
  {
    id: 'bass',
    name: 'Bass',
    defaultNote: 'C2',
    create: () => new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.3, release: 0.8 }
    }).toDestination()
  },
  {
    id: 'lead',
    name: 'Lead',
    defaultNote: 'C5',
    create: () => new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 0.4 }
    }).toDestination()
  },
  {
    id: 'drum',
    name: 'Drum Hit',
    defaultNote: 'C3',
    create: () => new Tone.MembraneSynth().toDestination()
  },
  {
    id: 'beat_loop',
    name: 'Beat Loop',
    defaultNote: 'C4',
    create: () => {
      const player = new Tone.Player("https://tonejs.github.io/audio/drum-samples/loops/blueyellow.mp3").toDestination();
      player.loop = true;
      return player;
    }
  },
  {
    id: 'organ_loop',
    name: 'Organ Loop',
    defaultNote: 'C4',
    create: () => {
      const player = new Tone.Player("https://tonejs.github.io/audio/drum-samples/loops/organ-echo-chords.mp3").toDestination();
      player.loop = true;
      return player;
    }
  },
  {
    id: 'combo_synth',
    name: 'Combo Synth',
    defaultNote: 'C4',
    create: () => {
      const synthA = new Tone.FMSynth().toDestination();
      const synthB = new Tone.AMSynth().toDestination();
      const loopA = new Tone.Loop((time) => {
        synthA.triggerAttackRelease("D2", "8n", time);
      }, "4n").start(0);
      const loopB = new Tone.Loop((time) => {
        synthB.triggerAttackRelease("A2", "8n", time);
      }, "4n").start("8n");
      return [loopA, loopB];
    }
  },
  {
    id: "noise",
    name: "Noise",
    defaultNote: "D6",
    create: () => {
      // Create a droning noise (continuous sound)
      const noise = new Tone.Noise({
        type: "pink",           // "white", "pink", or "brown"
        volume: -15,            // Lower volume for background drone
        fadeIn: 0.5,            // Fade in over 0.5 seconds
        fadeOut: 0.5            // Fade out over 0.5 seconds when stopped
      }).toDestination();

      // Start the continuous drone
      // noise.start();

      // Create a plucky synth for the arpeggio
      // const plucky = new Tone.PluckSynth({
      //   attackNoise: 1,
      //   dampening: 4000,
      //   resonance: 0.9
      // }).toDestination();

      // const metallo = new Tone.MetalSynth({
      //   portamento: 0.1,
      // }).toDestination();

      // const membrane = new Tone.

      // Create an arpeggio pattern
      // time = when to trigger (in seconds, scheduled by Tone.js)
      // note = current value from the array based on pattern type

      // Return both the noise and pattern so they can be stopped later
      // return [noise, pattern];
      // return pattern
      return noise
    }
  },
  {
    id: "arp",
    name: "Arpeggiator",
    defaultNote: "C4",
    create: () => {
        // L/R channel merging
        const merge = new Tone.Merge();

        // a little reverb
        const reverb = new Tone.Reverb({
          wet: 0.3
        });

        merge.chain(reverb, Tone.Destination);

        // left and right synthesizers
        const synthL = new Tone.Synth({
          oscillator: {
            type: "custom",
            partials: [2, 1, 2, 2],
          },
          envelope: {
            attack: 0.005,
            decay: 0.3,
            sustain: 0.2,
            release: 1,
          },
          portamento: 0.01,
          volume: -20
        }).connect(merge, 0, 0);  // Connect to LEFT channel of merge only

        const synthR = new Tone.Synth({
          oscillator: {
            type: "custom",
            partials: [2, 1, 2, 2],
          },
          envelope: {
            attack: 0.005,
            decay: 0.3,
            sustain: 0.2,
            release: 1,
          },
          portamento: 0.01,
          volume: -20
        }).connect(merge, 0, 1);  // Connect to RIGHT channel of merge only

        const arp_pattern_L = new Tone.Pattern((time, note) => {
          // triggerAttackRelease(note, duration, time)
          // - note: which note to play (from the array below)
          // - duration: how long the note rings ("8n" = eighth note)
          // - time: WHEN to play it (scheduled time from pattern)
          synthL.triggerAttackRelease(note, "8n", time);
        }, ["C1", "D3", "E2", "A3"], "upDown");

        const arp_pattern_R = new Tone.Pattern((time, note) => {
          synthR.triggerAttackRelease(note, "8n", time);
        }, ["C1", "D3", "E2", "A3"], "upDown");

        // Set interval and playback rate
        arp_pattern_L.interval = "8n";
        arp_pattern_R.interval = "8n";
        // set the playback rate of the right part to be slightly slower
        arp_pattern_R.playbackRate = 0.985;

        // START the patterns!
        arp_pattern_L.start(0);
        arp_pattern_R.start(0);

        return [arp_pattern_L, arp_pattern_R]
    }
  },
  {
    id: "generative",
    name: "Self-Playing Generative",
    defaultNote: "C4",
    create: () => {
      // GENERATIVE MUSIC USING ONSILENCE
      // Each time a note finishes, onsilence triggers the next note
      // with evolving parameters
      // FX
      const reverb = new Tone.Reverb({
        wet: 0.9
      });
      // const chorus = new Tone.Chorus(4, 2.5, 0.5);
      const feedbackDelay = new Tone.FeedbackDelay("8n", 0.8);

      const notes = ["C3", "E3", "G3", "B3", "D4", "F#4", "A4"];
      let currentIndex = 0;
      let octaveShift = 0;

      // Create synth with onsilence callback
      const synth = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: {
          attack: 0.01,
          decay: 0.3,
          sustain: 0.5,
          release: 1  // Release controls when onsilence fires
        },
        volume: -10,
        onsilence: () => {
          // This fires when the note has fully released and is silent

          // Evolve the pattern
          currentIndex = (currentIndex + 1) % notes.length;

          // Every 4 notes, shift octave randomly
          if (currentIndex % 4 === 0) {
            octaveShift = Math.random() > 0.5 ? 1 : -1;
          }

          // Get next note and apply octave shift
          let nextNote = notes[currentIndex];
          const noteNumber = parseInt(nextNote.match(/\d+/)?.[0] || "3");
          const noteName = nextNote.match(/[A-G]#?/)?.[0] || "C";
          nextNote = noteName + (noteNumber + octaveShift);

          // Vary duration for evolution
          const durations = ["8n", "4n", "16n"];
          const duration = durations[Math.floor(Math.random() * durations.length)];

          // Trigger next note - onsilence will fire again when it finishes
          synth.triggerAttackRelease(nextNote, duration);

          console.log(`Next note: ${nextNote}, duration: ${duration}`);
        }
      }).chain(reverb, feedbackDelay, Tone.Destination);

      // Start the generative sequence with first note
      synth.triggerAttackRelease(notes[0], "4n");

      return synth;
    }
  },
  {
    id: "dual_voices",
    name: "Dual Generative Voices",
    defaultNote: "C4",
    create: () => {
      // TWO GENERATIVE VOICES THAT INTERACT
      // Voice 1 triggers Voice 2 when it finishes, and vice versa
      // FX
      const reverb = new Tone.Reverb({
        wet: 0.99
      });
      // const chorus = new Tone.Chorus(4, 2.5, 0.5);
      const feedbackDelay = new Tone.FeedbackDelay("8n", 0.6);

      const scale1 = ["C4", "D4", "E4", "G4", "A4"];
      const scale2 = ["E3", "G3", "B3", "D4"];
      let index1 = 0;
      let index2 = 0;

      const voice1 = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.04,
          decay: 0.2,
          sustain: 0.15,
          release: 1
        },
        volume: -15,
        onsilence: () => {
          // When voice1 finishes, trigger voice2
          index2 = (index2 + 1) % scale2.length;
          voice2.triggerAttackRelease(scale2[index2], "8n");
        }
      }).chain(feedbackDelay, Tone.Destination);

      const voice2 = new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 10,
        envelope: {
          attack: 0.01,
          decay: 0.5,
          sustain: 0.1,
          release: 0.5
        },
        volume: -3,
        onsilence: () => {
          // When voice2 finishes, trigger voice1
          index1 = (index1 + 1) % scale1.length;
          voice1.triggerAttackRelease(scale1[index1], "4n");
        }
      }).chain(reverb, Tone.Destination);

      // Start the conversation between voices
      voice1.triggerAttackRelease(scale1[0], "4n");

      return [voice1, voice2];
    }
  },
  {
    id: "pattern_accent",
    name: "Pattern + Accent Hybrid",
    defaultNote: "C4",
    create: () => {
      // COMBINE PATTERN WITH ONSILENCE
      // Pattern plays steady arpeggio
      // Synth with onsilence plays random accents when silent
      // some FX
      const reverb = new Tone.Reverb({
        wet: 0.8
      });
      // const chorus = new Tone.Chorus(4, 2.5, 0.5);
      const feedbackDelay = new Tone.FeedbackDelay("8n", 0.5);

      // Steady arpeggio using Pattern
      const arpSynth = new Tone.PluckSynth({
        attackNoise: 1,
        dampening: 4000,
        resonance: 0.9,
        volume: -10
      }).chain(reverb, feedbackDelay, Tone.Destination);

      const pattern = new Tone.Pattern((time, note) => {
        arpSynth.triggerAttackRelease(note, "8n", time);
      }, ["C3", "E3", "G3", "B3"], "upDown");

      pattern.interval = "8n";
      pattern.start(0);

      // Generative accent synth using onsilence
      const accentNotes = ["C3", "D3", "E3", "G3", "A3", "E3"];
      let accentIndex = 0;

      const accent_reverb = new Tone.Reverb({
        wet: 0.99
      });
      const accentSynth = new Tone.Synth({
        oscillator: {
            type: "custom",
            partials: [1, 0.5, 1, 1],
          },
          envelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.3,
            release: 1.5,
          },
        volume: -24,
        portamento: 0.05,
        onsilence: () => {
          // Wait random time before next accent based on note durations
          const waitDurations = ["2n", "4n", "8n", "16n"];  // quarter, eighth, sixteenth, half, whole
          const randomWaitDuration = waitDurations[Math.floor(Math.random() * waitDurations.length)];

          // Convert Tone.js time notation to milliseconds
          const waitTimeMs = Tone.Time(randomWaitDuration).toMilliseconds();

          setTimeout(() => {
            accentIndex = Math.floor(Math.random() * accentNotes.length);
            accentSynth.triggerAttackRelease(accentNotes[accentIndex], "16n");
          }, waitTimeMs);
        }
      }).chain(feedbackDelay, accent_reverb, Tone.Destination);

      // Start first accent
      // accentSynth.triggerAttackRelease(accentNotes[0], "16n");

      return [pattern, accentSynth];
    }
  }
];

// Helper to get instrument definition by id
export function getInstrumentDefinition(id: string): InstrumentDefinition | undefined {
  return INSTRUMENT_DEFINITIONS.find(def => def.id === id);
}