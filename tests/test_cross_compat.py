"""Cross-compatibility tests: Python and JS must produce identical primes."""
import json
import subprocess
import sys
import zlib

import pytest

from godelify.core import METADATA_BITS, decode, encode
from gmpy2 import is_prime


JS_ENCODE = """\
const { bytesToBigInt, isPrime, METADATA_BITS } = require('./public/core.js');
const bytes = new Uint8Array(Buffer.from(process.argv[1], 'hex'));
const base  = bytesToBigInt(bytes) << METADATA_BITS;
let prime, metadata;
for (let m = 0n; m < (1n << METADATA_BITS); m++) {
  const c = base | m;
  if (isPrime(c)) { prime = c; metadata = m; break; }
}
console.log(JSON.stringify({ prime: prime.toString(), metadata: metadata.toString() }));
"""

PAYLOAD = b'#include <stdio.h>\nint main(){puts("hi");return 0;}\n'


def js_encode(payload: bytes) -> dict:
    """Run the JS encoding logic on raw payload bytes; returns {prime, metadata}."""
    result = subprocess.run(
        ["node", "-e", JS_ENCODE, payload.hex()],
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)


# ── uncompressed ──────────────────────────────────────────────────────────────

def test_uncompressed_prime_matches():
    py = encode.__wrapped__(PAYLOAD) if hasattr(encode, '__wrapped__') else None

    # Compute Python result directly (no file I/O)
    base = int.from_bytes(PAYLOAD, "big") << METADATA_BITS
    py_prime = py_meta = None
    for m in range(2 ** METADATA_BITS):
        c = base | m
        if is_prime(c):
            py_prime, py_meta = c, m
            break

    js = js_encode(PAYLOAD)

    assert str(py_prime) == js["prime"], "prime mismatch (uncompressed)"
    assert str(py_meta) == js["metadata"], "metadata mismatch (uncompressed)"


def test_compressed_prime_matches():
    compressed = zlib.compress(PAYLOAD)
    base = int.from_bytes(compressed, "big") << METADATA_BITS
    py_prime = py_meta = None
    for m in range(2 ** METADATA_BITS):
        c = base | m
        if is_prime(c):
            py_prime, py_meta = c, m
            break

    js = js_encode(compressed)

    assert str(py_prime) == js["prime"], "prime mismatch (compressed payload)"
    assert str(py_meta) == js["metadata"], "metadata mismatch (compressed payload)"


# ── cross-decode ──────────────────────────────────────────────────────────────

def test_python_decode_of_js_prime():
    """Python should recover the original bytes from a prime the JS encoder found."""
    js = js_encode(PAYLOAD)
    prime = int(js["prime"])
    # uncompressed: recover via shift + to_bytes
    shifted = prime >> METADATA_BITS
    nbytes = len(PAYLOAD)
    recovered = shifted.to_bytes(nbytes, byteorder="big")
    assert recovered == PAYLOAD


def test_js_roundtrip_prime_is_valid():
    """The prime the JS encoder produces must be a genuine prime."""
    js = js_encode(PAYLOAD)
    assert is_prime(int(js["prime"]))
