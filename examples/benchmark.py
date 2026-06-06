"""Benchmarks encode() speed across available primality backends."""

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from godelify import encode

SAMPLE_C = os.path.join(os.path.dirname(__file__), "factorial.c")
RUNS = 5


def main():
    times = []
    for i in range(RUNS):
        start = time.perf_counter()
        encode(SAMPLE_C)
        elapsed = time.perf_counter() - start
        times.append(elapsed)
        print(f"  Run {i + 1}: {elapsed * 1000:.1f}ms")

    avg = sum(times) / len(times)
    print(f"\nAverage : {avg * 1000:.1f}ms over {RUNS} runs")
    print(f"Min     : {min(times) * 1000:.1f}ms")
    print(f"Max     : {max(times) * 1000:.1f}ms")


if __name__ == "__main__":
    print(f"Benchmarking encode() on {SAMPLE_C} ({RUNS} runs)\n")
    main()
