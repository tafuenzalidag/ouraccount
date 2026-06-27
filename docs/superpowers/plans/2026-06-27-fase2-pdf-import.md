# Fase 2 — PDF Import: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir subir la cartola PDF de Santander, ver un preview editable de los movimientos y confirmar la importación, creando transactions + installment_plans + split_allocations en la base de datos.

**Architecture:** El PDF se procesa in-memory con pdfplumber en el backend (FastAPI); el endpoint de preview crea un `ImportBatch(estado="preview")` y devuelve los items parseados como JSON. El frontend mantiene el estado del preview (edits del usuario). El endpoint de confirm recibe los items editados y persiste las transacciones. No se guarda el PDF en ningún momento.

**Tech Stack:** pdfplumber 0.11.4 (ya en requirements.txt), FastAPI multipart upload, Next.js 16 App Router con Tailwind v4 + shadcn/ui v4.

## Global Constraints

- Python 3.12, FastAPI 0.115, SQLAlchemy 2.x, Pydantic v2 — no cambiar versiones.
- Montos siempre en CLP como entero (`int`, nunca `float`). Negativos = abono.
- `hash_dedupe = sha256(f"{fecha}|{monto}|{desc_norm}").hexdigest()[:32]` — no cambiar fórmula.
- Prefijos a normalizar: `MP*`, `MERCADOPAGO*`, `MERPAGO*`, `DP *`, `FLOW *`, `PedidosYa*`.
- `payer_user_id` es obligatorio en el confirm — no asumir que es el usuario que llama.
- Auth: Bearer JWT en todos los endpoints (`get_current_user` dependency).
- CORS ya configurado; no tocar `main.py` salvo para registrar el router.
- Tests corren con: `DATABASE_URL=sqlite:///./test.db pytest tests/ -v` desde `backend/`.
- Frontend: `apiFetch<T>` de `@/lib/api` para todas las llamadas; `getToken()`/`getHouseholdId()` dentro de `useEffect`.
- No persistir el PDF crudo en ningún lugar (ni tmp, ni DB, ni filesystem).

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/services/text_utils.py` | Crear | `normalize_desc`, `dedupe_hash` — funciones puras compartidas |
| `backend/services/pdf_parser.py` | Crear | `parse_pdf_bytes` — parser pdfplumber Santander, retorna `ParseResult` |
| `backend/services/categorizer.py` | Crear | `apply_category` — reglas semilla + lookup MerchantRule DB |
| `backend/schemas/imports.py` | Crear | Schemas Pydantic para preview y confirm |
| `backend/routers/imports.py` | Crear | `POST /api/households/{id}/imports` y `POST /api/imports/{id}/confirm` |
| `backend/tests/test_pdf_parser.py` | Crear | Tests unitarios de text_utils + pdf_parser helpers |
| `backend/tests/test_categorizer.py` | Crear | Tests de categorizer |
| `backend/tests/test_imports.py` | Crear | Tests de integración para ambos endpoints |
| `backend/routers/transactions.py` | Modificar | Importar `normalize_desc`/`dedupe_hash` desde `text_utils` (DRY) |
| `backend/main.py` | Modificar | Registrar `imports.router` |
| `frontend/app/(app)/imports/page.tsx` | Crear | Upload PDF → preview table → confirm |
| `frontend/app/(app)/layout.tsx` | Modificar | Agregar "Importar" al nav |

---

## Task 1: Text utilities + PDF Parser service

**Files:**
- Create: `backend/services/text_utils.py`
- Create: `backend/services/pdf_parser.py`
- Create: `backend/tests/test_pdf_parser.py`
- Modify: `backend/routers/transactions.py` (lines 14-26 — importar desde text_utils)

**Interfaces:**
- Produces:
  - `normalize_desc(desc: str) -> str`
  - `dedupe_hash(fecha: date, monto: int, desc_norm: str) -> str`
  - `parse_pdf_bytes(pdf_bytes: bytes) -> ParseResult`
  - `ParseResult`, `ParsedItem`, `InstallmentData`, `BatchMeta` (dataclasses)
- Consumes: nada de tareas anteriores (solo stdlib + pdfplumber)

---

- [ ] **Step 1: Escribir tests que fallan para text_utils**

```python
# backend/tests/test_pdf_parser.py
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
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```bash
cd backend
DATABASE_URL=sqlite:///./test.db pytest tests/test_pdf_parser.py -v
```

Expected: `ImportError: No module named 'services.text_utils'`

- [ ] **Step 3: Implementar `backend/services/text_utils.py`**

```python
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
```

- [ ] **Step 4: Correr tests de text_utils — deben pasar**

```bash
DATABASE_URL=sqlite:///./test.db pytest tests/test_pdf_parser.py -v
```

Expected: 11 passed.

- [ ] **Step 5: Actualizar `backend/routers/transactions.py` para importar desde text_utils**

Reemplazar las líneas 14-26 (las funciones privadas `_normalize`, `_dedupe_hash` y la regex `GATEWAY_PREFIXES`):

