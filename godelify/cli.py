import argparse
import sys
from .core import encode, decode


def main():
    parser = argparse.ArgumentParser(
        prog="godelify",
        description="Encode a C source file as a prime number, or recover it.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    enc = sub.add_parser("encode", help="Encode a C file to a prime number")
    enc.add_argument("file", help="Path to the C source file")
    enc.add_argument("--no-compress", action="store_true", help="Disable zlib compression before encoding")

    dec = sub.add_parser("decode", help="Recover a C file from a prime number")
    dec.add_argument("prime", type=int, help="The prime number")
    dec.add_argument("size", type=int, help="Encoded size in bytes (program_size_bytes from encode output)")
    dec.add_argument("output", help="Output file path")
    dec.add_argument("--no-compress", action="store_true", help="Disable decompression after decoding")

    args = parser.parse_args()

    if args.command == "encode":
        result = encode(args.file, compress=not args.no_compress)
        print(f"Prime      : {result['prime']}")
        print(f"Metadata   : {result['metadata']}")
        print(f"Size (bytes): {result['program_size_bytes']}")
        print(f"Compressed : {result['compressed']}")

    elif args.command == "decode":
        data = decode(args.prime, args.size, compressed=not args.no_compress)
        with open(args.output, "wb") as f:
            f.write(data)
        print(f"Recovered {len(data)} bytes → {args.output}")


if __name__ == "__main__":
    main()
