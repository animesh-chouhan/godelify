const METADATA_BITS = 32n;
const WITNESSES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
const SMALL      = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];
const WITNESS_BIGINTS = WITNESSES.map(BigInt);

// precomputed byte → 2-char hex string
const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

function bytesToBigInt(bytes) {
  if (!bytes.length) return 0n;
  const parts = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) parts[i] = HEX[bytes[i]];
  return BigInt('0x' + parts.join(''));
}

function bigIntToBytes(n) {
  let hex = n.toString(16);
  if (hex.length & 1) hex = '0' + hex;
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(hex[i * 2] + hex[i * 2 + 1], 16);
  return out;
}

function modpow(base, exp, mod) {
  let r = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) r = r * base % mod;
    exp >>= 1n;
    base = base * base % mod;
  }
  return r;
}

// kept for tests / external use; isPrime uses an inlined, faster version
function millerRabinRound(n, a) {
  const A = BigInt(a);
  if (n === A) return true;
  const nMinus1 = n - 1n;
  let d = nMinus1, r = 0;                   // r as Number — faster loop counter
  while (!(d & 1n)) { d >>= 1n; r++; }
  let x = modpow(A, d, n);
  if (x === 1n || x === nMinus1) return true;
  for (let i = 0; i < r - 1; i++) {
    x = x * x % n;
    if (x === nMinus1) return true;
  }
  return false;
}

function isPrime(n) {
  if (n < 2n) return false;
  for (const s of SMALL) {
    if (n === s) return true;
    if (n % s === 0n) return false;
  }
  const nMinus1 = n - 1n;
  // factor n-1 = 2^r * d once — reused across all 13 witnesses
  let d = nMinus1, r = 0;
  while (!(d & 1n)) { d >>= 1n; r++; }
  for (const A of WITNESS_BIGINTS) {
    if (n === A) continue;
    let x = modpow(A, d, n);
    if (x === 1n || x === nMinus1) continue;
    let composite = true;
    for (let i = 0; i < r - 1; i++) {
      x = x * x % n;
      if (x === nMinus1) { composite = false; break; }
    }
    if (composite) return false;
  }
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = { METADATA_BITS, WITNESSES, SMALL, bytesToBigInt, bigIntToBytes, modpow, millerRabinRound, isPrime };
}
