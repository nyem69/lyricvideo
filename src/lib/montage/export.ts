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
 *  WebM stays FIRST so desktop output is unchanged — Chrome/Firefox keep picking
 *  VP9 exactly as before. Safari supports none of the WebM entries and falls
 *  through to MP4, which is the only thing it can record (H.264+AAC).
 *
 *  Before MP4 was listed, the loop found nothing on Safari and returned a
 *  hardcoded 'video/webm' anyway, so `new MediaRecorder(...)` threw
 *  NotSupportedError and export was dead on every iPhone/iPad.
 */
export const EXPORT_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4;codecs=h264,aac',
  'video/mp4',
] as const;

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
  const recorder = new MediaRecorder(mixed, mimeType ? { mimeType } : undefined);
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
