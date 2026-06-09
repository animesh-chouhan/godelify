importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');
importScripts('core.js');

// All odd primes up to 7000 for fast Number-only trial division.
// Filters ~88% of odd candidates before the expensive Miller-Rabin step.
// Extending the limit further yields diminishing returns vs sieve overhead.
const SIEVE_PRIMES = (() => {
  const limit = 7000;
  const sieve = new Uint8Array(limit + 1);
  const out = [];
  for (let i = 3; i <= limit; i += 2) {
    if (!sieve[i]) {
      out.push(i);
      if (i * i <= limit)
        for (let j = i * i; j <= limit; j += i * 2) sieve[j] = 1;
    }
  }
  return out;
})();

self.onmessage = function(e) {
  const { fileBytes, compressOn } = e.data;
  try {
    self.postMessage({ type: 'status', msg: 'compressing…' });
    const bytes   = new Uint8Array(fileBytes);
    const payload = compressOn ? pako.deflate(bytes) : bytes;

    const sz   = `${payload.length} B`;
    // base has its lower 32 bits all zero (shifted left by METADATA_BITS = 32).
    // Therefore base | m  ≡  base + m  for any m < 2^32 (no bit overlap).
    const base = bytesToBigInt(payload) << METADATA_BITS;

    // Precompute base % p as a Number for each sieve prime.
    // (base + m) % p = (baseRem + m) % p — pure Number arithmetic, no BigInt.
    const nSieve   = SIEVE_PRIMES.length;
    const baseRems = new Int32Array(nSieve);
    for (let i = 0; i < nSieve; i++)
      baseRems[i] = Number(base % BigInt(SIEVE_PRIMES[i]));

    const startTime = Date.now();
    let prime, metadata, lastUpdate = 0, mrCount = 0;

    self.postMessage({ type: 'status', msg: `searching for prime (${sz})…` });

    // m is a Number — avoid BigInt in the outer loop entirely.
    // base + m is always odd when m is odd (base ends in 32 zero bits, m is odd).
    for (let m = 1; m < 4294967296; m += 2) {
      // fast Number-only sieve: reject composites divisible by any prime ≤ 1000
      let skip = false;
      for (let i = 0; i < nSieve; i++) {
        if ((baseRems[i] + m) % SIEVE_PRIMES[i] === 0) { skip = true; break; }
      }
      if (skip) continue;

      // ~8% of candidates reach here — convert to BigInt and run Miller-Rabin
      mrCount++;
      const mBig = BigInt(m);
      const c    = base + mBig;
      if (isPrimeMR(c)) { prime = c; metadata = mBig; break; }

      // check after each MR test — MR is the slow step so this fires at the
      // natural search pace and gives smooth progress updates
      const now = Date.now();
      if (now - lastUpdate >= 120) {
        const rate = Math.round(mrCount / ((now - startTime) / 1000));
        self.postMessage({ type: 'status', msg: `searching for prime (${sz})… ${mrCount} tested, ${rate}/s` });
        lastUpdate = now;
      }
    }

    self.postMessage({
      type:          'result',
      prime:         prime.toString(),
      metadata:      metadata.toString(),
      payloadLength: payload.length,
    });
  } catch (err) {
    self.postMessage({ type: 'error', msg: err.message });
  }
};
