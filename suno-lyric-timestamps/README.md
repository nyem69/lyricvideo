# How to Install

- Save all three files into a folder (e.g. suno-lyric-timestamps/)
- Open Chrome → go to chrome://extensions/
- Enable Developer mode (top-right toggle)
- Click Load unpacked → select your folder
- Navigate to any https://suno.com/edit/… page
- Click the extension icon → click Extract Timestamps


# How It Works (under the hood)
The extension reuses exactly what we reverse-engineered in this session:

- Finds the React fiber tree on .lyrics-display-inner and walks up 4 levels to reach the lyric editor component.
- Reads state index 22 — an array of 504 tokens, each with { text, timing: { startBeats, endBeats } }.
- Calls window.studioContext.playbackController.seek(beats) then getCurrentSeconds() for each token — this accounts for the non-linear warp/time-stretch markers automatically.
- Restores the original playhead position when done.
- Outputs both plain text ([mm:ss.mmm] word) and SRT subtitle format for video editors.
