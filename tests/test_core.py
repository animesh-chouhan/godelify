import os
import zlib
import pytest
from sympy import isprime
from godelify.core import encode, decode, METADATA_BITS


SAMPLE_C = os.path.join(os.path.dirname(__file__), "..", "examples", "factorial.c")


@pytest.fixture
def tmp_c_file(tmp_path):
    src = tmp_path / "hello.c"
    src.write_bytes(b'#include <stdio.h>\nint main(){puts("hi");return 0;}\n')
    return str(src)


def test_encode_returns_prime(tmp_c_file):
    result = encode(tmp_c_file)
    assert isprime(result["prime"])


def test_encode_metadata_within_bounds(tmp_c_file):
    result = encode(tmp_c_file)
    assert 0 <= result["metadata"] < 2 ** METADATA_BITS


def test_encode_size_matches_file(tmp_c_file):
    result = encode(tmp_c_file, compress=False)
    assert result["program_size_bytes"] == os.path.getsize(tmp_c_file)


def test_encode_compressed_size_smaller():
    # factorial.c (223 bytes) is large enough that zlib saves space
    raw = encode(SAMPLE_C, compress=False)
    compressed = encode(SAMPLE_C, compress=True)
    assert compressed["program_size_bytes"] < raw["program_size_bytes"]
    assert compressed["compressed"] is True
    assert raw["compressed"] is False


def test_roundtrip(tmp_c_file):
    original = open(tmp_c_file, "rb").read()
    result = encode(tmp_c_file)
    recovered = decode(result["prime"], result["program_size_bytes"])
    assert recovered == original


def test_roundtrip_no_compress(tmp_c_file):
    original = open(tmp_c_file, "rb").read()
    result = encode(tmp_c_file, compress=False)
    recovered = decode(result["prime"], result["program_size_bytes"], compressed=False)
    assert recovered == original


def test_roundtrip_sample_c():
    original = open(SAMPLE_C, "rb").read()
    result = encode(SAMPLE_C)
    recovered = decode(result["prime"], result["program_size_bytes"])
    assert recovered == original


def test_prime_contains_source_bytes(tmp_c_file):
    original = open(tmp_c_file, "rb").read()
    result = encode(tmp_c_file, compress=False)
    embedded = (result["prime"] >> METADATA_BITS).to_bytes(
        result["program_size_bytes"], byteorder="big"
    )
    assert embedded == original


def test_prime_contains_compressed_bytes(tmp_c_file):
    original = open(tmp_c_file, "rb").read()
    result = encode(tmp_c_file, compress=True)
    embedded = (result["prime"] >> METADATA_BITS).to_bytes(
        result["program_size_bytes"], byteorder="big"
    )
    assert embedded == zlib.compress(original)


def test_encode_file_not_found():
    with pytest.raises(FileNotFoundError):
        encode("nonexistent.c")


def test_decode_wrong_size_raises(tmp_c_file):
    result = encode(tmp_c_file)
    with pytest.raises(OverflowError):
        decode(result["prime"], 1)
