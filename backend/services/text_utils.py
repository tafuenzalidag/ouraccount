import hashlib
import re
from datetime import date

_GATEWAY_PREFIXES = re.compile(
    r"^(MP\*|MERCADOPAGO\*|MERPAGO\*|DP \*|FLOW \*|PedidosYa\*)",
    re.IGNORECASE,
)


def normalize_desc(desc: str) -> str:
    return _GATEWAY_PREFIXES.sub("", desc).strip().upper()


def dedupe_hash(fecha: date, monto: int, desc_norm: str) -> str:
    raw = f"{fecha}|{monto}|{desc_norm}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]
