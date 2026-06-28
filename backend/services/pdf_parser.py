import io
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional

import pdfplumber

from services.text_utils import normalize_desc, dedupe_hash


@dataclass
class InstallmentData:
    descripcion: str
    monto_total: int
    cuota_actual: int
    cuotas_totales: int
    valor_cuota_mensual: int


@dataclass
class ParsedItem:
    fecha_operacion: date
    descripcion_raw: str
    descripcion_norm: str
    lugar: Optional[str]
    monto: int
    tipo_movimiento: str  # compra | abono | impuesto | cuota | interno
    es_interno: bool
    es_hogar: bool
    incluido: bool
    installment: Optional[InstallmentData]
    hash_dedupe: str
    es_duplicado_posible: bool = False


@dataclass
class BatchMeta:
    titular: Optional[str]
    ultimos_digitos: Optional[str]
    periodo_desde: Optional[date]
    periodo_hasta: Optional[date]
    total_facturado_declarado: Optional[int]


@dataclass
class ParseResult:
    meta: BatchMeta
    items: list[ParsedItem]
    cuadre_ok: bool
    advertencia: Optional[str]


_DATE_RE = re.compile(r"\b(\d{2}/\d{2}/\d{4})\b")
_CUOTA_RATIO_RE = re.compile(r"\b(\d{1,2})/(\d{2})\b")
_AMOUNT_IN_LINE_RE = re.compile(r"\$\s*(-?[\d\.]+)")
_PERIODO_RE = re.compile(r"(\d{2}/\d{2}/\d{4})\s+al\s+(\d{2}/\d{2}/\d{4})", re.IGNORECASE)
_TITULAR_RE = re.compile(r"NOMBRE DEL TITULAR[:\s]+(.+)", re.IGNORECASE)
_TARJETA_RE = re.compile(r"N[ºO°]\s*DE\s*TARJETA[:\s]+.*?(\d{4})\b", re.IGNORECASE)
_TOTAL_FACTURADO_RE = re.compile(r"MONTO TOTAL FACTURADO A PAGAR\s+\$\s*([\d\.]+)", re.IGNORECASE)

_INTERNO_KEYWORDS = ("MONTO CANCELADO",)
_IMPUESTO_KEYWORDS = ("IMPTO. DECRETO LEY", "IMPTO DECRETO LEY")
_ABONO_KEYWORDS = ("NOTA DE CREDITO", "NOTA DE CRÉDITO")

_SECTION_3_RE = re.compile(r"3\.\s+CARGOS", re.IGNORECASE)
_SECTION_4_RE = re.compile(r"4\.\s+INFORMACION\s+COMPRAS\s+EN\s+CUOTAS", re.IGNORECASE)


def _parse_monto_clp(s: str) -> int:
    s = s.strip()
    if not s:
        return 0
    negative = "-" in s
    digits = re.sub(r"[^\d]", "", s)
    if not digits:
        return 0
    value = int(digits)
    return -value if negative else value


def _parse_fecha(s: str) -> Optional[date]:
    try:
        return datetime.strptime(s.strip(), "%d/%m/%Y").date()
    except ValueError:
        return None


def _extract_all_lines(pdf_bytes: bytes) -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
            lines.extend(text.splitlines())
    return lines


def _parse_meta(lines: list[str]) -> BatchMeta:
    titular = None
    ultimos_digitos = None
    periodo_desde = None
    periodo_hasta = None
    total_facturado_declarado = None

    for line in lines:
        if m := _TITULAR_RE.search(line):
            titular = m.group(1).strip()
        if m := _TARJETA_RE.search(line):
            ultimos_digitos = m.group(1)
        if m := _PERIODO_RE.search(line):
            periodo_desde = _parse_fecha(m.group(1))
            periodo_hasta = _parse_fecha(m.group(2))
        if m := _TOTAL_FACTURADO_RE.search(line):
            total_facturado_declarado = _parse_monto_clp(m.group(1))

    return BatchMeta(
        titular=titular,
        ultimos_digitos=ultimos_digitos,
        periodo_desde=periodo_desde,
        periodo_hasta=periodo_hasta,
        total_facturado_declarado=total_facturado_declarado,
    )


def _section_index(lines: list[str], pattern: re.Pattern) -> int:
    for i, line in enumerate(lines):
        if pattern.search(line):
            return i
    return len(lines)


