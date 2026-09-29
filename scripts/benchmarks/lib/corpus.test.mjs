import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DOC_JOB_TIERS,
  SIZE_TIERS,
  generateSyntheticDocument,
  mulberry32,
} from './corpus.mjs';

test('mulberry32 is a deterministic PRNG', () => {
  const a = mulberry32(1234);
  const b = mulberry32(1234);
  const seqA = [a(), a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  for (const value of seqA) {
    assert.ok(value >= 0 && value < 1);
  }
});

test('same seed and size produce byte-identical synthetic text (deterministic corpus)', () => {
  assert.equal(generateSyntheticDocument(7, 4096), generateSyntheticDocument(7, 4096));
});

test('generated document has the exact requested size and a different seed changes it', () => {
  const text = generateSyntheticDocument(7, 4096);
  assert.equal(text.length, 4096);
  assert.notEqual(text, generateSyntheticDocument(8, 4096));
});

test('generated corpus contains recognisable synthetic privacy patterns (no real PHI)', () => {
  const text = generateSyntheticDocument(470_000, 20 * 1024);
  assert.match(text, / \d{1,2}\/\d{1,2}\/\d{4} /); // dates
  assert.match(text, /(Dr\.|Dra\.)/); // professional markers
  assert.ok(text.includes('Hospital')); // locations
});

test('benchmark scenario tiers match SPEC_V4_QUALITY_SECURITY_DEPLOY §8', () => {
  assert.deepEqual(
    SIZE_TIERS.map((tier) => tier.name),
    ['10KB', '100KB', '500KB', '1MB']
  );
  assert.equal(SIZE_TIERS[3].targetSize, 1024 * 1024); // supported maximum
  assert.deepEqual(
    DOC_JOB_TIERS.map((tier) => tier.documents),
    [1, 10, 50]
  );
});