```python
# Eliminar estas líneas de transactions.py:
# GATEWAY_PREFIXES = re.compile(...)
# def _normalize(desc: str) -> str: ...
# def _dedupe_hash(fecha: date, monto: int, desc_norm: str) -> str: ...

# Agregar al inicio de transactions.py, junto a los otros imports:
from services.text_utils import normalize_desc, dedupe_hash
```

Y en el cuerpo del router, cambiar las llamadas:
- `_normalize(req.descripcion_raw)` → `normalize_desc(req.descripcion_raw)`
- `_dedupe_hash(req.fecha_operacion, req.monto, desc_norm)` → `dedupe_hash(req.fecha_operacion, req.monto, desc_norm)`

El archivo `backend/routers/transactions.py` queda así (versión completa):

```python
import re
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Transaction, PaymentMethod, Category
from schemas.transaction import TransactionCreate, TransactionOut
from services.auth import get_current_user
from services.split import compute_split
from services.text_utils import normalize_desc, dedupe_hash

router = APIRouter(prefix="/api/households", tags=["transactions"])


def _assert_member(household_id: str, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


@router.get("/{household_id}/transactions", response_model=list[TransactionOut])
def list_transactions(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)
    return (
        db.query(Transaction)
        .filter(
            Transaction.household_id == household_id,
            Transaction.es_interno == False,
        )
        .order_by(Transaction.fecha_operacion.desc())
        .all()
    )


@router.post("/{household_id}/transactions", response_model=TransactionOut)
def create_transaction(
    household_id: str,
    req: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)

    pm = db.query(PaymentMethod).filter(
        PaymentMethod.id == req.payment_method_id,
        PaymentMethod.household_id == household_id,
    ).first()
    if not pm:
        raise HTTPException(status_code=400, detail="Medio de pago inválido")

    if req.category_id:
        cat = db.query(Category).filter(
            Category.id == req.category_id,
            Category.household_id == household_id,
        ).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Categoría inválida")

    desc_norm = normalize_desc(req.descripcion_raw)
    hash_d = dedupe_hash(req.fecha_operacion, req.monto, desc_norm)

    tx = Transaction(
        household_id=household_id,
        payment_method_id=req.payment_method_id,
        payer_user_id=current_user.id,
        category_id=req.category_id,
        fecha_operacion=req.fecha_operacion,
        descripcion_raw=req.descripcion_raw,
        descripcion_norm=desc_norm,
        lugar=req.lugar,
        monto=req.monto,
        tipo_movimiento="compra" if req.monto >= 0 else "abono",
        es_hogar=req.es_hogar,
        es_interno=False,
        split_override=req.split_override,
        hash_dedupe=hash_d,
    )
    db.add(tx)
    db.flush()

    members = (
        db.query(HouseholdMember)
        .filter(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id.isnot(None),
        )
        .all()
    )
    compute_split(tx, members, db)

    db.commit()
    db.refresh(tx)
    return tx
```

- [ ] **Step 6: Verificar que los tests existentes siguen pasando**

```bash
DATABASE_URL=sqlite:///./test.db pytest tests/ -v
```

Expected: todos los tests anteriores siguen en passed.

- [ ] **Step 7: Agregar tests para los helpers del PDF parser**

Agregar al final de `backend/tests/test_pdf_parser.py`:

```python
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
```

- [ ] **Step 8: Correr tests para verificar que fallan**

```bash
DATABASE_URL=sqlite:///./test.db pytest tests/test_pdf_parser.py -v
```

Expected: `ImportError: cannot import name '_parse_monto_clp' from 'services.pdf_parser'`

- [ ] **Step 9: Implementar `backend/services/pdf_parser.py`**

```python
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


def _parse_section4_plan(line: str) -> Optional[InstallmentData]:
    """
    Parse a new installment plan from section 4.
    These lines describe NEW plans created this period (not monthly charges from section 1).
    Returns InstallmentData to be used when the matching cuota in section 1 has cuota_actual=1,
    so we don't double-count — section 4 is informational only.
    """
    date_match = _DATE_RE.search(line)
    if not date_match:
        return None
    amounts = [_parse_monto_clp(m) for m in _AMOUNT_IN_LINE_RE.findall(line)]
    cuota_match = _CUOTA_RATIO_RE.search(line)
    if not cuota_match or len(amounts) < 2:
        return None

    after_date = line[date_match.end():]
    desc_raw = _AMOUNT_IN_LINE_RE.sub("", after_date)
    desc_raw = _CUOTA_RATIO_RE.sub("", desc_raw).strip()
    desc_norm = normalize_desc(desc_raw)

    return InstallmentData(
        descripcion=desc_norm,
        monto_total=amounts[0],
        cuota_actual=1,
        cuotas_totales=int(cuota_match.group(2)),
        valor_cuota_mensual=amounts[-1],
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
```

> **Nota de implementación:** `_parse_transaction_line` usa patrones regex en texto plano. Si en la cartola real el layout varía (ej: LUGAR en la línea anterior, monto en columna separada), puede ser necesario ajustar la regex o cambiar a extracción por coordenadas con `page.extract_words()`. Testear contra la cartola real guardada como `backend/tests/fixtures/cartola.pdf` (agregar a `.gitignore`).

