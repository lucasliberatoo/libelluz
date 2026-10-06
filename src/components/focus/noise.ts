"use client";

// Ruído de fundo gerado no navegador (Web Audio), sem arquivos de áudio.
// Fica num módulo único para continuar tocando enquanto a pessoa navega pelo app.

export type NoiseKind = "branco" | "rosa" | "marrom";

let ctx: AudioContext | null = null;
let src: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let current: { kind: NoiseKind; volume: number } | null = null;
const listeners = new Set<() => void>();

function buffer(ac: AudioContext, kind: NoiseKind) {
  const len = ac.sampleRate * 4;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "branco") d[i] = w * 0.5;
    else if (kind === "rosa") {
      // filtro de Paul Kellet
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

export function playNoise(kind: NoiseKind, volume: number) {
  ctx ??= new AudioContext();
  void ctx.resume();
  if (!gain) {
    gain = ctx.createGain();
    gain.connect(ctx.destination);
  }
  gain.gain.value = volume;
  if (current?.kind !== kind || !src) {
    src?.stop();
    src = ctx.createBufferSource();
    src.buffer = buffer(ctx, kind);
    src.loop = true;
    src.connect(gain);
    src.start();
  }
  current = { kind, volume };
  listeners.forEach((l) => l());
}

export function setNoiseVolume(volume: number) {
  if (gain) gain.gain.value = volume;
  if (current) current = { ...current, volume };
  listeners.forEach((l) => l());
}

export function stopNoise() {
  src?.stop();
  src = null;
  current = null;
  listeners.forEach((l) => l());
}

export function noiseState() {
  return current;
}

export function subscribeNoise(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Bipe curto para avisar fim de tempo/pausa. */
export function chime() {
  try {
    ctx ??= new AudioContext();
    const ac = ctx;
    [0, 0.18, 0.36].forEach((t, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = [660, 880, 1320][i];
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.4);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.45);
    });
  } catch {
    // sem áudio, tudo bem
  }
}
