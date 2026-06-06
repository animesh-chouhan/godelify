"""Demonstrates encoding a C source file as a prime and recovering it exactly."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from godelify import encode, decode
from godelify.core import prime_rank, prime_rank_estimate

SAMPLE_C = os.path.join(os.path.dirname(__file__), "complex.c")


def main():
    print(f"Encoding: {SAMPLE_C}\n")

    original_bytes = open(SAMPLE_C, "rb").read()
    original_binary = bin(int.from_bytes(original_bytes, byteorder="big"))
    print(f"Source binary: {original_binary}\n")

    result = encode(SAMPLE_C)
    print(f"Prime number: {result['prime']}\n")
    print(f"Prime binary: {result['binary']}\n")
    print(f"Metadata : {result['metadata']}")
    print(f"Size     : {result['program_size_bytes']} bytes")

    try:
        rank = prime_rank(result["prime"])
        print(f"Rank     : {rank}th prime")
    except ValueError:
        estimate = prime_rank_estimate(result["prime"])
        print(f"Rank     : {estimate}th prime (estimated via prime number theorem)")
    print()

    recovered = decode(result["prime"], result["program_size_bytes"])

    if recovered == original_bytes:
        print("Roundtrip OK — recovered bytes match original exactly.")
    else:
        print("ERROR: recovered bytes do not match original.")
        sys.exit(1)


if __name__ == "__main__":
    main()