- [ ] **Step 10: Correr todos los tests del parser**

```bash
DATABASE_URL=sqlite:///./test.db pytest tests/test_pdf_parser.py -v
```

Expected: 19 passed.

- [ ] **Step 11: Commit**

```bash
git add backend/services/text_utils.py backend/services/pdf_parser.py \
        backend/routers/transactions.py backend/tests/test_pdf_parser.py
git commit -m "feat: add text_utils and pdf_parser service for Santander cartola"
```

---

## Task 2: Categorizer service

**Files:**
- Create: `backend/services/categorizer.py`
- Create: `backend/tests/test_categorizer.py`

**Interfaces:**
- Consumes: `normalize_desc` de `text_utils`, `MerchantRule` + `Category` models
- Produces: `apply_category(desc_norm: str, household_id: str, db: Session) -> tuple[str | None, bool]`
  - Returns `(category_id_or_None, es_hogar_default)`

---

- [ ] **Step 1: Escribir tests que fallan**

```python
# backend/tests/test_categorizer.py
from services.categorizer import _match_seed, SEED_RULES


def test_jumbo_is_supermercado():
    cat_name, es_hogar = _match_seed("JUMBO ALTO LAS CONDES")
    assert cat_name == "Supermercados"
    assert es_hogar is True


def test_lider_is_supermercado():
    cat_name, es_hogar = _match_seed("LIDER EXPRESS")
    assert cat_name == "Supermercados"
    assert es_hogar is True


def test_pedidosya_is_delivery():
    cat_name, es_hogar = _match_seed("PEDIDOSYA")
    assert cat_name == "Delivery"
    assert es_hogar is True


def test_sodimac_is_hogar():
    cat_name, es_hogar = _match_seed("SODIMAC HOMECENTER")
    assert cat_name == "Hogar/Muebles"
    assert es_hogar is True


def test_enel_is_servicios():
    cat_name, es_hogar = _match_seed("ENEL")
    assert cat_name == "Servicios básicos"
    assert es_hogar is True


def test_unknown_merchant_returns_otros():
    cat_name, es_hogar = _match_seed("COMERCIO DESCONOCIDO XYZ")
    assert cat_name == "Otros"
    assert es_hogar is True


def test_seed_rules_is_list_of_tuples():
    for pattern, category, _ in SEED_RULES:
        assert isinstance(pattern, str)
        assert isinstance(category, str)
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```bash
DATABASE_URL=sqlite:///./test.db pytest tests/test_categorizer.py -v
```

Expected: `ImportError: cannot import name '_match_seed' from 'services.categorizer'`

- [ ] **Step 3: Implementar `backend/services/categorizer.py`**

```python
from sqlalchemy.orm import Session
from models import MerchantRule, Category

# (patron_substring, nombre_categoria, es_hogar_default)
SEED_RULES: list[tuple[str, str, bool]] = [
    ("JUMBO", "Supermercados", True),
    ("LIDER", "Supermercados", True),
    ("UNIMARC", "Supermercados", True),
    ("TOTTUS", "Supermercados", True),
    ("SANTA ISABEL", "Supermercados", True),
    ("SODIMAC", "Hogar/Muebles", True),
    ("EASY", "Hogar/Muebles", True),
    ("PEDIDOSYA", "Delivery", True),
    ("UBER EATS", "Delivery", True),
    ("RAPPI", "Delivery", True),
    ("ENEL", "Servicios básicos", True),
    ("AGUAS ANDINAS", "Servicios básicos", True),
    ("METROGAS", "Servicios básicos", True),
    ("ENTEL", "Telecom", True),
    ("MOVISTAR", "Telecom", True),
    ("WOM", "Telecom", True),
    ("CLARO", "Telecom", True),
    ("CINEMARK", "Entretención", True),
    ("CINEPLANET", "Entretención", True),
    ("NETFLIX", "Entretención", False),
    ("SPOTIFY", "Entretención", False),
    ("AMAZON", "Entretención", False),
    ("FARMACIA", "Salud", True),
    ("CRUZ VERDE", "Salud", True),
    ("SALCOBRAND", "Salud", True),
    ("AHUMADA", "Salud", True),
    ("IMPTO", "Comisiones/Impuestos", True),
    ("COMISION", "Comisiones/Impuestos", True),
    ("UBER", "Transporte", True),
    ("CABIFY", "Transporte", True),
    ("BIPO", "Transporte", True),
    ("MACONLINE", "Hogar/Muebles", True),
    ("RIPLEY", "Ropa/Calzado", False),
    ("FALABELLA", "Ropa/Calzado", False),
    ("PARIS", "Ropa/Calzado", False),
    ("ZARA", "Ropa/Calzado", False),
]


def _match_seed(desc_norm: str) -> tuple[str, bool]:
    desc_upper = desc_norm.upper()
    for pattern, category, es_hogar in SEED_RULES:
        if pattern.upper() in desc_upper:
            return category, es_hogar
    return "Otros", True


