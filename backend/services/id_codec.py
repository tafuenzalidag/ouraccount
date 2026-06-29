import os
import random
from sqids import Sqids

_DEFAULT_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

PREFIXES = {
    "us_", "hh_", "hm_", "pm_", "tx_", "ib_",
    "cat_", "ip_", "set_", "mr_", "ddp_",
}


def _build() -> Sqids:
    secret = os.environ.get("SQIDS_SECRET", "nuestracuenta-dev")
    chars = list(_DEFAULT_ALPHABET)
    random.Random(secret).shuffle(chars)
    return Sqids(alphabet="".join(chars), min_length=4)


_sqids = _build()


def encode(prefix: str, internal_id: int) -> str:
    return prefix + _sqids.encode([internal_id])


def decode(external_id: str) -> tuple[str, int]:
    for prefix in PREFIXES:
        if external_id.startswith(prefix):
            part = external_id[len(prefix):]
            ids = _sqids.decode(part)
            if ids:
                return prefix, ids[0]
    raise ValueError(f"Invalid external ID: {external_id!r}")