def _parse_transaction_line(line: str) -> Optional[ParsedItem]:
    """
    Parse a single text line from section 1 or section 3.
    A transaction line contains a date (dd/mm/yyyy) and at least one $ amount.

    Santander layout (left to right per line):
      [LUGAR]  [dd/mm/aaaa]  [DESCRIPCION ...]  [$ monto]
    For installments also:
      ... [ORIGEN] [$ monto_origen] [$ monto_total] [NN/TT] [$ valor_cuota]

    Strategy:
    1. Find the date — everything before it is LUGAR, everything after starts DESCRIPCION.
    2. Extract all $ amounts in order.
    3. If a NN/TT pattern exists (cuota ratio), it's an installment row.
    4. The last $ amount is the transaction monto (cuota or monto simple).
    """
    date_match = _DATE_RE.search(line)
    if not date_match:
        return None

    fecha = _parse_fecha(date_match.group(1))
    if not fecha:
        return None

    lugar_raw = line[:date_match.start()].strip() or None
    after_date = line[date_match.end():].strip()

    amounts = [_parse_monto_clp(m) for m in _AMOUNT_IN_LINE_RE.findall(after_date)]
    if not amounts:
        return None

    cuota_match = _CUOTA_RATIO_RE.search(after_date)
    is_installment = cuota_match is not None

    # Remove amount tokens from description to get clean text
    desc_raw = _AMOUNT_IN_LINE_RE.sub("", after_date)
    desc_raw = _CUOTA_RATIO_RE.sub("", desc_raw)
    desc_raw = re.sub(r"\$", "", desc_raw)
    desc_raw = re.sub(r"\s{2,}", " ", desc_raw).strip()

    if not desc_raw:
        return None

    desc_norm = normalize_desc(desc_raw)

    # Classify tipo_movimiento
    desc_upper = desc_raw.upper()
    if any(k in desc_upper for k in _INTERNO_KEYWORDS):
        tipo = "interno"
        es_interno = True
        es_hogar = False
        monto = amounts[-1]
    elif any(k in desc_upper for k in _IMPUESTO_KEYWORDS):
        tipo = "impuesto"
        es_interno = False
        es_hogar = True
        monto = amounts[-1]
    elif any(k in desc_upper for k in _ABONO_KEYWORDS):
        tipo = "abono"
        es_interno = False
        es_hogar = True
        monto = amounts[-1]  # should be negative
    elif is_installment:
        tipo = "cuota"
        es_interno = False
        es_hogar = True
        monto = amounts[-1]  # valor_cuota_mensual
    else:
        tipo = "compra" if amounts[-1] >= 0 else "abono"
        es_interno = False
        es_hogar = True
        monto = amounts[-1]

    installment = None
    if is_installment and len(amounts) >= 3:
        cuota_actual = int(cuota_match.group(1))
        cuotas_totales = int(cuota_match.group(2))
        monto_total = amounts[0]
        valor_cuota = amounts[-1]
        installment = InstallmentData(
            descripcion=desc_norm,
            monto_total=monto_total,
            cuota_actual=cuota_actual,
            cuotas_totales=cuotas_totales,
            valor_cuota_mensual=valor_cuota,
        )

    hash_d = dedupe_hash(fecha, monto, desc_norm)

    return ParsedItem(
        fecha_operacion=fecha,
        descripcion_raw=desc_raw,
        descripcion_norm=desc_norm,
        lugar=lugar_raw,
        monto=monto,
        tipo_movimiento=tipo,
        es_interno=es_interno,
        es_hogar=es_hogar,
        incluido=not es_interno,
        installment=installment,
        hash_dedupe=hash_d,
    )


def parse_pdf_bytes(pdf_bytes: bytes) -> ParseResult:
    lines = _extract_all_lines(pdf_bytes)
    meta = _parse_meta(lines)

    sec3_idx = _section_index(lines, _SECTION_3_RE)
    sec4_idx = _section_index(lines, _SECTION_4_RE)

    # Section 1 = lines 0..sec3_idx; Section 3 = sec3_idx..sec4_idx
    sec1_lines = lines[:sec3_idx]
    sec3_lines = lines[sec3_idx:sec4_idx]

    items: list[ParsedItem] = []

    for line in sec1_lines + sec3_lines:
        item = _parse_transaction_line(line)
        if item:
            items.append(item)

    # Validate cuadre
    cuadre_ok = True
    advertencia = None
    if meta.total_facturado_declarado is not None:
        total_items = sum(
            i.monto for i in items
            if not i.es_interno and i.monto > 0
        )
        if total_items != meta.total_facturado_declarado:
            cuadre_ok = False
            advertencia = (
                f"Cuadre no coincide: suma items=${total_items:,} "
                f"vs declarado=${meta.total_facturado_declarado:,}"
            )

    return ParseResult(meta=meta, items=items, cuadre_ok=cuadre_ok, advertencia=advertencia)