def apply_category(
    desc_norm: str,
    household_id: str,
    db: Session,
) -> tuple[str | None, bool]:
    """
    Returns (category_id, es_hogar_default).
    Priority: MerchantRule (learned) > SEED_RULES > ("Otros" category, True).
    """
    # 1. Check learned rules for this household
    desc_upper = desc_norm.upper()
    rules = db.query(MerchantRule).filter(
        MerchantRule.household_id == household_id
    ).all()
    for rule in rules:
        if rule.patron.upper() in desc_upper:
            return rule.category_id, rule.es_hogar_default

    # 2. Match against seed rules by category name
    cat_name, es_hogar = _match_seed(desc_norm)
    category = db.query(Category).filter(
        Category.household_id == household_id,
        Category.nombre == cat_name,
    ).first()
    if category:
        return category.id, es_hogar

    # 3. Fallback to "Otros"
    otros = db.query(Category).filter(
        Category.household_id == household_id,
        Category.nombre == "Otros",
    ).first()
    return (otros.id if otros else None), True
```

- [ ] **Step 4: Correr tests del categorizer**

```bash
DATABASE_URL=sqlite:///./test.db pytest tests/test_categorizer.py -v
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/services/categorizer.py backend/tests/test_categorizer.py
git commit -m "feat: add rule-based categorizer with Chilean merchant seed rules"
```

---

## Task 3: Import schemas + API endpoints

**Files:**
- Create: `backend/schemas/imports.py`
- Create: `backend/routers/imports.py`
- Create: `backend/tests/test_imports.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `parse_pdf_bytes` (Task 1), `apply_category` (Task 2), `compute_split` (services/split.py), `ImportBatch`, `Transaction`, `InstallmentPlan`, `MerchantRule`, `SplitAllocation` (models)
- Produces:
  - `POST /api/households/{household_id}/imports` — multipart PDF + `payment_method_id` → `ImportPreviewOut`
  - `POST /api/imports/{batch_id}/confirm` — `ImportConfirmIn` → `ImportConfirmOut`

---

- [ ] **Step 1: Escribir tests de integración que fallan**

