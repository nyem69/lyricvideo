// content.js — injected into https://suno.com/edit/*
function extractLyricTimestamps() {
  // 1. Verify we're on the right page
  const lyricsEl = document.querySelector('.lyrics-display-inner');
  if (!lyricsEl) {
    return { error: 'No lyrics editor found. Please open a Suno edit page.' };
  }
  // 2. Get the playback controller from the global studio context
  const pc = window.studioContext?.playbackController;
  if (!pc || typeof pc.seek !== 'function') {
    return { error: 'Playback controller not available. Try refreshing the page.' };
  }
  // 3. Walk the React fiber tree to find the token array with beat timings.
  //    Suno periodically reshuffles its component tree and hook order, so the
  //    old hard-coded "up 4 fibers, hook index 22" stopped matching (the array
  //    has since moved to hook 27). Instead we auto-locate it: climb a handful
  //    of ancestor fibers and scan each one's hook chain for an array that
  //    looks like the syllable tokens — objects with a `text` field, at least
  //    one carrying a `timing`. This survives index drift across Suno updates.
  const fiberKey = Object.keys(lyricsEl).find(k => k.startsWith('__reactFiber'));
  if (!fiberKey) return { error: 'React fiber not found.' };
  function looksLikeTokens(v) {
    return Array.isArray(v) && v.length > 20
      && v.every(x => x && typeof x === 'object' && 'text' in x)
      && v.some(x => x.timing);
  }
  let tokens = null;
  let node = lyricsEl[fiberKey];
  for (let up = 0; up < 12 && node && !tokens; up++, node = node.return) {
    let s = node.memoizedState;
    for (let idx = 0; s && idx < 60; idx++, s = s.next) {
      if (looksLikeTokens(s.memoizedState)) { tokens = s.memoizedState; break; }
    }
  }
  if (!tokens) {
    return { error: 'Token data not found. Make sure the editor is fully loaded.' };
  }
  // 4. Save current playhead position so we can restore it
  const originalBeats = pc.getCurrentBeats();
  // 5. Convert beats -> real audio seconds using the playback controller
  function formatTime(seconds) {
    const totalMs = Math.round(seconds * 1000);
    const mins = Math.floor(totalMs / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
  function getTimestamp(beats) {
    pc.seek(beats);
    return formatTime(pc.getCurrentSeconds());
  }
  // 6. Extract all tokens
  const rawTokens = tokens.map((token, index) => {
    if (!token.timing) {
      return { index, text: token.text, timestamp: null };
    }
    const beats = token.timing.type === 'point'
      ? token.timing.beats
      : token.timing.startBeats;
    return { index, text: token.text, timestamp: getTimestamp(beats) };
  });
  // 7. Restore playhead
  pc.seek(originalBeats);
  // 8. Group syllables into words, words into lines
  const lines = [];
  let currentLine = [];
  let currentWord = '';
  let currentWordTs = null;
  for (const t of rawTokens) {
    if (t.text === '\\n') {
      if (currentWord) {
        currentLine.push({ word: currentWord, timestamp: currentWordTs });
        currentWord = '';
        currentWordTs = null;
      }
      lines.push(currentLine);
      currentLine = [];
    } else if (t.text === ' ') {
      if (currentWord) {
        currentLine.push({ word: currentWord, timestamp: currentWordTs });
        currentWord = '';
        currentWordTs = null;
      }
    } else {
      if (!currentWordTs && t.timestamp) currentWordTs = t.timestamp;
      currentWord += t.text;
    }
  }
  if (currentWord) currentLine.push({ word: currentWord, timestamp: currentWordTs });
  if (currentLine.length > 0) lines.push(currentLine);
  // 9. Format as plain text output
  const plainText = lines.map(line => {
    if (line.length === 0) return '';
    return line.map(w => `${w.timestamp ? '[' + w.timestamp + '] ' : ''}${w.word}`).join(' ');
  }).join('\\n');
  // 10. Format as SRT subtitle output (word-level)
  let srtIndex = 1;
  const srtLines = [];
  const allWords = lines.flat().filter(w => w.timestamp);
  for (let i = 0; i < allWords.length; i++) {
    const w = allWords[i];
    const nextTs = allWords[i + 1]?.timestamp;
    const toSrtTime = (ts) => ts.replace('.', ',').replace(/^(\\d{2}):/, '00:$1:');
    const endTs = nextTs ? toSrtTime(nextTs) : toSrtTime(w.timestamp); // same if last
    srtLines.push(`${srtIndex++}\\n${toSrtTime(w.timestamp)} --> ${endTs}\\n${w.word}\\n`);
  }
  return {
    success: true,
    tokenCount: rawTokens.filter(t => t.timestamp).length,
    plainText,
    srt: srtLines.join('\\n'),
    lines,
  };
}
// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    try {
      const result = extractLyricTimestamps();
      sendResponse(result);
    } catch (e) {
      sendResponse({ error: e.message });
    }
  }
  return true; // keep channel open for async
});