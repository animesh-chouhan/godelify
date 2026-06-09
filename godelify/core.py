import math
import zlib

from gmpy2 import is_prime
from sympy.ntheory import primepi

METADATA_BITS = 32
PRIMEPI_LIMIT = 10**25


def encode(filename: str, compress: bool = True) -> dict:
    with open(filename, "rb") as f:
        data = f.read()

    payload = zlib.compress(data) if compress else data
    base = int.from_bytes(payload, byteorder="big") << METADATA_BITS

    for metadata in range(2**METADATA_BITS):
        candidate = base | metadata
        if is_prime(candidate):
            return {
                "prime": candidate,
                "metadata": metadata,
                "program_size_bytes": len(payload),
                "compressed": compress,
                "decimal": str(candidate),
                "binary": bin(candidate),
            }

    raise RuntimeError(f"No prime found with {METADATA_BITS} metadata bits.")


def decode(prime: int, original_size: int = None, compressed: bool = True) -> bytes:
    shifted = prime >> METADATA_BITS
    if original_size is None:
        if not compressed:
            raise ValueError("original_size is required when compressed=False")
        # zlib data always starts with a non-zero byte, so no leading bytes are
        # lost in the int conversion — the prime is self-contained when compressed.
        nbytes = (shifted.bit_length() + 7) // 8
    else:
        nbytes = original_size
    data = shifted.to_bytes(nbytes, byteorder="big")
    return zlib.decompress(data) if compressed else data


def prime_rank(prime: int) -> int:
    if prime > PRIMEPI_LIMIT:
        raise ValueError(
            f"prime_rank is only feasible for primes up to ~10^25; "
            f"this prime has {prime.bit_length()} bits (~10^{len(str(prime))-1} digits)."
        )
    return int(primepi(prime))  # pyright: ignore[reportArgumentType]


def prime_rank_estimate(prime: int) -> str:
    """Returns approximate rank in scientific notation using the prime number theorem π(p) ≈ p / ln(p)."""
    log_p = prime.bit_length() * math.log(2)
    log10_rank = math.log10(prime) - math.log10(log_p)
    exponent = int(log10_rank)
    mantissa = 10 ** (log10_rank - exponent)
    return f"~{mantissa:.2f}e+{exponent}"