```python
# backend/tests/test_imports.py
import io
import pytest
from unittest.mock import patch, MagicMock
from datetime import date
from fastapi.testclient import TestClient
from main import app
from database import get_db
from models import User, Household, HouseholdMember, PaymentMethod, Category
from services.auth import get_current_user
from services.pdf_parser import ParseResult, ParsedItem, BatchMeta
from tests.conftest import setup_db  # noqa: F401

client = TestClient(app)


def _make_user(db, email="tomas@test.com", username="tomas"):
    import bcrypt, uuid
    pw = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
    u = User(id=str(uuid.uuid4()), email=email, username=username, password_hash=pw, nombre="Tomas")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_household_with_member(db, user):
    import uuid
    h = Household(id=str(uuid.uuid4()), nombre="Depto", moneda="CLP")
    db.add(h)
    db.flush()
    hm = HouseholdMember(
        id=str(uuid.uuid4()),
        household_id=h.id,
        user_id=user.id,
        ratio_default=0.57,
    )
    db.add(hm)
    pm = PaymentMethod(
        id=str(uuid.uuid4()),
        household_id=h.id,
        tipo="tarjeta_credito",
        alias="TC Compartida",
        es_compartido=True,
    )
    db.add(pm)
    cat = Category(
        id=str(uuid.uuid4()),
        household_id=h.id,
        nombre="Otros",
    )
    db.add(cat)
    db.commit()
    db.refresh(h)
    db.refresh(pm)
    return h, pm


def _fake_parse_result(household_id=None):
    item = ParsedItem(
        fecha_operacion=date(2026, 5, 15),
        descripcion_raw="MP*CASAVINTE",
        descripcion_norm="CASAVINTE",
        lugar="LAS CONDES",
        monto=45000,
        tipo_movimiento="compra",
        es_interno=False,
        es_hogar=True,
        incluido=True,
        installment=None,
        hash_dedupe="abc123" * 5 + "ab",  # 32 chars
    )
    return ParseResult(
        meta=BatchMeta(
            titular="TOMAS",
            ultimos_digitos="7777",
            periodo_desde=date(2026, 5, 1),
            periodo_hasta=date(2026, 5, 31),
            total_facturado_declarado=45000,
        ),
        items=[item],
        cuadre_ok=True,
        advertencia=None,
    )


def test_upload_pdf_creates_preview(setup_db, db):
    user = _make_user(db)
    household, pm = _make_household_with_member(db, user)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    with patch("routers.imports.parse_pdf_bytes", return_value=_fake_parse_result()):
        resp = client.post(
            f"/api/households/{household.id}/imports",
            files={"file": ("cartola.pdf", io.BytesIO(b"%PDF fake"), "application/pdf")},
            data={"payment_method_id": pm.id},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "batch_id" in body
    assert len(body["items"]) == 1
    assert body["items"][0]["descripcion_norm"] == "CASAVINTE"
    assert body["items"][0]["monto"] == 45000
    assert body["cuadre_ok"] is True

    app.dependency_overrides.clear()


def test_confirm_import_creates_transactions(setup_db, db):
    user = _make_user(db)
    household, pm = _make_household_with_member(db, user)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    from models import ImportBatch
    import uuid
    batch = ImportBatch(
        id=str(uuid.uuid4()),
        household_id=household.id,
        payment_method_id=pm.id,
        archivo_origen="pdf",
        estado="preview",
    )
    db.add(batch)
    db.commit()

    payload = {
        "payer_user_id": user.id,
        "items": [
            {
                "fecha_operacion": "2026-05-15",
                "descripcion_raw": "MP*CASAVINTE",
                "descripcion_norm": "CASAVINTE",
                "lugar": "LAS CONDES",
                "monto": 45000,
                "tipo_movimiento": "compra",
                "es_interno": False,
                "es_hogar": True,
                "incluido": True,
                "category_id": None,
                "installment": None,
            }
        ],
    }
    resp = client.post(f"/api/imports/{batch.id}/confirm", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["transactions_created"] == 1
    assert body["duplicates_skipped"] == 0

    from models import Transaction
    txs = db.query(Transaction).filter(Transaction.import_batch_id == batch.id).all()
    assert len(txs) == 1
    assert txs[0].monto == 45000

    app.dependency_overrides.clear()


def test_confirm_skips_duplicates(setup_db, db):
    user = _make_user(db)
    household, pm = _make_household_with_member(db, user)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    from models import ImportBatch, Transaction
    from services.text_utils import normalize_desc, dedupe_hash
    import uuid

    batch = ImportBatch(
        id=str(uuid.uuid4()),
        household_id=household.id,
        payment_method_id=pm.id,
        archivo_origen="pdf",
        estado="preview",
    )
    db.add(batch)

    desc_norm = normalize_desc("MP*CASAVINTE")
    hash_d = dedupe_hash(date(2026, 5, 15), 45000, desc_norm)

    existing = Transaction(
        id=str(uuid.uuid4()),
        household_id=household.id,
        payment_method_id=pm.id,
        payer_user_id=user.id,
        fecha_operacion=date(2026, 5, 15),
        descripcion_raw="MP*CASAVINTE",
        descripcion_norm=desc_norm,
        monto=45000,
        tipo_movimiento="compra",
        es_hogar=True,
        es_interno=False,
        hash_dedupe=hash_d,
    )
    db.add(existing)
    db.commit()

    payload = {
        "payer_user_id": user.id,
        "items": [
            {
                "fecha_operacion": "2026-05-15",
                "descripcion_raw": "MP*CASAVINTE",
                "descripcion_norm": "CASAVINTE",
                "lugar": None,
                "monto": 45000,
                "tipo_movimiento": "compra",
                "es_interno": False,
                "es_hogar": True,
                "incluido": True,
                "category_id": None,
                "installment": None,
            }
        ],
    }
    resp = client.post(f"/api/imports/{batch.id}/confirm", json=payload)
    assert resp.status_code == 200
    assert resp.json()["duplicates_skipped"] == 1
    assert resp.json()["transactions_created"] == 0

    app.dependency_overrides.clear()
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```bash
DATABASE_URL=sqlite:///./test.db pytest tests/test_imports.py -v
```

Expected: `ImportError: cannot import name 'imports'` o similar.

- [ ] **Step 3: Implementar `backend/schemas/imports.py`**

```python
from datetime import date as date_type
from pydantic import BaseModel
from typing import Optional


class InstallmentIn(BaseModel):
    descripcion: str
    monto_total: int
    cuota_actual: int
    cuotas_totales: int
    valor_cuota_mensual: int


class PreviewItemOut(BaseModel):
    fecha_operacion: date_type
    descripcion_raw: str
    descripcion_norm: str
    lugar: Optional[str]
    monto: int
    tipo_movimiento: str
    es_interno: bool
    es_hogar: bool
    incluido: bool
    category_id: Optional[str]
    installment: Optional[InstallmentIn]
    hash_dedupe: str
    es_duplicado_posible: bool


class ImportPreviewOut(BaseModel):
    batch_id: str
    cuadre_ok: bool
    advertencia: Optional[str]
    items: list[PreviewItemOut]


class ConfirmItemIn(BaseModel):
    fecha_operacion: date_type
    descripcion_raw: str
    descripcion_norm: str
    lugar: Optional[str]
    monto: int
    tipo_movimiento: str
    es_interno: bool
    es_hogar: bool
    incluido: bool
    category_id: Optional[str]
    installment: Optional[InstallmentIn]


class ImportConfirmIn(BaseModel):
    payer_user_id: str
    items: list[ConfirmItemIn]


class ImportConfirmOut(BaseModel):
    transactions_created: int
    duplicates_skipped: int
    excluded_skipped: int
