import pytest
from services.id_codec import encode, decode, PREFIXES


def test_encode_decode_roundtrip():
    ext = encode("tx_", 42)
    assert ext.startswith("tx_")
    prefix, internal = decode(ext)
    assert prefix == "tx_"
    assert internal == 42


def test_encode_different_ids_differ():
    assert encode("tx_", 1) != encode("tx_", 2)


def test_encode_different_prefixes_differ():
    assert encode("tx_", 1) != encode("hh_", 1)


def test_decode_invalid_raises():
    with pytest.raises(ValueError):
        decode("invalid_xyz")


def test_all_prefixes_roundtrip():
    for prefix in PREFIXES:
        ext = encode(prefix, 99)
        p, n = decode(ext)
        assert p == prefix
        assert n == 99
