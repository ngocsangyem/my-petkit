// The reply decoder reads whatever a device in pairing mode notifies, so its
// input is anything a radio neighbour can send: it may return null, never throw.
// A seeded generator keeps the run reproducible; a failure prints the seed and
// the input as hex.

import { PK_MAGIC, pkJoinState, pkParse } from './provisioning-protocol';

/** mulberry32: a small deterministic PRNG, so a failing input can be replayed. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBytes(next: () => number, max: number): number[] {
  return Array.from({ length: Math.floor(next() * (max + 1)) }, () => Math.floor(next() * 256));
}

/** Framed (real header, random rest), raw bytes, or UTF-8 text that may look like JSON. */
function randomFrame(next: () => number): Uint8Array {
  const kind = next();
  if (kind < 0.4) return Uint8Array.from([...PK_MAGIC, ...randomBytes(next, 300)]);
  if (kind < 0.7) return Uint8Array.from(randomBytes(next, 300));
  const pieces = [
    '{',
    '}',
    '"key"',
    ':',
    '112',
    '"payload"',
    '{"state":',
    '7',
    ',',
    '[',
    ']',
    'null',
  ];
  const text = Array.from(
    { length: Math.floor(next() * 20) },
    () => pieces[Math.floor(next() * pieces.length)],
  ).join('');
  return new TextEncoder().encode(text);
}

const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

describe('pkParse on arbitrary input', () => {
  it('returns a message or null and never throws, nor does the join-state reader after it', () => {
    const seed = 0x5eed;
    const next = prng(seed);
    for (let i = 0; i < 5000; i++) {
      const frame = randomFrame(next);
      try {
        const doc = pkParse(frame);
        if (doc) pkJoinState(doc.payload);
      } catch (error) {
        throw new Error(`seed ${seed}, case ${i}, input ${hex(frame)}`, { cause: error });
      }
    }
  });
});