```

- [ ] **Step 4: Implementar `backend/routers/imports.py`**

```python
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import get_db
from models import (
    User, HouseholdMember, PaymentMethod, ImportBatch,
    Transaction, InstallmentPlan, SplitAllocation,
)
from schemas.imports import (
    ImportPreviewOut, PreviewItemOut,
    ImportConfirmIn, ImportConfirmOut,
    InstallmentIn,
)
from services.auth import get_current_user
from services.pdf_parser import parse_pdf_bytes
from services.categorizer import apply_category
from services.split import compute_split
from services.text_utils import dedupe_hash

router = APIRouter(prefix="/api", tags=["imports"])


def _assert_member(household_id: str, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


@router.post("/households/{household_id}/imports", response_model=ImportPreviewOut)
async def upload_pdf(
    household_id: str,
    file: UploadFile = File(...),
    payment_method_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)

    pm = db.query(PaymentMethod).filter(
        PaymentMethod.id == payment_method_id,
        PaymentMethod.household_id == household_id,
    ).first()
    if not pm:
        raise HTTPException(status_code=400, detail="Medio de pago inválido")

    pdf_bytes = await file.read()
    result = parse_pdf_bytes(pdf_bytes)

    batch = ImportBatch(
        id=str(uuid.uuid4()),
        household_id=household_id,
        payment_method_id=payment_method_id,
        archivo_origen="pdf",
        periodo_desde=result.meta.periodo_desde,
        periodo_hasta=result.meta.periodo_hasta,
        total_facturado_declarado=result.meta.total_facturado_declarado,
        estado="preview",
    )
    db.add(batch)
    db.commit()

    # Gather existing hashes for duplicate detection
    existing_hashes: set[str] = {
        row[0]
        for row in db.query(Transaction.hash_dedupe)
        .filter(Transaction.household_id == household_id)
        .all()
    }

    preview_items: list[PreviewItemOut] = []
    for item in result.items:
        cat_id, _ = apply_category(item.descripcion_norm, household_id, db)
        installment_out = None
        if item.installment:
            installment_out = InstallmentIn(
                descripcion=item.installment.descripcion,
                monto_total=item.installment.monto_total,
                cuota_actual=item.installment.cuota_actual,
                cuotas_totales=item.installment.cuotas_totales,
                valor_cuota_mensual=item.installment.valor_cuota_mensual,
            )
        preview_items.append(
            PreviewItemOut(
                fecha_operacion=item.fecha_operacion,
                descripcion_raw=item.descripcion_raw,
                descripcion_norm=item.descripcion_norm,
                lugar=item.lugar,
                monto=item.monto,
                tipo_movimiento=item.tipo_movimiento,
                es_interno=item.es_interno,
                es_hogar=item.es_hogar,
                incluido=item.incluido,
                category_id=cat_id,
                installment=installment_out,
                hash_dedupe=item.hash_dedupe,
                es_duplicado_posible=item.hash_dedupe in existing_hashes,
            )
        )

    return ImportPreviewOut(
        batch_id=batch.id,
        cuadre_ok=result.cuadre_ok,
        advertencia=result.advertencia,
        items=preview_items,
    )


@router.post("/imports/{batch_id}/confirm", response_model=ImportConfirmOut)
def confirm_import(
    batch_id: str,
    req: ImportConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch no encontrado")

    _assert_member(batch.household_id, current_user, db)

    if batch.estado != "preview":
        raise HTTPException(status_code=409, detail="Este batch ya fue confirmado")

    existing_hashes: set[str] = {
        row[0]
        for row in db.query(Transaction.hash_dedupe)
        .filter(Transaction.household_id == batch.household_id)
        .all()
    }

    members = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == batch.household_id,
        HouseholdMember.user_id.isnot(None),
    ).all()

    created = 0
    skipped_dup = 0
    skipped_excl = 0

    for item in req.items:
        if not item.incluido:
            skipped_excl += 1
            continue

        hash_d = dedupe_hash(item.fecha_operacion, item.monto, item.descripcion_norm)

        if hash_d in existing_hashes:
            skipped_dup += 1
            continue

        installment_plan_id = None
        if item.installment:
            plan = InstallmentPlan(
                id=str(uuid.uuid4()),
                household_id=batch.household_id,
                descripcion=item.installment.descripcion,
                monto_total=item.installment.monto_total,
                cuota_actual=item.installment.cuota_actual,
                cuotas_totales=item.installment.cuotas_totales,
                valor_cuota_mensual=item.installment.valor_cuota_mensual,
                tasa=0.0,
            )
            db.add(plan)
            db.flush()
            installment_plan_id = plan.id

        tx = Transaction(
            id=str(uuid.uuid4()),
            household_id=batch.household_id,
            import_batch_id=batch.id,
            payment_method_id=batch.payment_method_id,
            payer_user_id=req.payer_user_id,
            category_id=item.category_id,
            installment_plan_id=installment_plan_id,
            fecha_operacion=item.fecha_operacion,
            descripcion_raw=item.descripcion_raw,
            descripcion_norm=item.descripcion_norm,
            lugar=item.lugar,
            monto=item.monto,
            tipo_movimiento=item.tipo_movimiento,
            es_hogar=item.es_hogar,
            es_interno=item.es_interno,
            split_override=None,
            hash_dedupe=hash_d,
        )
        db.add(tx)
        db.flush()

        compute_split(tx, members, db)

        existing_hashes.add(hash_d)
        created += 1

    batch.estado = "confirmado"
    db.commit()

    return ImportConfirmOut(
        transactions_created=created,
        duplicates_skipped=skipped_dup,
        excluded_skipped=skipped_excl,
    )
```

- [ ] **Step 5: Registrar el router en `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, households, payment_methods, categories, transactions, settlements
from routers import imports  # agregar esta línea

app = FastAPI(title="NuestraCuenta API", version="0.1.0")

import os as _os
_origins = _os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(households.router)
app.include_router(payment_methods.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(settlements.router)
app.include_router(imports.router)  # agregar esta línea

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Correr todos los tests**

```bash
DATABASE_URL=sqlite:///./test.db pytest tests/ -v
```

Expected: todos los tests pasan, incluyendo los 3 nuevos de test_imports.py.

- [ ] **Step 7: Commit**

```bash
git add backend/schemas/imports.py backend/routers/imports.py \
        backend/tests/test_imports.py backend/main.py
git commit -m "feat: add PDF import endpoints — preview and confirm"
```

---

## Task 4: Frontend — Página de importación PDF

**Files:**
- Create: `frontend/app/(app)/imports/page.tsx`
- Modify: `frontend/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `apiFetch` de `@/lib/api`, `getHouseholdId`/`getToken` de `@/lib/auth`
- Endpoints: `POST /api/households/{id}/imports` (multipart), `POST /api/imports/{id}/confirm` (JSON)

> **Testing:** No hay tests automáticos para UI. Después de implementar, correr `npm run build` en `frontend/` para verificar tipos, luego probar manualmente en el browser.

---

- [ ] **Step 1: Agregar "Importar" al nav en `frontend/app/(app)/layout.tsx`**

Reemplazar el array `NAV`:

```typescript
const NAV = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/transactions", label: "Gastos" },
  { href: "/imports", label: "Importar" },
  { href: "/settlement", label: "Liquidación" },
  { href: "/settings", label: "Ajustes" },
];
```

- [ ] **Step 2: Crear `frontend/app/(app)/imports/page.tsx`**

```typescript
"use client";
import { useState, useEffect, useRef } from "react";
import { getHouseholdId, getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type InstallmentPreview = {
  descripcion: string;
  monto_total: number;
  cuota_actual: number;
  cuotas_totales: number;
  valor_cuota_mensual: number;
};

type PreviewItem = {
  fecha_operacion: string;
  descripcion_raw: string;
  descripcion_norm: string;
  lugar: string | null;
  monto: number;
  tipo_movimiento: string;
  es_interno: boolean;
  es_hogar: boolean;
  incluido: boolean;
  category_id: string | null;
  installment: InstallmentPreview | null;
  hash_dedupe: string;
  es_duplicado_posible: boolean;
};

type PreviewResponse = {
  batch_id: string;
  cuadre_ok: boolean;
  advertencia: string | null;
  items: PreviewItem[];
};

type PaymentMethod = {
  id: string;
  alias: string;
  tipo: string;
};

function formatCLP(n: number) {
  return `$${Math.abs(n).toLocaleString("es-CL")}${n < 0 ? " (abono)" : ""}`;
}

export default function ImportsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPm, setSelectedPm] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payerUserId, setPayerUserId] = useState("");
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hid = getHouseholdId();
    setHouseholdId(hid);
    if (!hid) return;
    const token = getToken();
    fetch(`${API}/api/households/${hid}/payment-methods`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: PaymentMethod[]) => {
        setPaymentMethods(data);
        if (data.length > 0) setSelectedPm(data[0].id);
      })
      .catch(() => setError("Error cargando medios de pago"));
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const file = fileRef.current?.files?.[0];
    if (!file || !householdId || !selectedPm) {
      setError("Selecciona un archivo PDF y un medio de pago");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("payment_method_id", selectedPm);
      const token = getToken();
      const resp = await fetch(`${API}/api/households/${householdId}/imports`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail ?? "Error subiendo PDF");
      }
      const data: PreviewResponse = await resp.json();
      setPreview(data);
      setItems(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setUploading(false);
    }
  }

  function toggleIncluido(idx: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, incluido: !item.incluido } : item
      )
    );
  }

  async function handleConfirm() {
    if (!preview || !payerUserId) {
      setError("Debes ingresar el ID del pagador (usuario que pagó la tarjeta)");
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const token = getToken();
      const resp = await fetch(`${API}/api/imports/${preview.batch_id}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payer_user_id: payerUserId, items }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail ?? "Error confirmando");
      }
      const result = await resp.json();
      setSuccess(
        `Importación exitosa: ${result.transactions_created} transacciones creadas, ` +
          `${result.duplicates_skipped} duplicados omitidos, ` +
          `${result.excluded_skipped} excluidos.`
      );
      setPreview(null);
      setItems([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Importar cartola PDF</h1>

      {!preview && (
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Medio de pago</label>
            <select
              value={selectedPm}
              onChange={(e) => setSelectedPm(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.alias} ({pm.tipo})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Archivo PDF (cartola Santander)</label>
            <input ref={fileRef} type="file" accept=".pdf" className="block" />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {uploading ? "Procesando..." : "Subir y parsear"}
          </button>
        </form>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">{success}</p>}

      {preview && (
        <div className="space-y-4">
          {!preview.cuadre_ok && preview.advertencia && (
            <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800">
              ⚠️ {preview.advertencia}
            </div>
          )}

          <p className="text-sm text-gray-500">
            {items.filter((i) => i.incluido).length} de {items.length} movimientos seleccionados.
            Desmarca los que no quieres importar.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2">✓</th>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Descripción</th>
                  <th className="p-2">Monto</th>
                  <th className="p-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`border-t ${!item.incluido ? "opacity-40" : ""} ${item.es_duplicado_posible ? "bg-yellow-50" : ""}`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={item.incluido}
                        onChange={() => toggleIncluido(idx)}
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap">{item.fecha_operacion}</td>
                    <td className="p-2">
                      <div>{item.descripcion_norm}</div>
                      {item.es_duplicado_posible && (
                        <span className="text-xs text-yellow-700">posible duplicado</span>
                      )}
                      {item.installment && (
                        <span className="text-xs text-blue-600">
                          cuota {item.installment.cuota_actual}/{item.installment.cuotas_totales}
                        </span>
                      )}
                    </td>
                    <td className={`p-2 whitespace-nowrap ${item.monto < 0 ? "text-green-600" : ""}`}>
                      {formatCLP(item.monto)}
                    </td>
                    <td className="p-2 text-xs text-gray-500">{item.tipo_movimiento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ID del usuario que pagó la tarjeta
              <span className="text-gray-400 font-normal ml-1">(pega el user ID desde la URL o settings)</span>
            </label>
            <input
              type="text"
              value={payerUserId}
              onChange={(e) => setPayerUserId(e.target.value)}
              placeholder="uuid del pagador"
              className="border rounded px-3 py-2 w-full font-mono text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {confirming ? "Confirmando..." : "Confirmar importación"}
            </button>
            <button
              onClick={() => { setPreview(null); setItems([]); setError(null); }}
              className="border px-4 py-2 rounded text-gray-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

> **Nota UX:** El campo `payer_user_id` es un workaround temporal para el MVP. Una mejora obvia (Fase 3) es cargar los miembros del hogar y mostrar un selector "¿Quién pagó la tarjeta?" con nombre display.

- [ ] **Step 3: Verificar tipos con TypeScript**

```bash
cd frontend
npm run build
```

Expected: `✓ Compiled successfully` sin errores de tipo.

- [ ] **Step 4: Probar manualmente en el browser**

1. Iniciar backend: `cd backend && uvicorn main:app --reload`
2. Iniciar frontend: `cd frontend && npm run dev`
3. Ir a `http://localhost:3000/imports`
4. Verificar que el link "Importar" aparece en el nav
5. Subir una cartola PDF de Santander real
6. Verificar que el preview muestra los movimientos correctamente
7. Desmarcar `MONTO CANCELADO` (debe venir desmarcado por defecto)
8. Confirmar y verificar que las transacciones aparecen en `/transactions`

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(app\)/imports/page.tsx frontend/app/\(app\)/layout.tsx
git commit -m "feat: add PDF import page with preview table and confirm flow"
```

---

## Checklist de criterios de aceptación (ERD §9)

Después de Task 4, verificar manualmente contra la cartola real:

- [ ] **CA1 — Excluir interno:** `MONTO CANCELADO` aparece en el preview con `incluido=false` y no entra a transactions al confirmar
- [ ] **CA2 — Nota de crédito:** `NOTA DE CREDITO $ -499.990` aparece con monto negativo y `tipo_movimiento=abono`
- [ ] **CA3 — Impuesto:** `IMPTO. DECRETO LEY 3475 $ 7.600` aparece con `tipo_movimiento=impuesto`, `es_hogar=true`
- [ ] **CA4 — Cuota vigente:** `MACONLINE 06/24` aporta `$52.873`, no `$1.268.949`
- [ ] **CA5 — Cuota nueva:** `FLOW *SAMSUNG 12 CUOTAS` crea `InstallmentPlan` con `cuotas_totales=12`, `valor_cuota_mensual=79166`
- [ ] **CA6 — Normalización:** `MP*CASAVINTE` → `CASAVINTE` en `descripcion_norm`
- [ ] **CA7 — Split 57/43:** confirmar un gasto de $100.000 y verificar `split_allocations` de $57.000 / $43.000
- [ ] **CA8 — Tarjeta personal:** gasto del hogar con `payer_user_id=B` genera deuda de A hacia B
- [ ] **CA9 — Cuadre:** si los montos no calzan, aparece `advertencia` en el preview (no bloquea)
- [ ] **CA10 — Dedupe:** subir la misma cartola dos veces → segunda subida muestra `es_duplicado_posible=true` y al confirmar `duplicates_skipped > 0`
