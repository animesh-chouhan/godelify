# AGENTS.md

Reference for AI agents working on this codebase.

---

## What this project does

godelify encodes any file as a prime integer and recovers it exactly. The encoding is:

1. Read file bytes
2. Compress with zlib (optional, default on)
3. Interpret compressed bytes as big integer `N`
4. Shift left by `METADATA_BITS` (32): `base = N << 32`
5. Iterate `metadata = 0, 1, 2, ...` and test `base | metadata` for primality
6. Return the first prime found, along with the metadata value

Recovery (compressed): `zlib.decompress(prime >> 32)` — the prime is **self-contained** when compression is on, because zlib output always starts with a non-zero byte (`0x78`), so no leading bytes are lost in the big-integer round-trip. `bit_length()` recovers the exact byte count without needing to store it externally.

Recovery (uncompressed): caller must supply `original_size`; the prime alone is insufficient.

---

## Project structure

```text
godelify/
├── godelify/
│   ├── __init__.py   # re-exports encode, decode
│   ├── core.py       # encode(), decode(), prime_rank(), prime_rank_estimate()
│   └── cli.py        # argparse CLI with encode / decode subcommands
├── tests/
│   ├── __init__.py
│   └── test_core.py  # 13 pytest tests covering encode, decode, roundtrip, compression, decimal output
├── examples/
│   ├── factorial.c   # small C program used as real test input
│   ├── complex.c     # larger C program for benchmarking
│   ├── sample.py     # demo script: encode + decode + binary + rank
│   └── benchmark.py  # timing benchmark across N runs
├── docs/
│   └── optimizations.md  # prioritized optimization roadmap
├── public/
│   ├── index.html    # web UI markup
│   ├── style.css     # dark grey + cream theme
│   ├── godelify.js   # encode/decode logic for browser; spawns worker.js for encode
│   └── worker.js     # Web Worker: Miller-Rabin + prime search (offloaded from main thread)
├── decss/
│   ├── css.c         # DeCSS descramble (Seth Schoen's haiku-song algorithm)
│   ├── rc4.c         # RC4 + CRC-32 reference implementation
│   └── README.md     # history and comparison of the two implementations
├── pyproject.toml    # build config, deps, entry point
└── README.md
```

---

## Environment

Uses `uv`. Requires `libgmp` system package for gmpy2.

```bash
# Ubuntu/Debian
sudo apt install libgmp-dev

uv venv
uv pip install -e ".[dev]"
```

To run tests:

```bash
uv run pytest tests/ -v
```

Install as a global binary:

```bash
uv tool install .
godelify encode examples/factorial.c
godelify decode <prime> -o recovered.c
```

---

## Key design decisions

- **`METADATA_BITS = 32`** — appending 32 bits gives ~4 billion candidates. The prime number theorem guarantees a prime within `ln(N)` attempts on average, so 32 bits is far more than needed for any realistic file size.
- **`gmpy2.is_prime`** — wraps GMP's Miller-Rabin; ~10-100x faster than `sympy.isprime` for large numbers. System `libgmp` is required.
- **`zlib` compression (default on)** — shrinks the payload before encoding, reducing the prime's magnitude and speeding up primality tests. Not beneficial for files under ~100 bytes.
- **Self-contained prime (compressed path)** — when compression is on, the prime carries its own size: `(prime >> 32).bit_length()` gives the exact compressed byte count. `decode()` does not need `original_size` in this mode.
- **`byteorder="big"`** — consistent across encode and decode. Do not change one without the other.
- **`prime_rank` is limited** — `sympy.primepi` is only feasible up to ~10^25. Real encoded primes are ~10^500+. Use `prime_rank_estimate()` for approximate rank via the prime number theorem.
- **Web Worker for encode** — the prime search blocks the CPU for seconds. `godelify.js` spawns `worker.js` so the main thread stays responsive. The worker imports pako via `importScripts`. Max file size is capped at 50 KB in the web UI.
- **Miller-Rabin in JS** — 13 fixed witnesses `[2,3,5,7,11,13,17,19,23,29,31,37,41]` are deterministic for n < 3.3×10²⁴; probabilistic (error < 4⁻¹³) beyond that.

---

## Where to make changes

| Goal | File |
| --- | --- |
| Change primality test or metadata bit width | `godelify/core.py` and `public/worker.js` |
| Change compression algorithm | `godelify/core.py` and `public/worker.js` — swap `zlib`/`pako` calls |
| Add CLI flags or subcommands | `godelify/cli.py` |
| Add support for non-C file types | No changes needed — encode/decode are format-agnostic |
| Add tests | `tests/test_core.py` |
| Add benchmarks | `examples/benchmark.py` |
| Change web UI layout or theme | `public/style.css` |
| Change web encode/decode logic | `public/godelify.js` (main thread) or `public/worker.js` (encode worker) |
| Change file size limit for web UI | `FILE_SIZE_LIMIT` constant in `public/godelify.js` |

---

## What to avoid

- Do not add a progress bar or logging inside `encode()` — keep core logic pure.
- Do not change `METADATA_BITS` without updating both `godelify/core.py` and `public/worker.js`, and any tests that assert on its range.
- Do not store the prime as a string in any serialization format — it must remain an `int` for the bit shift to work correctly.
- Do not call `prime_rank()` on primes from real file encodings — it will always exceed the `PRIMEPI_LIMIT` and raise. Use `prime_rank_estimate()` instead.
- zlib compresses poorly (or expands) files under ~100 bytes — tests for compression size reduction must use `examples/factorial.c` or larger, not the tiny `tmp_c_file` fixture.
- Do not share scope between `godelify.js` and `worker.js` — Web Workers have an isolated global. Functions needed in both must be duplicated (BigInt helpers are only in the worker; `bigIntToBytes` only in the main thread).
