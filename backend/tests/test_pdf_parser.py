import hashlib
from datetime import date
from services.text_utils import normalize_desc, dedupe_hash


def test_normalize_removes_mp_prefix():
    assert normalize_desc("MP*CASAVINTE") == "CASAVINTE"


def test_normalize_removes_mercadopago_prefix():
    assert normalize_desc("MERCADOPAGO*MERCADOLIBRE") == "MERCADOLIBRE"


def test_normalize_removes_merpago_prefix():
    assert normalize_desc("MERPAGO*TIENDA") == "TIENDA"


def test_normalize_removes_dp_prefix():
    assert normalize_desc("DP *CINEMA") == "CINEMA"


def test_normalize_removes_flow_prefix():
    assert normalize_desc("FLOW *SAMSUNG") == "SAMSUNG"


def test_normalize_removes_pedidosya_prefix():
    assert normalize_desc("PedidosYa*Propina") == "PROPINA"


def test_normalize_upcases_result():
    assert normalize_desc("jumbo alto las condes") == "JUMBO ALTO LAS CONDES"


def test_normalize_no_prefix_unchanged():
    assert normalize_desc("MACONLINE") == "MACONLINE"


def test_dedupe_hash_is_deterministic():
    h1 = dedupe_hash(date(2026, 5, 15), 45000, "CASAVINTE")
    h2 = dedupe_hash(date(2026, 5, 15), 45000, "CASAVINTE")
    assert h1 == h2


def test_dedupe_hash_differs_by_date():
    h1 = dedupe_hash(date(2026, 5, 15), 45000, "CASAVINTE")
    h2 = dedupe_hash(date(2026, 5, 16), 45000, "CASAVINTE")
    assert h1 != h2


def test_dedupe_hash_is_32_chars():
    h = dedupe_hash(date(2026, 5, 15), 45000, "CASAVINTE")
    assert len(h) == 32


from services.pdf_parser import _parse_monto_clp, _parse_fecha


def test_parse_monto_simple():
    assert _parse_monto_clp("$ 45.000") == 45000


def test_parse_monto_grande():
    assert _parse_monto_clp("$ 1.268.949") == 1268949


def test_parse_monto_negativo():
    assert _parse_monto_clp("$ -499.990") == -499990


def test_parse_monto_sin_signo_pesos():
    assert _parse_monto_clp("52.873") == 52873


def test_parse_monto_string_vacio():
    assert _parse_monto_clp("") == 0


def test_parse_fecha_valida():
    assert _parse_fecha("15/05/2026") == date(2026, 5, 15)


def test_parse_fecha_invalida():
    assert _parse_fecha("no-es-fecha") is None


def test_parse_fecha_formato_incorrecto():
    assert _parse_fecha("2026-05-15") is None
