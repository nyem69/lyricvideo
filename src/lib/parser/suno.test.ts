import { describe, it, expect } from 'vitest';
import { parseSunoTimestamps } from './suno';

describe('parseSunoTimestamps', () => {
  it('parses a single line with word timestamps', () => {
    const input = '[00:11.162] Sembah [00:11.392] berlalu [00:11.776] ramadhan [00:15.083] suci';
    const result = parseSunoTimestamps(input);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].lines).toHaveLength(1);
    const line = result.sections[0].lines[0];
    expect(line.text).toBe('Sembah berlalu ramadhan suci');
    expect(line.words).toHaveLength(4);
    expect(line.words[0]).toEqual({ text: 'Sembah', startTime: 11.162 });
    expect(line.words[3]).toEqual({ text: 'suci', startTime: 15.083 });
    expect(line.startTime).toBe(11.162);
  });

  it('parses multiple lines into one section', () => {
    const input = `[00:11.162] Sembah [00:11.392] berlalu [00:11.776] ramadhan [00:15.083] suci
[00:15.776] Berkah [00:16.314] amalan [00:16.776] meruntun [00:17.315] jiwa`;
    const result = parseSunoTimestamps(input);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].lines).toHaveLength(2);
    expect(result.sections[0].lines[1].text).toBe('Berkah amalan meruntun jiwa');
  });

  it('splits sections on blank lines', () => {
    const input = `[00:11.162] Sembah [00:11.392] berlalu

[00:46.515] Jari [00:47.137] disusun`;
    const result = parseSunoTimestamps(input);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].lines).toHaveLength(1);
    expect(result.sections[1].lines).toHaveLength(1);
  });

  it('strips annotation markers', () => {
    const input = '[02:26.650] Buat [02:27.033] insan  ← (also: [02:30.361] telah)';
    const result = parseSunoTimestamps(input);
    expect(result.sections[0].lines[0].text).toBe('Buat insan');
  });

  it('skips title metadata lines', () => {
    const input = `[00:11.162] [Title: Semurni Lebaran 3]
[00:11.162] Sembah [00:11.392] berlalu`;
    const result = parseSunoTimestamps(input);
    expect(result.title).toBe('Semurni Lebaran 3');
    expect(result.sections[0].lines).toHaveLength(1);
  });

  it('computes section start/end times', () => {
    const input = `[00:11.162] Sembah [00:15.083] suci
[00:15.776] Berkah [00:17.315] jiwa

[00:46.515] Jari [00:48.852] dipohon`;
    const result = parseSunoTimestamps(input);
    expect(result.sections[0].startTime).toBe(11.162);
    expect(result.sections[0].endTime).toBe(46.515);
    expect(result.sections[1].startTime).toBe(46.515);
  });

  it('converts mm:ss.mmm to seconds correctly', () => {
    const input = '[01:03.542] Buat [01:03.932] insan';
    const result = parseSunoTimestamps(input);
    expect(result.sections[0].lines[0].words[0].startTime).toBeCloseTo(63.542);
  });

  it('handles empty input', () => {
    const result = parseSunoTimestamps('');
    expect(result.sections).toHaveLength(0);
  });
});
