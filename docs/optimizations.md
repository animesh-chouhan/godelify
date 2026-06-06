# Optimization Roadmap

Prioritized list of concrete improvements to godelify's performance, API, and developer experience.

---

## 1. Use `gmpy2.next_prime` to skip the search loop (highest impact)

Instead of iterating `metadata = 0, 1, 2, ...` and calling `is_prime` on each candidate, compute the next prime directly:

```python
from gmpy2 import next_prime

p = next_prime(base)
if p - base < 2 ** METADATA_BITS:
    metadata = int(p - base)
```

This replaces thousands of `is_prime` calls with a single GMP call and is dramatically faster. Only fall back to the current loop if `next_prime(base) - base >= 2**METADATA_BITS` (extremely unlikely in practice).

**Change target:** `godelify/core.py` — `encode()`.

---

## 2. Fallback to incremental search when `next_prime` overflows metadata range

If `next_prime(base) - base >= 2**METADATA_BITS`, fall back to the current `is_prime` loop constrained to the metadata range. In practice this should never trigger for any realistic file, but the fallback preserves correctness.

---

## 3. Remove `binary` from `encode()` return by default

`bin(candidate)` on a 1800-bit prime produces a ~1800-character string on every encode call, even when the caller doesn't need it. Move it behind an opt-in flag:

```python
encode(filename, compress=True, verbose=False)
# only includes "binary" in result when verbose=True
```

---

## 4. Parallel / batched candidate checking

If not using `next_prime`, test metadata candidates in chunks across processes with `multiprocessing`. Each worker gets a slice of the metadata range. Less impactful than option 1 (GMP's `next_prime` is already parallelized internally) but useful as a fallback path.

---

## 5. Configurable Miller-Rabin rounds

Expose an option to use faster probable-prime checks with fewer rounds for extreme throughput cases where a small false-positive rate is acceptable:

```python
encode(filename, mr_rounds=25)  # default; increase for stronger guarantee
```

---

## 6. Add `encode_bytes(data: bytes)` to the public API

Allow library consumers to encode raw bytes without writing to a file first:

```python
from godelify import encode_bytes, decode_bytes

result = encode_bytes(b"...", compress=True)
original = decode_bytes(result["prime"], result["program_size_bytes"])
```

**Change target:** `godelify/core.py` and `godelify/__init__.py`.

---

## 7. Better CLI flags and UX

Add:

- `--use-next-prime` — opt into the `gmpy2.next_prime` fast path (once implemented)
- `--no-compress` — already implemented
- `--verbose` — include binary representation in output
- `--timeout <seconds>` — abort if no prime found within limit
- Cleaner exit codes (0 = success, 1 = not found, 2 = bad args)

---

## 8. Document libgmp system dependency in README and packaging

`gmpy2` requires `libgmp`. Add install commands for major platforms and a note in `pyproject.toml`:

```text
# Ubuntu/Debian
sudo apt install libgmp-dev

# macOS
brew install gmp

# Windows
# install pre-built gmpy2 wheel from https://pypi.org/project/gmpy2/
```

---

## 9. GitHub Actions CI with benchmark job

Add `.github/workflows/ci.yml` with:

- Matrix: Python 3.10 / 3.11 / 3.12
- `uv run pytest tests/ -v`
- A lightweight benchmark that asserts encode time for `examples/factorial.c` stays under a threshold (e.g., 500ms)

---

## 10. API ergonomics — custom exception from `decode()`

`decode()` currently raises bare `OverflowError` when `size` is wrong. Replace with a clearer `ValueError`:

```python
raise ValueError(f"size {original_size} is too small for this prime — did you pass program_size_bytes from the encode result?")
```

---

## 11. Tests for edge and performance cases

- Assert that `encode()` with `next_prime` (once added) produces the same result as the loop
- Test encoding on a larger fixture (e.g., `examples/complex.c`) and assert roundtrip correctness
- Test fallback behaviour when `next_prime` would exceed `METADATA_BITS`

---

## Small code-level notes

- `prime_rank()` enforces a `PRIMEPI_LIMIT` but this is not documented in the function's docstring — add one.
- The `tmp_c_file` fixture (52 bytes) is too small for zlib to benefit; any test asserting compressed < uncompressed must use `examples/factorial.c` or larger.
