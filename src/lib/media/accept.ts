// src/lib/media/accept.ts

/** `accept` value for the audio file inputs.
 *
 *  The bare `audio/*` wildcard is NOT enough on iOS. WebKit's document picker
 *  filters by UTI and does not reliably expand the wildcard into the concrete
 *  audio UTIs, so a genuine MP3 — one iOS itself reports as "Kind: MP3 audio"
 *  and has already parsed a duration from — still shows up dimmed and
 *  unselectable. Observed 2026-07-25 on a Suno download (`pahlawan-(2).mp3`,
 *  6.8 MB, 05:07) in the Files picker on iPhone.
 *
 *  Listing explicit extensions alongside the wildcard gives WebKit something it
 *  can match directly. Desktop browsers already matched on the MIME wildcard, so
 *  the extra entries are inert there.
 *
 *  `.mp4` / `video/mp4` are included deliberately: Suno also hands out MP4s, and
 *  an MP4 carrying an AAC track loads through the same `<audio>` + Web Audio
 *  path as any other file here.
 */
export const AUDIO_ACCEPT =
  'audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.oga,.opus,.aiff,.aif,.caf,video/mp4,.mp4';

/** Extensions named explicitly in {@link AUDIO_ACCEPT}, lowercase, no dot. */
export const AUDIO_ACCEPT_EXTENSIONS = AUDIO_ACCEPT.split(',')
  .filter((t) => t.startsWith('.'))
  .map((t) => t.slice(1));
