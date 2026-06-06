# AGENTS.md

Reference for AI agents working on this codebase.

---

## What this project does

godelify encodes a C source file as a prime integer and recovers it exactly. The encoding is:

1. Read file bytes
2. Compress with zlib (optional, default on)
3. Interpret compressed bytes as big integer `N`
4. Shift left by `METADATA_BITS` (32): `base = N << 32`
5. Iterate `metadata = 0, 1, 2, ...` and test `base | metadata` for primality
6. Return the first prime found, along with the metadata value

Recovery: `zlib.decompress(prime >> METADATA_BITS)` gives back the original bytes (given the encoded size).

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
│   └── test_core.py  # 11 pytest tests covering encode, decode, roundtrip, compression
├── examples/
│   ├── factorial.c   # small C program used as real test input
│   ├── complex.c     # larger C program for benchmarking
│   ├── sample.py     # demo script: encode + decode + binary + rank
│   └── benchmark.py  # timing benchmark across N runs
├── docs/
│   └── optimizations.md  # prioritized optimization roadmap
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

---

## Key design decisions

- **`METADATA_BITS = 32`** — appending 32 bits gives ~4 billion candidates. The prime number theorem guarantees a prime within `ln(N)` attempts on average, so 32 bits is far more than needed for any realistic file size.
- **`gmpy2.is_prime`** — wraps GMP's Miller-Rabin; ~10-100x faster than `sympy.isprime` for large numbers. System `libgmp` is required.
- **`zlib` compression (default on)** — shrinks the payload before encoding, reducing the prime's magnitude and speeding up primality tests. Not beneficial for files under ~100 bytes.
- **File size is external** — `program_size_bytes` in the encode result is the encoded (compressed) size. Callers must store it alongside the prime. The prime alone is not sufficient for recovery.
- **`byteorder="big"`** — consistent across encode and decode. Do not change one without the other.
- **`prime_rank` is limited** — `sympy.primepi` is only feasible up to ~10^25. Real encoded primes are ~10^500+. Use `prime_rank_estimate()` for approximate rank via the prime number theorem.

---

## Where to make changes

| Goal | File |
| --- | --- |
| Change primality test or metadata bit width | `godelify/core.py` |
| Change compression algorithm | `godelify/core.py` — swap `zlib` import and calls |
| Add CLI flags or subcommands | `godelify/cli.py` |
| Add support for non-C file types | No changes needed — encode/decode are format-agnostic |
| Add tests | `tests/test_core.py` |
| Add benchmarks | `examples/benchmark.py` |

---

## What to avoid

- Do not add a progress bar or logging inside `encode()` — keep core logic pure.
- Do not change `METADATA_BITS` without updating the tests that assert on its range.
- Do not store the prime as a string in any serialization format — it must remain an `int` for the bit shift to work correctly.
- Do not call `prime_rank()` on primes from real file encodings — it will always exceed the `PRIMEPI_LIMIT` and raise. Use `prime_rank_estimate()` instead.
- zlib compresses poorly (or expands) files under ~100 bytes — tests for compression size reduction must use `examples/factorial.c` or larger, not the tiny `tmp_c_file` fixture.
