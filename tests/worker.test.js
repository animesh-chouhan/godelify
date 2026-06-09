const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  METADATA_BITS,
  bytesToBigInt,
  bigIntToBytes,
  modpow,
  millerRabinRound,
  isPrime,
} = require('../public/core.js');

// ── bytesToBigInt ─────────────────────────────────────────────────────────────

describe('bytesToBigInt', () => {
  test('empty array → 0n', () => {
    assert.strictEqual(bytesToBigInt(new Uint8Array([])), 0n);
  });

  test('[0x00] → 0n', () => {
    assert.strictEqual(bytesToBigInt(new Uint8Array([0x00])), 0n);
  });

  test('[0x01] → 1n', () => {
    assert.strictEqual(bytesToBigInt(new Uint8Array([0x01])), 1n);
  });

  test('[0xff] → 255n', () => {
    assert.strictEqual(bytesToBigInt(new Uint8Array([0xff])), 255n);
  });

  test('[0x01, 0x00] → 256n (big-endian)', () => {
    assert.strictEqual(bytesToBigInt(new Uint8Array([0x01, 0x00])), 256n);
  });

  test('[0xde, 0xad, 0xbe, 0xef] → 0xdeadbeefn', () => {
    assert.strictEqual(
      bytesToBigInt(new Uint8Array([0xde, 0xad, 0xbe, 0xef])),
      0xdeadbeefn,
    );
  });
});

// ── bigIntToBytes ─────────────────────────────────────────────────────────────

describe('bigIntToBytes', () => {
  test('0n → [0x00]', () => {
    assert.deepStrictEqual(bigIntToBytes(0n), new Uint8Array([0x00]));
  });

  test('255n → [0xff]', () => {
    assert.deepStrictEqual(bigIntToBytes(255n), new Uint8Array([0xff]));
  });

  test('256n → [0x01, 0x00]', () => {
    assert.deepStrictEqual(bigIntToBytes(256n), new Uint8Array([0x01, 0x00]));
  });

  test('0xdeadbeefn → [0xde, 0xad, 0xbe, 0xef]', () => {
    assert.deepStrictEqual(
      bigIntToBytes(0xdeadbeefn),
      new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    );
  });
});

// ── bytesToBigInt ↔ bigIntToBytes roundtrip ───────────────────────────────────

describe('bytesToBigInt ↔ bigIntToBytes roundtrip', () => {
  test('bytesToBigInt(bigIntToBytes(n)) === n', () => {
    for (const n of [1n, 255n, 256n, 0xdeadbeefn, 2n ** 64n - 1n]) {
      assert.strictEqual(bytesToBigInt(bigIntToBytes(n)), n);
    }
  });

  test('bigIntToBytes(bytesToBigInt(bytes)) deep-equals bytes (no leading zeros)', () => {
    const bytes = new Uint8Array([0xca, 0xfe, 0xba, 0xbe, 0x01, 0x23]);
    assert.deepStrictEqual(bigIntToBytes(bytesToBigInt(bytes)), bytes);
  });
});

// ── modpow ────────────────────────────────────────────────────────────────────

describe('modpow', () => {
  test('any base to the 0 is 1', () => {
    assert.strictEqual(modpow(7n, 0n, 100n), 1n);
  });

  test('2^10 mod 1000 = 24', () => {
    assert.strictEqual(modpow(2n, 10n, 1000n), 24n);
  });

  test('3^100 mod 97 = 81 (Fermat: 3^96 ≡ 1, 3^4 = 81)', () => {
    assert.strictEqual(modpow(3n, 100n, 97n), 81n);
  });

  test('base mod mod = 0 when base is a multiple', () => {
    assert.strictEqual(modpow(10n, 3n, 10n), 0n);
  });
});

// ── millerRabinRound ──────────────────────────────────────────────────────────

describe('millerRabinRound', () => {
  test('returns true when n equals the witness', () => {
    assert.strictEqual(millerRabinRound(7n, 7), true);
    assert.strictEqual(millerRabinRound(13n, 13), true);
  });

  test('accepts prime 97 for witnesses 2, 3, 5, 7', () => {
    for (const w of [2, 3, 5, 7])
      assert.strictEqual(millerRabinRound(97n, w), true, `witness ${w}`);
  });

  test('rejects composite 9 for witness 2', () => {
    assert.strictEqual(millerRabinRound(9n, 2), false);
  });
});

// ── isPrime ───────────────────────────────────────────────────────────────────

describe('isPrime', () => {
  test('rejects 0 and 1', () => {
    assert.strictEqual(isPrime(0n), false);
    assert.strictEqual(isPrime(1n), false);
  });

  test('accepts small primes', () => {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 97, 1009];
    for (const p of primes)
      assert.strictEqual(isPrime(BigInt(p)), true, `${p} should be prime`);
  });

  test('rejects small composites', () => {
    const composites = [4, 6, 8, 9, 10, 15, 25, 35, 49, 100, 1001];
    for (const c of composites)
      assert.strictEqual(isPrime(BigInt(c)), false, `${c} should not be prime`);
  });

  test('rejects Carmichael number 561 = 3×11×17', () => {
    assert.strictEqual(isPrime(561n), false);
  });

  test('accepts Fermat prime 65537', () => {
    assert.strictEqual(isPrime(65537n), true);
  });

  test('accepts Mersenne prime 2^127 − 1', () => {
    assert.strictEqual(isPrime(170141183460469231731687303715884105727n), true);
  });

  test('rejects 2^128 (power of two)', () => {
    assert.strictEqual(isPrime(2n ** 128n), false);
  });

  test('rejects large semiprime (large prime)^2', () => {
    const p = 982451653n; // 50-millionth prime
    assert.strictEqual(isPrime(p), true);
    assert.strictEqual(isPrime(p * p), false);
  });
});

// ── encode structure (uncompressed roundtrip) ─────────────────────────────────

describe('encode/decode structure', () => {
  function findPrime(payload) {
    const base = bytesToBigInt(payload) << METADATA_BITS;
    for (let m = 0n; m < (1n << METADATA_BITS); m++) {
      const c = base | m;
      if (isPrime(c)) return { prime: c, metadata: m };
    }
    throw new Error('no prime found in metadata range');
  }

  test('result is prime', () => {
    const { prime } = findPrime(new Uint8Array([72, 101, 108, 108, 111])); // "Hello"
    assert.ok(isPrime(prime));
  });

  test('metadata is within 32-bit range', () => {
    const { metadata } = findPrime(new Uint8Array([1, 2, 3, 4]));
    assert.ok(metadata >= 0n && metadata < (1n << METADATA_BITS));
  });

  test('prime >> METADATA_BITS recovers the original payload', () => {
    const payload = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const { prime } = findPrime(payload);
    const recovered = bigIntToBytes(prime >> METADATA_BITS);
    assert.deepStrictEqual(recovered, payload);
  });

  test('different payloads produce different primes', () => {
    const p1 = findPrime(new Uint8Array([1, 2, 3])).prime;
    const p2 = findPrime(new Uint8Array([4, 5, 6])).prime;
    assert.notStrictEqual(p1, p2);
  });

  test('METADATA_BITS constant matches expected value', () => {
    assert.strictEqual(METADATA_BITS, 32n);
  });
});
