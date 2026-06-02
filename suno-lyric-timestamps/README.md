# How to Install

- Save all three files into a folder (e.g. suno-lyric-timestamps/)
- Open Chrome → go to chrome://extensions/
- Enable Developer mode (top-right toggle)
- Click Load unpacked → select your folder
- Navigate to any https://suno.com/edit/… page
- Click the extension icon → click Extract Timestamps


# How It Works (under the hood)
The extension reuses exactly what we reverse-engineered in this session:

- Finds the React fiber tree on .lyrics-display-inner and climbs up to 12 ancestor fibers to reach the lyric editor component.
- Auto-locates the token array by scanning each fiber's hook chain for an array of { text, timing: { startBeats, endBeats } } objects (~560 tokens). Suno reshuffles its hook order between releases — the array has drifted from index 22 to 27 — so the extension detects it by shape instead of a hard-coded index.
- Calls window.studioContext.playbackController.seek(beats) then getCurrentSeconds() for each token — this accounts for the non-linear warp/time-stretch markers automatically.
- Restores the original playhead position when done.
- Outputs both plain text ([mm:ss.mmm] word) and SRT subtitle format for video editors.
