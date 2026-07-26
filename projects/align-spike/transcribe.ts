// Phase 0 spike — transcribe a 16kHz mono PCM WAV with Whisper (transformers.js)
// and dump word-level timestamps to JSON.
//
// Usage: pnpm transcribe <wav> <model-suffix> [dtype] [language]
//   e.g. pnpm transcribe kota-pagoh.16k.wav base q8 ms
//
// Model resolves to onnx-community/whisper-<suffix> (tiny | base | small ...).
// Same weights the browser WASM build would pull, so ACCURACY numbers transfer;
// wall-clock here is onnxruntime-node on an M-series and is only indicative.

import { readFileSync, writeFileSync } from 'node:fs';
import { pipeline } from '@huggingface/transformers';

// ---- minimal WAV (RIFF, pcm_s16le) decoder — the spike controls its own input
function decodeWav(path: string): { samples: Float32Array; sampleRate: number } {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: not a RIFF/WAVE file`);
  }
  let off = 12;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let channels = 0;
  let data: Buffer | null = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      const fmt = buf.readUInt16LE(off + 8);
      if (fmt !== 1) throw new Error(`unsupported WAV format tag ${fmt} (want PCM)`);
      channels = buf.readUInt16LE(off + 10);
      sampleRate = buf.readUInt32LE(off + 12);
      bitsPerSample = buf.readUInt16LE(off + 22);
    } else if (id === 'data') {
      data = buf.subarray(off + 8, off + 8 + size);
    }
    off += 8 + size + (size % 2);
  }
  if (!data) throw new Error('no data chunk');
  if (bitsPerSample !== 16 || channels !== 1) {
    throw new Error(`want 16-bit mono, got ${bitsPerSample}-bit ${channels}ch`);
  }
  const n = data.length >> 1;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = data.readInt16LE(i * 2) / 32768;
  return { samples, sampleRate };
}

const [wavPath, suffix = 'base', dtype = 'q8', language = 'ms'] = process.argv.slice(2);
if (!wavPath) {
  console.error('usage: pnpm transcribe <wav> [tiny|base|small] [dtype] [language]');
  process.exit(1);
}

const model = `onnx-community/whisper-${suffix}`;
const { samples, sampleRate } = decodeWav(wavPath);
const durationSec = samples.length / sampleRate;
console.log(`audio: ${wavPath} — ${durationSec.toFixed(1)}s @ ${sampleRate}Hz`);
console.log(`model: ${model} dtype=${dtype} language=${language}`);

const t0 = performance.now();
const transcriber = await pipeline('automatic-speech-recognition', model, { dtype } as never);
const tLoad = performance.now() - t0;
console.log(`model loaded in ${(tLoad / 1000).toFixed(1)}s`);

const t1 = performance.now();
const out = (await transcriber(samples, {
  language,
  task: 'transcribe',
  chunk_length_s: 30,
  stride_length_s: 5,
  return_timestamps: 'word',
} as never)) as { text: string; chunks?: { text: string; timestamp: [number, number | null] }[] };
const tRun = performance.now() - t1;

const words = (out.chunks ?? [])
  .filter((c) => c.timestamp && c.timestamp[0] != null)
  .map((c) => ({
    text: c.text,
    start: c.timestamp[0],
    end: c.timestamp[1] ?? undefined,
  }));

const result = {
  model,
  dtype,
  language,
  audio: wavPath,
  durationSec,
  loadSec: tLoad / 1000,
  transcribeSec: tRun / 1000,
  rtf: tRun / 1000 / durationSec, // realtime factor: <1 is faster than realtime
  wordCount: words.length,
  text: out.text,
  words,
};

const outPath = `asr.${suffix}.${dtype}.json`;
writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(
  `transcribed in ${(tRun / 1000).toFixed(1)}s (rtf ${result.rtf.toFixed(2)}x) — ${words.length} words -> ${outPath}`
);
