# godelify

Encode any C source file as a prime number using Gödel numbering — fully reversible.

Inspired by [Gödel numbering](https://en.wikipedia.org/wiki/G%C3%B6del_numbering), a technique from mathematical logic where statements are encoded as unique integers. godelify compresses a C source file with zlib, treats the compressed bytes as a big integer, appends a small metadata suffix, and searches for a value that makes the whole thing prime.

```text
C source → zlib compress → bytes → integer → append metadata → prime integer
```

The prime uniquely contains the entire source. Strip the metadata bits, decompress, and you get the original file back exactly.

---

## Installation

Requires Python 3.10+, [uv](https://github.com/astral-sh/uv), and libgmp (for gmpy2).

```bash
# Ubuntu/Debian
sudo apt install libgmp-dev

# macOS
brew install gmp
```

```bash
git clone https://github.com/yourname/godelify
cd godelify
uv venv
uv pip install -e ".[dev]"
```

---

## Usage

### Encode a C file to a prime

```bash
godelify encode program.c
```

```text
Prime      : 237006...
Metadata   : 18472
Size (bytes): 198
Compressed : True
```

```bash
# Without compression
godelify encode program.c --no-compress
```

### Recover the original file

```bash
godelify decode <prime> <size> recovered.c
```

```bash
# If encoded without compression
godelify decode <prime> <size> recovered.c --no-compress
```

---

## How it works

1. Read the C file as raw bytes.
2. Compress with zlib (by default).
3. Interpret the compressed bytes as a big integer `N`.
4. Shift left by `METADATA_BITS` (default 32): `base = N << 32`.
5. Iterate `metadata` from `0` upward, testing `base | metadata` for primality using `gmpy2.is_prime`.
6. By the [prime number theorem](https://en.wikipedia.org/wiki/Prime_number_theorem), a prime is found within ~`ln(N)` candidates on average — typically a few thousand iterations.
7. Return the prime and the metadata value needed to recover the original.

Recovery: shift the prime right by 32 bits → decompress → original bytes.

---

## Python API

```python
from godelify import encode, decode

# Compress + encode (default)
result = encode("program.c")
# result["prime"]              — the prime integer
# result["metadata"]           — the suffix appended
# result["program_size_bytes"] — encoded (compressed) size; needed for recovery
# result["compressed"]         — True

original_bytes = decode(result["prime"], result["program_size_bytes"])

# Without compression
result = encode("program.c", compress=False)
original_bytes = decode(result["prime"], result["program_size_bytes"], compressed=False)
```

---

## Tests

```bash
uv run pytest tests/ -v
```

---

## Limitations

- **File size is external** — you must store `program_size_bytes` alongside the prime to recover the file. The prime alone is not sufficient.
- **Compression overhead on tiny files** — zlib adds ~20 bytes of header; files under ~100 bytes may compress larger than the original. Use `--no-compress` for such cases.
- **Prime rank is not computable** — for real files the encoded prime is thousands of bits long (~10^500+), far beyond the range of any prime counting algorithm.
