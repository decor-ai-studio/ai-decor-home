// Procedural background music: no external audio files, fully generated in the
// browser so every track is royalty-free and can be mixed into the exported video.

export type TrackId = "corporate" | "cinematic" | "oriental" | "electronic" | "calm" | "none";

export type MusicTrack = {
  id: TrackId;
  name: string;
  mood: string;
  bpm: number;
  scale: number[]; // semitone offsets from root
  root: number; // midi note
  wave: OscillatorType;
  bass: OscillatorType;
  drums: "none" | "soft" | "punchy";
  arp: boolean;
};

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "corporate",
    name: "مؤسسي مشرق",
    mood: "إيقاع واضح مناسب للعروض التجارية",
    bpm: 112,
    root: 60,
    scale: [0, 2, 4, 7, 9],
    wave: "triangle",
    bass: "sine",
    drums: "punchy",
    arp: true,
  },
  {
    id: "cinematic",
    name: "سينمائي ملحمي",
    mood: "أوتار عريضة وتصاعد درامي",
    bpm: 84,
    root: 53,
    scale: [0, 3, 5, 7, 10],
    wave: "sawtooth",
    bass: "triangle",
    drums: "soft",
    arp: false,
  },
  {
    id: "oriental",
    name: "شرقي حديث",
    mood: "مقام شرقي مع إيقاع خفيف",
    bpm: 96,
    root: 57,
    scale: [0, 1, 4, 5, 7, 8, 11],
    wave: "square",
    bass: "sine",
    drums: "soft",
    arp: true,
  },
  {
    id: "electronic",
    name: "إلكتروني نشِط",
    mood: "طاقة عالية لمقاطع التركيب السريعة",
    bpm: 128,
    root: 55,
    scale: [0, 2, 3, 7, 10],
    wave: "sawtooth",
    bass: "square",
    drums: "punchy",
    arp: true,
  },
  {
    id: "calm",
    name: "هادئ للعرض",
    mood: "خلفية ناعمة لا تشتت عن الواجهة",
    bpm: 72,
    root: 60,
    scale: [0, 2, 5, 7, 9],
    wave: "sine",
    bass: "sine",
    drums: "none",
    arp: false,
  },
];

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx: BaseAudioContext) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  return buf;
}

/**
 * Schedules a full arrangement of `duration` seconds into `out`.
 * Works with a live AudioContext (preview / recording) alike.
 */
export function scheduleTrack(
  ctx: BaseAudioContext,
  out: AudioNode,
  track: MusicTrack,
  duration: number,
  startAt: number,
  volume = 0.7,
  offset = 0, // skip the first `offset` seconds of the arrangement (trim start)
) {
  if (track.id === "none" || duration <= 0.2) return;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(out);

  // gentle fade in / out so the clip never clicks
  master.gain.setValueAtTime(0, startAt);
  const fade = Math.min(0.6, duration / 3);
  master.gain.linearRampToValueAtTime(volume, startAt + fade);
  master.gain.setValueAtTime(volume, startAt + Math.max(fade + 0.05, duration - 1));
  master.gain.linearRampToValueAtTime(0.0001, startAt + duration);

  const beat = 60 / track.bpm;
  const half = beat / 2;
  const firstStep = Math.ceil(offset / half);
  const steps = firstStep + Math.ceil(duration / half);
  const nb = noiseBuffer(ctx);

  const tone = (t: number, midi: number, len: number, type: OscillatorType, gain: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = midiToHz(midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + len + 0.05);
  };

  const hit = (t: number, gain: number, freq: number) => {
    const s = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = nb;
    f.type = "bandpass";
    f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + 0.3);
  };

  const chords = [0, 3, 4, 2];
  for (let s = firstStep; s < steps; s++) {
    const t = startAt + s * half - offset;
    const bar = Math.floor(s / 8) % chords.length;
    const degree = chords[bar]!;
    const rootNote = track.root + (track.scale[degree % track.scale.length] ?? 0);

    // bass on every beat
    if (s % 2 === 0) tone(t, rootNote - 24, beat * 0.9, track.bass, 0.22);

    // pad / chord every bar
    if (s % 8 === 0) {
      [0, 2, 4].forEach((i, k) =>
        tone(t, rootNote + (track.scale[(degree + i) % track.scale.length] ?? 0), beat * 3.6, track.wave, 0.07 - k * 0.01),
      );
    }

    // melody / arpeggio
    if (track.arp || s % 4 === 0) {
      const note = rootNote + (track.scale[(s + degree) % track.scale.length] ?? 0) + (s % 8 < 4 ? 12 : 0);
      tone(t, note, beat * 0.45, track.wave, 0.09);
    }

    // percussion
    if (track.drums !== "none") {
      const strong = track.drums === "punchy";
      if (s % 4 === 0) tone(t, 33, 0.16, "sine", strong ? 0.35 : 0.2); // kick
      if (s % 8 === 4) hit(t, strong ? 0.28 : 0.16, 1800); // snare
      if (s % 2 === 1) hit(t, strong ? 0.08 : 0.05, 6500); // hat
    }
  }
}

/** Plays a short preview of a track and returns a stop function. */
export function previewTrack(track: MusicTrack, seconds = 6, volume = 0.6, offset = 0) {
  const ctx = new AudioContext();
  scheduleTrack(ctx, ctx.destination, track, seconds, ctx.currentTime + 0.05, volume, offset);
  const timer = setTimeout(() => ctx.close().catch(() => {}), (seconds + 0.5) * 1000);
  return () => {
    clearTimeout(timer);
    ctx.close().catch(() => {});
  };
}
