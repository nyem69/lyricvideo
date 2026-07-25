// src/lib/montage/export.ts
export interface ExportOptions {
  canvas: HTMLCanvasElement;
  audioFile: Blob | null;
  durationSec: number;
  fps: number;
  renderFrame: (t: number) => void | Promise<void>; // paints the canvas at export-local time t
  onProgress?: (frac: number) => void;
  /** When present, an AnalyserNode is tapped off the export audio source and
   *  handed back before recording starts, so renderFrame can read live FFT. */
  onAnalyserReady?: (analyser: AnalyserNode) => void;
  /** Abort an in-progress export. On abort the recorder + audio are torn down
   *  and the promise rejects with an `AbortError` DOMException — no partial file
   *  is returned (a half-rendered lyric video is unusable). */
  signal?: AbortSignal;
}

/** Recording formats in preference order.
 *
 *  MP4/H.264 FIRST, everywhere. Two reasons:
 *
 *  1. iOS. Modern Safari *can* record WebM, but on an iPhone that is a dead end
 *     — Photos won't import it, WhatsApp won't play it, and there is no
 *     transcode step on the device. Supported and useful are not the same thing.
 *     (An earlier revision put WebM first assuming Safari couldn't record it at
 *     all; a real iPhone export came back as a .webm and disproved that.)
 *  2. Desktop. The pipeline here records and then transcodes to H.264 anyway, so
 *     recording VP9 first only adds a lossy generation. Going straight to H.264
 *     removes a re-encode.
 *
 *  WebM remains as fallback for browsers that cannot record MP4.
 */
export const EXPORT_MIME_CANDIDATES = [
  'video/mp4;codecs=h264,aac',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

/** Video bitrate target, in bits per pixel per second — calibrated so a
 *  1920x1080 export lands at ~4 Mbps (roughly 150 MB for a 5-minute song).
 *
 *  Without an explicit cap MediaRecorder uses a browser default, and those vary
 *  wildly: a 5:07 iPhone export came out at 371 MB (~9.7 Mbps) while desktop
 *  produced ~1.4 Mbps from the same kind of content. Pinning the rate keeps
 *  output predictable across browsers and small enough to actually share. */
export const VIDEO_BITS_PER_PIXEL_SECOND = 4_000_000 / (1920 * 1080);

/** Opus/AAC at this rate is transparent for music at the sizes we target. */
export const AUDIO_BITS_PER_SECOND = 128_000;

/** Bitrate for a canvas of the given size, clamped to a sane band so an odd
 *  custom format cannot ask for a 0.1 Mbps smear or a 50 Mbps monster. */
export function videoBitrateFor(width: number, height: number): number {
  const pixels = Math.max(1, Math.round(width) * Math.round(height));
  const raw = pixels * VIDEO_BITS_PER_PIXEL_SECOND;
  return Math.round(Math.min(12_000_000, Math.max(500_000, raw)));
}

/** First supported candidate, or '' when none match — '' means "let the browser
 *  choose its own default", which is strictly better than forcing a type we
 *  already know is unsupported. */
export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const c of EXPORT_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

/** Download extension for a recorder mime type. Params (`;codecs=…`) are
 *  ignored; anything not MP4 is treated as WebM. */
export function extensionForMimeType(mime: string): string {
  return /^video\/mp4/i.test(mime) ? 'mp4' : 'webm';
}

/** Record the canvas + (optional) audio to a video blob — WebM where supported,
 *  MP4 on Safari/iOS. Read `blob.type` for what you actually got. Resolves when
 *  recording stops. */
export async function exportMontage(opts: ExportOptions): Promise<Blob> {
  const { canvas, audioFile, durationSec, fps, renderFrame, onProgress, onAnalyserReady, signal } =
    opts;

  if (signal?.aborted) throw new DOMException('Export canceled', 'AbortError');

  const videoStream = canvas.captureStream(fps);
  const tracks = [...videoStream.getVideoTracks()];

  let audioCtx: AudioContext | null = null;
  let audioEl: HTMLAudioElement | null = null;
  if (audioFile) {
    audioCtx = new AudioContext();
    audioEl = new Audio();
    audioEl.src = URL.createObjectURL(audioFile);
    await audioEl.play().catch(() => {}); // unlock; will be restarted below
    audioEl.pause();
    audioEl.currentTime = 0;
    const source = audioCtx.createMediaElementSource(audioEl);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(audioCtx.destination);
    if (onAnalyserReady) {
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      onAnalyserReady(analyser);
    }
    tracks.push(...dest.stream.getAudioTracks());
  }

  const mixed = new MediaStream(tracks);
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(mixed, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: videoBitrateFor(canvas.width, canvas.height),
    audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    // Tag the blob with what the recorder ACTUALLY produced, not an assumption —
    // on Safari that's MP4, and a WebM-labelled MP4 confuses both the download
    // filename and anything downstream that sniffs the type.
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }));
  });

  // Timeslice: flush a chunk every second instead of buffering the whole video
  // in the encoder until stop() — avoids OOM / dropped data on long exports.
  recorder.start(1000);
  if (audioEl && audioCtx) {
    await audioCtx.resume();
    audioEl.currentTime = 0;
    void audioEl.play();
  }

  // Export-local clock: drive frames from elapsed wall time, not playerStore.
  // The frame loop resolves on completion or rejects (AbortError) if `signal`
  // fires; either way the `finally` tears down the recorder + audio.
  const startMs = performance.now();
  let rafId = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        cancelAnimationFrame(rafId);
        reject(new DOMException('Export canceled', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      const tick = async () => {
        if (signal?.aborted) return; // onAbort already rejected; stop scheduling
        const t = (performance.now() - startMs) / 1000;
        if (t >= durationSec) {
          await renderFrame(durationSec);
          signal?.removeEventListener('abort', onAbort);
          resolve();
          return;
        }
        await renderFrame(t);
        onProgress?.(t / durationSec);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    });
  } finally {
    // Stop the recorder and tear down audio whether we finished or were aborted,
    // so MediaStream tracks and the AudioContext never leak on cancel.
    if (recorder.state !== 'inactive') recorder.stop();
    if (audioEl) {
      audioEl.pause();
      URL.revokeObjectURL(audioEl.src);
    }
    await audioCtx?.close();
  }

  return done;
}
