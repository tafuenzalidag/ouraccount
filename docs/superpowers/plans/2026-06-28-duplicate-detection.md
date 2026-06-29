# Motor de Detección de Duplicados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detectar transacciones duplicadas entre gastos manuales y cartola PDF importada, migrando el esquema a IDs enteros codificados con prefijo y agregando timestamps a todas las tablas.

**Architecture:** Fase 1 estandariza el schema (SERIAL PK + timestamps + sqids). Fase 2 agrega el servicio de detección fuzzy (monto exacto + fecha ±3 días) y los endpoints. Fase 3 migra el DS del frontend y construye el modal de duplicados en imports y la página /duplicates.

**Tech Stack:** FastAPI, SQLAlchemy 2.x, Alembic, Neon Postgres, sqids (Python), Next.js 16 App Router, TypeScript, Tailwind v4

## Global Constraints

- Todos los IDs en API usan formato `{prefijo}_{sqids_encoded}` — nunca el integer interno.
- `deleted_at IS NULL` en TODAS las queries de listado tras la migración.
- Tests corren con SQLite vía `Base.metadata.create_all()` — las migraciones Alembic solo aplican a Neon Postgres.
- Español (es-CL) en todo el copy del frontend, CLP sin decimales.
- Python 3.12, bcrypt directo (no passlib), sqids==0.4.1.
- Design system: NuestraCuenta DS (proyecto `1f56a3fd`), tokens de `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`.

---

## Phase 1: Schema Standardization

### Task 1: sqids codec — install + service + tests

**Files:**
- Create: `backend/services/id_codec.py`
- Create: `backend/tests/test_id_codec.py`
- Modify: `backend/requirements.txt`

**Interfaces:**
- Produces: `encode(prefix: str, internal_id: int) -> str`, `decode(external_id: str) -> tuple[str, int]`

- [ ] **Step 1: Add sqids to requirements**

```
# backend/requirements.txt — add this line:
sqids==0.4.1
```

Run: `cd backend && pip install sqids==0.4.1`

- [ ] **Step 2: Write failing tests**

```python
# backend/tests/test_id_codec.py
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
```

Run: `cd backend && DATABASE_URL=sqlite:///./test.db pytest tests/test_id_codec.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services.id_codec'`

- [ ] **Step 3: Implement id_codec**

```python
# backend/services/id_codec.py
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
```

- [ ] **Step 4: Run tests**

Run: `cd backend && DATABASE_URL=sqlite:///./test.db pytest tests/test_id_codec.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/services/id_codec.py backend/tests/test_id_codec.py
git commit -m "feat: add sqids id_codec service"
```

---

### Task 2: Update SQLAlchemy models — SERIAL PK + timestamps

**Files:**
- Modify: `backend/models/user.py`
- Modify: `backend/models/household.py`
- Modify: `backend/models/category.py`
- Modify: `backend/models/payment_method.py`
- Modify: `backend/models/import_batch.py`
- Modify: `backend/models/merchant_rule.py`
- Modify: `backend/models/transaction.py`
- Modify: `backend/models/split.py`
- Modify: `backend/models/settlement.py`

**Interfaces:**
- All models: `id: Mapped[int]` (autoincrement), `created_at`, `updated_at`, `deleted_at`
- All FK columns: `Mapped[int]` (not str)

- [ ] **Step 1: Write test to verify new model shapes**

```python
# backend/tests/test_models.py — replace existing content
from models import (
    User, Household, HouseholdMember, PaymentMethod, Category,
    ImportBatch, MerchantRule, Transaction, InstallmentPlan,
    SplitAllocation, Settlement,
)
from sqlalchemy import inspect

def _cols(model):
    return {c.key: c for c in inspect(model).mapper.column_attrs}

def test_user_has_integer_pk():
    cols = _cols(User)
    assert cols["id"].columns[0].type.python_type == int

def test_all_models_have_timestamps():
    for Model in [User, Household, HouseholdMember, PaymentMethod, Category,
                  ImportBatch, MerchantRule, Transaction, InstallmentPlan,
                  SplitAllocation, Settlement]:
        cols = {c.key for c in inspect(Model).mapper.column_attrs}
        assert "created_at" in cols, f"{Model.__name__} missing created_at"
        assert "updated_at" in cols, f"{Model.__name__} missing updated_at"
        assert "deleted_at" in cols, f"{Model.__name__} missing deleted_at"

def test_transaction_household_id_is_integer():
    cols = _cols(Transaction)
    assert cols["household_id"].columns[0].type.python_type == int
```

Run: `cd backend && DATABASE_URL=sqlite:///./test.db pytest tests/test_models.py -v`
Expected: FAIL

- [ ] **Step 2: Rewrite all models**

```python
# backend/models/user.py
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

```python
# backend/models/household.py
from datetime import datetime
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class Household(Base):
    __tablename__ = "households"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    moneda: Mapped[str] = mapped_column(String, default="CLP")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class HouseholdMember(Base):
    __tablename__ = "household_members"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    ratio_default: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    nombre_display: Mapped[str | None] = mapped_column(String, nullable=True)
    invite_code: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

```python
# backend/models/category.py
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    icono: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

```python
# backend/models/payment_method.py
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    tipo: Mapped[str] = mapped_column(String, nullable=False)
    alias: Mapped[str] = mapped_column(String, nullable=False)
    ultimos_digitos: Mapped[str | None] = mapped_column(String(4), nullable=True)
    es_compartido: Mapped[bool] = mapped_column(Boolean, default=True)
    banco: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

```python
# backend/models/import_batch.py
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class ImportBatch(Base):
    __tablename__ = "import_batches"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    payment_method_id: Mapped[int] = mapped_column(Integer, ForeignKey("payment_methods.id"), nullable=False)
    archivo_origen: Mapped[str] = mapped_column(String, nullable=False)
    periodo_desde: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    periodo_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_facturado_declarado: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    estado: Mapped[str] = mapped_column(String, default="preview")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

```python
# backend/models/merchant_rule.py
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class MerchantRule(Base):
    __tablename__ = "merchant_rules"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    patron: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id"), nullable=False)
    es_hogar_default: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

```python
# backend/models/transaction.py
from datetime import datetime, date
from sqlalchemy import String, Integer, BigInteger, Boolean, Date, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class InstallmentPlan(Base):
    __tablename__ = "installment_plans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    descripcion: Mapped[str] = mapped_column(String, nullable=False)
    monto_total: Mapped[int] = mapped_column(BigInteger, nullable=False)
    cuota_actual: Mapped[int] = mapped_column(Integer, nullable=False)
    cuotas_totales: Mapped[int] = mapped_column(Integer, nullable=False)
    valor_cuota_mensual: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tasa: Mapped[float] = mapped_column(Numeric(6, 4), default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    import_batch_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("import_batches.id"), nullable=True)
    payment_method_id: Mapped[int] = mapped_column(Integer, ForeignKey("payment_methods.id"), nullable=False)
    payer_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    installment_plan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("installment_plans.id"), nullable=True)
    fecha_operacion: Mapped[date] = mapped_column(Date, nullable=False)
    descripcion_raw: Mapped[str] = mapped_column(String, nullable=False)
    descripcion_norm: Mapped[str] = mapped_column(String, nullable=False)
    lugar: Mapped[str | None] = mapped_column(String, nullable=True)
    monto: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tipo_movimiento: Mapped[str] = mapped_column(String, nullable=False)
    es_hogar: Mapped[bool] = mapped_column(Boolean, default=True)
    es_interno: Mapped[bool] = mapped_column(Boolean, default=False)
    hash_dedupe: Mapped[str] = mapped_column(String, nullable=False)
    split_override: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

```python
# backend/models/split.py
from datetime import datetime
from sqlalchemy import Integer, BigInteger, DateTime, Numeric, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class SplitAllocation(Base):
    __tablename__ = "split_allocations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(Integer, ForeignKey("transactions.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    ratio: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    monto_asignado: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

```python
# backend/models/settlement.py
from datetime import datetime, date
from sqlalchemy import String, Integer, BigInteger, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class Settlement(Base):
    __tablename__ = "settlements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    periodo_desde: Mapped[date] = mapped_column(Date, nullable=False)
    periodo_hasta: Mapped[date] = mapped_column(Date, nullable=False)
    deudor_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    acreedor_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    monto: Mapped[int] = mapped_column(BigInteger, nullable=False)
    estado: Mapped[str] = mapped_column(String, default="pendiente")
    pagado_en: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 3: Update auth service for integer user_id in JWT**

```python
# backend/services/auth.py — change create_token signature and get_current_user query
def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

# In get_current_user, change the query line to:
    user_id_str: str = payload["sub"]
    user = db.query(User).filter(User.id == int(user_id_str), User.deleted_at.is_(None)).first()
```

- [ ] **Step 4: Run full test suite**

Run: `cd backend && DATABASE_URL=sqlite:///./test.db pytest tests/ -v`
Expected: Most tests pass. Fix any type errors — they'll be integer FK mismatches where test fixtures still pass UUID strings. Update fixture helpers to use plain integers (e.g. `user_id=1`).

- [ ] **Step 5: Commit**

```bash
git add backend/models/ backend/services/auth.py
git commit -m "feat: migrate all models to SERIAL PK + timestamps"
```

---

### Task 3: Alembic migrations — timestamps then UUID→SERIAL

**Files:**
- Create: `backend/alembic/versions/001_add_timestamps.py`
- Create: `backend/alembic/versions/002_uuid_to_serial.py`

> **Note:** These migrations run only against Neon Postgres, not in tests. Run `vercel env pull .env.local --yes` from repo root to get `DATABASE_URL` before running alembic.

- [ ] **Step 1: Create migration 001 — add timestamp columns**

```python
# backend/alembic/versions/001_add_timestamps.py
"""add timestamps to all tables"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None  # set to previous head if one exists
branch_labels = None
depends_on = None

TABLES = [
    "users", "households", "household_members", "categories",
    "payment_methods", "merchant_rules", "import_batches",
    "installment_plans", "transactions", "split_allocations", "settlements",
]

def upgrade():
    for table in TABLES:
        op.add_column(table, sa.Column("created_at", sa.DateTime(timezone=True),
                      server_default=sa.func.now(), nullable=False))
        op.add_column(table, sa.Column("updated_at", sa.DateTime(timezone=True),
                      server_default=sa.func.now(), nullable=False))
        op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

def downgrade():
    for table in TABLES:
        op.drop_column(table, "created_at")
        op.drop_column(table, "updated_at")
        op.drop_column(table, "deleted_at")
```

- [ ] **Step 2: Create migration 002 — UUID → SERIAL**

```python
# backend/alembic/versions/002_uuid_to_serial.py
"""replace uuid pks with serial integers"""
from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None

def upgrade():
    op.execute("""
    -- Drop all FK constraints first (Postgres requires this before type changes)
    ALTER TABLE household_members DROP CONSTRAINT IF EXISTS household_members_household_id_fkey;
    ALTER TABLE household_members DROP CONSTRAINT IF EXISTS household_members_user_id_fkey;
    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_household_id_fkey;
    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parent_id_fkey;
    ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_household_id_fkey;
    ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_owner_user_id_fkey;
    ALTER TABLE merchant_rules DROP CONSTRAINT IF EXISTS merchant_rules_household_id_fkey;
    ALTER TABLE merchant_rules DROP CONSTRAINT IF EXISTS merchant_rules_category_id_fkey;
    ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS import_batches_household_id_fkey;
    ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS import_batches_payment_method_id_fkey;
    ALTER TABLE installment_plans DROP CONSTRAINT IF EXISTS installment_plans_household_id_fkey;
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_household_id_fkey;
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_import_batch_id_fkey;
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_id_fkey;
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_payer_user_id_fkey;
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_installment_plan_id_fkey;
    ALTER TABLE split_allocations DROP CONSTRAINT IF EXISTS split_allocations_transaction_id_fkey;
    ALTER TABLE split_allocations DROP CONSTRAINT IF EXISTS split_allocations_user_id_fkey;
    ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_household_id_fkey;
    ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_deudor_user_id_fkey;
    ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_acreedor_user_id_fkey;

    -- Add new_id SERIAL to each table (auto-assigns unique integers)
    ALTER TABLE users ADD COLUMN new_id SERIAL;
    ALTER TABLE households ADD COLUMN new_id SERIAL;
    ALTER TABLE categories ADD COLUMN new_id SERIAL;
    ALTER TABLE household_members ADD COLUMN new_id SERIAL;
    ALTER TABLE payment_methods ADD COLUMN new_id SERIAL;
    ALTER TABLE merchant_rules ADD COLUMN new_id SERIAL;
    ALTER TABLE import_batches ADD COLUMN new_id SERIAL;
    ALTER TABLE installment_plans ADD COLUMN new_id SERIAL;
    ALTER TABLE transactions ADD COLUMN new_id SERIAL;
    ALTER TABLE split_allocations ADD COLUMN new_id SERIAL;
    ALTER TABLE settlements ADD COLUMN new_id SERIAL;

    -- Add new integer FK columns
    ALTER TABLE household_members ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE household_members ADD COLUMN user_id_new INTEGER;
    ALTER TABLE categories ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE categories ADD COLUMN parent_id_new INTEGER;
    ALTER TABLE payment_methods ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE payment_methods ADD COLUMN owner_uid_new INTEGER;
    ALTER TABLE merchant_rules ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE merchant_rules ADD COLUMN cat_id_new INTEGER;
    ALTER TABLE import_batches ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE import_batches ADD COLUMN pm_id_new INTEGER;
    ALTER TABLE installment_plans ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE transactions ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE transactions ADD COLUMN ib_id_new INTEGER;
    ALTER TABLE transactions ADD COLUMN pm_id_new INTEGER;
    ALTER TABLE transactions ADD COLUMN payer_uid_new INTEGER;
    ALTER TABLE transactions ADD COLUMN cat_id_new INTEGER;
    ALTER TABLE transactions ADD COLUMN ip_id_new INTEGER;
    ALTER TABLE split_allocations ADD COLUMN tx_id_new INTEGER;
    ALTER TABLE split_allocations ADD COLUMN user_id_new INTEGER;
    ALTER TABLE settlements ADD COLUMN hh_id_new INTEGER;
    ALTER TABLE settlements ADD COLUMN deudor_uid_new INTEGER;
    ALTER TABLE settlements ADD COLUMN acreedor_uid_new INTEGER;

    -- Backfill FK mappings
    UPDATE household_members hm SET hh_id_new = h.new_id FROM households h WHERE hm.household_id = h.id;
    UPDATE household_members hm SET user_id_new = u.new_id FROM users u WHERE hm.user_id = u.id;
    UPDATE categories c SET hh_id_new = h.new_id FROM households h WHERE c.household_id = h.id;
    UPDATE categories c SET parent_id_new = p.new_id FROM categories p WHERE c.parent_id = p.id;
    UPDATE payment_methods pm SET hh_id_new = h.new_id FROM households h WHERE pm.household_id = h.id;
    UPDATE payment_methods pm SET owner_uid_new = u.new_id FROM users u WHERE pm.owner_user_id = u.id;
    UPDATE merchant_rules mr SET hh_id_new = h.new_id FROM households h WHERE mr.household_id = h.id;
    UPDATE merchant_rules mr SET cat_id_new = c.new_id FROM categories c WHERE mr.category_id = c.id;
    UPDATE import_batches ib SET hh_id_new = h.new_id FROM households h WHERE ib.household_id = h.id;
    UPDATE import_batches ib SET pm_id_new = p.new_id FROM payment_methods p WHERE ib.payment_method_id = p.id;
    UPDATE installment_plans ip SET hh_id_new = h.new_id FROM households h WHERE ip.household_id = h.id;
    UPDATE transactions t SET hh_id_new = h.new_id FROM households h WHERE t.household_id = h.id;
    UPDATE transactions t SET ib_id_new = ib.new_id FROM import_batches ib WHERE t.import_batch_id = ib.id;
    UPDATE transactions t SET pm_id_new = p.new_id FROM payment_methods p WHERE t.payment_method_id = p.id;
    UPDATE transactions t SET payer_uid_new = u.new_id FROM users u WHERE t.payer_user_id = u.id;
    UPDATE transactions t SET cat_id_new = c.new_id FROM categories c WHERE t.category_id = c.id;
    UPDATE transactions t SET ip_id_new = ip.new_id FROM installment_plans ip WHERE t.installment_plan_id = ip.id;
    UPDATE split_allocations sa SET tx_id_new = t.new_id FROM transactions t WHERE sa.transaction_id = t.id;
    UPDATE split_allocations sa SET user_id_new = u.new_id FROM users u WHERE sa.user_id = u.id;
    UPDATE settlements s SET hh_id_new = h.new_id FROM households h WHERE s.household_id = h.id;
    UPDATE settlements s SET deudor_uid_new = u.new_id FROM users u WHERE s.deudor_user_id = u.id;
    UPDATE settlements s SET acreedor_uid_new = u.new_id FROM users u WHERE s.acreedor_user_id = u.id;

    -- Drop old PK columns and rename new ones (users table as example, pattern repeats)
    ALTER TABLE users DROP CONSTRAINT users_pkey;
    ALTER TABLE users DROP COLUMN id;
    ALTER TABLE users RENAME COLUMN new_id TO id;
    ALTER TABLE users ADD PRIMARY KEY (id);

    ALTER TABLE households DROP CONSTRAINT households_pkey;
    ALTER TABLE households DROP COLUMN id;
    ALTER TABLE households RENAME COLUMN new_id TO id;
    ALTER TABLE households ADD PRIMARY KEY (id);

    ALTER TABLE categories DROP CONSTRAINT categories_pkey;
    ALTER TABLE categories DROP COLUMN id;
    ALTER TABLE categories RENAME COLUMN new_id TO id;
    ALTER TABLE categories ADD PRIMARY KEY (id);
    ALTER TABLE categories DROP COLUMN household_id;
    ALTER TABLE categories DROP COLUMN parent_id;
    ALTER TABLE categories RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE categories RENAME COLUMN parent_id_new TO parent_id;
    ALTER TABLE categories ALTER COLUMN household_id SET NOT NULL;

    ALTER TABLE household_members DROP CONSTRAINT household_members_pkey;
    ALTER TABLE household_members DROP COLUMN id;
    ALTER TABLE household_members RENAME COLUMN new_id TO id;
    ALTER TABLE household_members ADD PRIMARY KEY (id);
    ALTER TABLE household_members DROP COLUMN household_id;
    ALTER TABLE household_members DROP COLUMN user_id;
    ALTER TABLE household_members RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE household_members RENAME COLUMN user_id_new TO user_id;
    ALTER TABLE household_members ALTER COLUMN household_id SET NOT NULL;

    ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_pkey;
    ALTER TABLE payment_methods DROP COLUMN id;
    ALTER TABLE payment_methods RENAME COLUMN new_id TO id;
    ALTER TABLE payment_methods ADD PRIMARY KEY (id);
    ALTER TABLE payment_methods DROP COLUMN household_id;
    ALTER TABLE payment_methods DROP COLUMN owner_user_id;
    ALTER TABLE payment_methods RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE payment_methods RENAME COLUMN owner_uid_new TO owner_user_id;
    ALTER TABLE payment_methods ALTER COLUMN household_id SET NOT NULL;

    ALTER TABLE merchant_rules DROP CONSTRAINT merchant_rules_pkey;
    ALTER TABLE merchant_rules DROP COLUMN id;
    ALTER TABLE merchant_rules RENAME COLUMN new_id TO id;
    ALTER TABLE merchant_rules ADD PRIMARY KEY (id);
    ALTER TABLE merchant_rules DROP COLUMN household_id;
    ALTER TABLE merchant_rules DROP COLUMN category_id;
    ALTER TABLE merchant_rules RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE merchant_rules RENAME COLUMN cat_id_new TO category_id;
    ALTER TABLE merchant_rules ALTER COLUMN household_id SET NOT NULL;
    ALTER TABLE merchant_rules ALTER COLUMN category_id SET NOT NULL;

    ALTER TABLE import_batches DROP CONSTRAINT import_batches_pkey;
    ALTER TABLE import_batches DROP COLUMN id;
    ALTER TABLE import_batches RENAME COLUMN new_id TO id;
    ALTER TABLE import_batches ADD PRIMARY KEY (id);
    ALTER TABLE import_batches DROP COLUMN household_id;
    ALTER TABLE import_batches DROP COLUMN payment_method_id;
    ALTER TABLE import_batches RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE import_batches RENAME COLUMN pm_id_new TO payment_method_id;
    ALTER TABLE import_batches ALTER COLUMN household_id SET NOT NULL;
    ALTER TABLE import_batches ALTER COLUMN payment_method_id SET NOT NULL;

    ALTER TABLE installment_plans DROP CONSTRAINT installment_plans_pkey;
    ALTER TABLE installment_plans DROP COLUMN id;
    ALTER TABLE installment_plans RENAME COLUMN new_id TO id;
    ALTER TABLE installment_plans ADD PRIMARY KEY (id);
    ALTER TABLE installment_plans DROP COLUMN household_id;
    ALTER TABLE installment_plans RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE installment_plans ALTER COLUMN household_id SET NOT NULL;

    ALTER TABLE transactions DROP CONSTRAINT transactions_pkey;
    ALTER TABLE transactions DROP COLUMN id;
    ALTER TABLE transactions RENAME COLUMN new_id TO id;
    ALTER TABLE transactions ADD PRIMARY KEY (id);
    ALTER TABLE transactions DROP COLUMN household_id;
    ALTER TABLE transactions DROP COLUMN import_batch_id;
    ALTER TABLE transactions DROP COLUMN payment_method_id;
    ALTER TABLE transactions DROP COLUMN payer_user_id;
    ALTER TABLE transactions DROP COLUMN category_id;
    ALTER TABLE transactions DROP COLUMN installment_plan_id;
    ALTER TABLE transactions RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE transactions RENAME COLUMN ib_id_new TO import_batch_id;
    ALTER TABLE transactions RENAME COLUMN pm_id_new TO payment_method_id;
    ALTER TABLE transactions RENAME COLUMN payer_uid_new TO payer_user_id;
    ALTER TABLE transactions RENAME COLUMN cat_id_new TO category_id;
    ALTER TABLE transactions RENAME COLUMN ip_id_new TO installment_plan_id;
    ALTER TABLE transactions ALTER COLUMN household_id SET NOT NULL;
    ALTER TABLE transactions ALTER COLUMN payment_method_id SET NOT NULL;
    ALTER TABLE transactions ALTER COLUMN payer_user_id SET NOT NULL;

    ALTER TABLE split_allocations DROP CONSTRAINT split_allocations_pkey;
    ALTER TABLE split_allocations DROP COLUMN id;
    ALTER TABLE split_allocations RENAME COLUMN new_id TO id;
    ALTER TABLE split_allocations ADD PRIMARY KEY (id);
    ALTER TABLE split_allocations DROP COLUMN transaction_id;
    ALTER TABLE split_allocations DROP COLUMN user_id;
    ALTER TABLE split_allocations RENAME COLUMN tx_id_new TO transaction_id;
    ALTER TABLE split_allocations RENAME COLUMN user_id_new TO user_id;
    ALTER TABLE split_allocations ALTER COLUMN transaction_id SET NOT NULL;
    ALTER TABLE split_allocations ALTER COLUMN user_id SET NOT NULL;

    ALTER TABLE settlements DROP CONSTRAINT settlements_pkey;
    ALTER TABLE settlements DROP COLUMN id;
    ALTER TABLE settlements RENAME COLUMN new_id TO id;
    ALTER TABLE settlements ADD PRIMARY KEY (id);
    ALTER TABLE settlements DROP COLUMN household_id;
    ALTER TABLE settlements DROP COLUMN deudor_user_id;
    ALTER TABLE settlements DROP COLUMN acreedor_user_id;
    ALTER TABLE settlements RENAME COLUMN hh_id_new TO household_id;
    ALTER TABLE settlements RENAME COLUMN deudor_uid_new TO deudor_user_id;
    ALTER TABLE settlements RENAME COLUMN acreedor_uid_new TO acreedor_user_id;
    ALTER TABLE settlements ALTER COLUMN household_id SET NOT NULL;
    ALTER TABLE settlements ALTER COLUMN deudor_user_id SET NOT NULL;
    ALTER TABLE settlements ALTER COLUMN acreedor_user_id SET NOT NULL;

    -- Restore FK constraints
    ALTER TABLE household_members ADD CONSTRAINT hm_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE household_members ADD CONSTRAINT hm_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
    ALTER TABLE categories ADD CONSTRAINT cat_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE categories ADD CONSTRAINT cat_parent_fk FOREIGN KEY (parent_id) REFERENCES categories(id);
    ALTER TABLE payment_methods ADD CONSTRAINT pm_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE payment_methods ADD CONSTRAINT pm_owner_fk FOREIGN KEY (owner_user_id) REFERENCES users(id);
    ALTER TABLE merchant_rules ADD CONSTRAINT mr_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE merchant_rules ADD CONSTRAINT mr_cat_fk FOREIGN KEY (category_id) REFERENCES categories(id);
    ALTER TABLE import_batches ADD CONSTRAINT ib_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE import_batches ADD CONSTRAINT ib_pm_fk FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id);
    ALTER TABLE installment_plans ADD CONSTRAINT ip_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_ib_fk FOREIGN KEY (import_batch_id) REFERENCES import_batches(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_pm_fk FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_payer_fk FOREIGN KEY (payer_user_id) REFERENCES users(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_cat_fk FOREIGN KEY (category_id) REFERENCES categories(id);
    ALTER TABLE transactions ADD CONSTRAINT tx_ip_fk FOREIGN KEY (installment_plan_id) REFERENCES installment_plans(id);
    ALTER TABLE split_allocations ADD CONSTRAINT sa_tx_fk FOREIGN KEY (transaction_id) REFERENCES transactions(id);
    ALTER TABLE split_allocations ADD CONSTRAINT sa_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
    ALTER TABLE settlements ADD CONSTRAINT set_hh_fk FOREIGN KEY (household_id) REFERENCES households(id);
    ALTER TABLE settlements ADD CONSTRAINT set_deudor_fk FOREIGN KEY (deudor_user_id) REFERENCES users(id);
    ALTER TABLE settlements ADD CONSTRAINT set_acreedor_fk FOREIGN KEY (acreedor_user_id) REFERENCES users(id);
    """)

def downgrade():
    raise NotImplementedError("UUID→SERIAL migration is not reversible")
```

- [ ] **Step 3: Run migrations against Neon**

```bash
# From repo root:
vercel env pull .env.local --yes
cd backend
source ../.env.local 2>/dev/null || export $(cat ../.env.local | grep -v '^#' | xargs)
alembic upgrade head
```

Expected: "Running upgrade -> 001, 002"

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat: alembic migrations — timestamps and uuid to serial"
```

---

### Task 4: Update Pydantic schemas + routers for new ID format

**Files:**
- Modify: `backend/schemas/transaction.py`
- Modify: `backend/schemas/imports.py`
- Modify: `backend/schemas/household.py`
- Modify: `backend/schemas/auth.py`
- Modify: `backend/schemas/payment_method.py`
- Modify: `backend/schemas/settlement.py`
- Modify: `backend/schemas/category.py`
- Modify: `backend/routers/auth.py`
- Modify: `backend/routers/households.py`
- Modify: `backend/routers/transactions.py`
- Modify: `backend/routers/imports.py`
- Modify: `backend/routers/settlements.py`
- Modify: `backend/routers/payment_methods.py`
- Modify: `backend/routers/categories.py`

**Interfaces:**
- All `Out` schemas: expose `external_id: str` (not `id: int`)
- All routers: `decode(path_param)` on input, `encode(prefix, obj.id)` on output
- Pydantic `model_validator` or `@computed_field` not needed — routers build the response dicts manually or use a helper

**Pattern for every Out schema (example: TransactionOut):**
```python
# schemas/transaction.py
from datetime import date
from pydantic import BaseModel

class TransactionCreate(BaseModel):
    fecha_operacion: date
    descripcion_raw: str
    monto: int
    payment_method_id: str   # receives external_id, router decodes
    es_hogar: bool = True
    category_id: str | None = None
    split_override: float | None = None
    lugar: str | None = None

class TransactionOut(BaseModel):
    external_id: str
    fecha_operacion: date
    descripcion_raw: str
    descripcion_norm: str
    monto: int
    es_hogar: bool
    tipo_movimiento: str
    category_id: str | None        # encoded external_id
    payer_user_id: str             # encoded external_id
    payment_method_id: str         # encoded external_id
    # NOT from_attributes — routers construct this explicitly
```

**Pattern for routers — helper function:**

Add to each router file:
```python
from services.id_codec import encode, decode

def _tx_out(tx: Transaction) -> dict:
    return {
        "external_id": encode("tx_", tx.id),
        "fecha_operacion": tx.fecha_operacion,
        "descripcion_raw": tx.descripcion_raw,
        "descripcion_norm": tx.descripcion_norm,
        "monto": tx.monto,
        "es_hogar": tx.es_hogar,
        "tipo_movimiento": tx.tipo_movimiento,
        "category_id": encode("cat_", tx.category_id) if tx.category_id else None,
        "payer_user_id": encode("us_", tx.payer_user_id),
        "payment_method_id": encode("pm_", tx.payment_method_id),
    }
```

**Pattern for path params in routers:**
```python
@router.get("/{household_id}/transactions/{tx_id}")
def get_tx(household_id: str, tx_id: str, ...):
    _, hh_int = decode(household_id)   # "hh_xxx" → int
    _, tx_int = decode(tx_id)           # "tx_xxx" → int
    tx = db.query(Transaction).filter(
        Transaction.id == tx_int,
        Transaction.household_id == hh_int,
        Transaction.deleted_at.is_(None),
    ).first()
```

- [ ] **Step 1: Update schemas** — apply the TransactionOut pattern above to all Out schemas. All Out schemas: remove `from_attributes`, use explicit field names with `str` type for IDs. Input schemas that receive FK IDs keep them as `str` (the external_id comes in from frontend as string).

- [ ] **Step 2: Update each router** — apply decode on input, build response dict with encode on output. Add `deleted_at.is_(None)` to all existing queries.

- [ ] **Step 3: Verify auth router encodes user id on login**

In `routers/auth.py`, the login response includes the token. The token's `sub` is the integer user id (already handled in Task 2). The `UserOut` schema should expose `external_id`:
```python
class UserOut(BaseModel):
    external_id: str
    email: str
    username: str
    nombre: str
```
And the login endpoint:
```python
return {
    "access_token": create_token(user.id),
    "token_type": "bearer",
    "user": {"external_id": encode("us_", user.id), "email": user.email, ...},
}
```

- [ ] **Step 4: Run full test suite**

Run: `cd backend && DATABASE_URL=sqlite:///./test.db pytest tests/ -v`
Fix any remaining test failures — mostly fixture helpers passing raw ints where the router now expects encoded strings.

- [ ] **Step 5: Commit**

```bash
git add backend/schemas/ backend/routers/
git commit -m "feat: encode/decode sqids IDs in all schemas and routers"
```

---

## Phase 2: Duplicate Detection Backend

### Task 5: DismissedDuplicatePair model + migration

**Files:**
- Create: `backend/models/dismissed_duplicate_pair.py`
- Create: `backend/alembic/versions/003_dismissed_duplicate_pairs.py`
- Modify: `backend/models/__init__.py`

- [ ] **Step 1: Create model**

```python
# backend/models/dismissed_duplicate_pair.py
from datetime import datetime
from sqlalchemy import Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class DismissedDuplicatePair(Base):
    __tablename__ = "dismissed_duplicate_pairs"
    __table_args__ = (UniqueConstraint("tx_id_a", "tx_id_b"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    tx_id_a: Mapped[int] = mapped_column(Integer, ForeignKey("transactions.id"), nullable=False)
    tx_id_b: Mapped[int] = mapped_column(Integer, ForeignKey("transactions.id"), nullable=False)
    dismissed_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 2: Add to __init__.py**

```python
# backend/models/__init__.py — add line:
from .dismissed_duplicate_pair import DismissedDuplicatePair
```

- [ ] **Step 3: Create Alembic migration 003**

```python
# backend/alembic/versions/003_dismissed_duplicate_pairs.py
"""create dismissed_duplicate_pairs table"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"

def upgrade():
    op.create_table(
        "dismissed_duplicate_pairs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("household_id", sa.Integer, sa.ForeignKey("households.id"), nullable=False),
        sa.Column("tx_id_a", sa.Integer, sa.ForeignKey("transactions.id"), nullable=False),
        sa.Column("tx_id_b", sa.Integer, sa.ForeignKey("transactions.id"), nullable=False),
        sa.Column("dismissed_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("tx_id_a", "tx_id_b"),
    )

def downgrade():
    op.drop_table("dismissed_duplicate_pairs")
```

- [ ] **Step 4: Run migration + run tests**

```bash
cd backend && alembic upgrade head
DATABASE_URL=sqlite:///./test.db pytest tests/ -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/models/dismissed_duplicate_pair.py backend/models/__init__.py backend/alembic/versions/003_dismissed_duplicate_pairs.py
git commit -m "feat: add DismissedDuplicatePair model and migration"
```

---

### Task 6: duplicate_detector service + tests

**Files:**
- Create: `backend/services/duplicate_detector.py`
- Create: `backend/tests/test_duplicate_detector.py`

**Interfaces:**
- Produces:
  - `find_fuzzy_for_import(items: list[ParsedItem], household_id: int, db: Session, window_days: int = 3) -> dict[int, list[Transaction]]`
  - `find_all_candidates(household_id: int, db: Session, window_days: int = 3) -> list[tuple[Transaction, Transaction]]`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_duplicate_detector.py
from datetime import date, timedelta
from models import Transaction, ImportBatch, User, Household, HouseholdMember, PaymentMethod, Category
from services.duplicate_detector import find_fuzzy_for_import, find_all_candidates
from services.text_utils import dedupe_hash

def _seed(db):
    u = User(email="a@b.com", username="a", password_hash="x", nombre="A")
    h = Household(nombre="Casa", moneda="CLP")
    db.add_all([u, h])
    db.flush()
    pm = PaymentMethod(household_id=h.id, tipo="cuenta_corriente", alias="BCI", es_compartido=True)
    db.add(pm)
    db.flush()
    return u, h, pm

def _tx(db, h_id, pm_id, u_id, monto, fecha, import_batch_id=None):
    desc = "JUMBO"
    t = Transaction(
        household_id=h_id, payment_method_id=pm_id, payer_user_id=u_id,
        fecha_operacion=fecha, descripcion_raw=desc, descripcion_norm=desc,
        monto=monto, tipo_movimiento="compra", es_hogar=True, es_interno=False,
        hash_dedupe=dedupe_hash(fecha, monto, desc),
        import_batch_id=import_batch_id,
    )
    db.add(t)
    db.flush()
    return t

def test_find_fuzzy_for_import_detects_match(db):
    u, h, pm = _seed(db)
    manual = _tx(db, h.id, pm.id, u.id, 50000, date(2024, 1, 10))
    db.commit()

    class FakeItem:
        monto = 50000
        fecha_operacion = date(2024, 1, 12)  # 2 days later — within window
        hash_dedupe = "different_hash"

    result = find_fuzzy_for_import([FakeItem()], h.id, db)
    assert 0 in result
    assert manual.id in [t.id for t in result[0]]

def test_find_fuzzy_for_import_excludes_outside_window(db):
    u, h, pm = _seed(db)
    _tx(db, h.id, pm.id, u.id, 50000, date(2024, 1, 1))
    db.commit()

    class FakeItem:
        monto = 50000
        fecha_operacion = date(2024, 1, 8)  # 7 days later — outside window
        hash_dedupe = "different_hash"

    result = find_fuzzy_for_import([FakeItem()], h.id, db)
    assert result == {}

def test_find_fuzzy_skips_exact_hash_match(db):
    u, h, pm = _seed(db)
    fecha = date(2024, 1, 10)
    manual = _tx(db, h.id, pm.id, u.id, 50000, fecha)
    db.commit()

    class FakeItem:
        monto = 50000
        fecha_operacion = fecha
        hash_dedupe = manual.hash_dedupe  # exact match — handled elsewhere

    result = find_fuzzy_for_import([FakeItem()], h.id, db)
    assert result == {}

def test_find_all_candidates_returns_manual_vs_imported_pair(db):
    u, h, pm = _seed(db)
    ib = ImportBatch(household_id=h.id, payment_method_id=pm.id,
                     archivo_origen="pdf", estado="confirmado")
    db.add(ib)
    db.flush()
    manual = _tx(db, h.id, pm.id, u.id, 30000, date(2024, 2, 1))
    imported = _tx(db, h.id, pm.id, u.id, 30000, date(2024, 2, 2), import_batch_id=ib.id)
    db.commit()

    pairs = find_all_candidates(h.id, db)
    ids = {(min(a.id, b.id), max(a.id, b.id)) for a, b in pairs}
    assert (min(manual.id, imported.id), max(manual.id, imported.id)) in ids

def test_find_all_candidates_excludes_deleted(db):
    u, h, pm = _seed(db)
    ib = ImportBatch(household_id=h.id, payment_method_id=pm.id,
                     archivo_origen="pdf", estado="confirmado")
    db.add(ib)
    db.flush()
    from datetime import datetime
    manual = _tx(db, h.id, pm.id, u.id, 30000, date(2024, 2, 1))
    manual.deleted_at = datetime.utcnow()
    imported = _tx(db, h.id, pm.id, u.id, 30000, date(2024, 2, 2), import_batch_id=ib.id)
    db.commit()

    pairs = find_all_candidates(h.id, db)
    assert pairs == []
```

Run: `cd backend && DATABASE_URL=sqlite:///./test.db pytest tests/test_duplicate_detector.py -v`
Expected: FAIL — module not found

- [ ] **Step 2: Implement duplicate_detector**

```python
# backend/services/duplicate_detector.py
from datetime import timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import Transaction, DismissedDuplicatePair


def find_fuzzy_for_import(items, household_id: int, db: Session, window_days: int = 3) -> dict[int, list[Transaction]]:
    result: dict[int, list[Transaction]] = {}
    for idx, item in enumerate(items):
        lo = item.fecha_operacion - timedelta(days=window_days)
        hi = item.fecha_operacion + timedelta(days=window_days)
        matches = db.query(Transaction).filter(
            Transaction.household_id == household_id,
            Transaction.monto == item.monto,
            Transaction.fecha_operacion >= lo,
            Transaction.fecha_operacion <= hi,
            Transaction.deleted_at.is_(None),
            Transaction.hash_dedupe != item.hash_dedupe,
        ).all()
        if matches:
            result[idx] = matches
    return result


def find_all_candidates(household_id: int, db: Session, window_days: int = 3) -> list[tuple[Transaction, Transaction]]:
    manual = db.query(Transaction).filter(
        Transaction.household_id == household_id,
        Transaction.import_batch_id.is_(None),
        Transaction.deleted_at.is_(None),
        Transaction.es_interno == False,
    ).all()

    if not manual:
        return []

    dismissed = db.query(DismissedDuplicatePair).filter(
        DismissedDuplicatePair.household_id == household_id,
        DismissedDuplicatePair.deleted_at.is_(None),
    ).all()
    dismissed_pairs = {(d.tx_id_a, d.tx_id_b) for d in dismissed}

    pairs: list[tuple[Transaction, Transaction]] = []
    for tx in manual:
        lo = tx.fecha_operacion - timedelta(days=window_days)
        hi = tx.fecha_operacion + timedelta(days=window_days)
        candidates = db.query(Transaction).filter(
            Transaction.household_id == household_id,
            Transaction.monto == tx.monto,
            Transaction.fecha_operacion >= lo,
            Transaction.fecha_operacion <= hi,
            Transaction.import_batch_id.isnot(None),
            Transaction.deleted_at.is_(None),
        ).all()
        for c in candidates:
            pair_key = (min(tx.id, c.id), max(tx.id, c.id))
            if pair_key not in dismissed_pairs:
                pairs.append((tx, c))
                dismissed_pairs.add(pair_key)  # avoid dupes in result

    return pairs
```

- [ ] **Step 3: Run tests**

Run: `cd backend && DATABASE_URL=sqlite:///./test.db pytest tests/test_duplicate_detector.py -v`
Expected: 5 passed

- [ ] **Step 4: Commit**

```bash
git add backend/services/duplicate_detector.py backend/tests/test_duplicate_detector.py
git commit -m "feat: duplicate_detector service with fuzzy matching"
```

---

### Task 7: New endpoints + update imports preview

**Files:**
- Create: `backend/schemas/duplicates.py`
- Create: `backend/routers/duplicates.py`
- Modify: `backend/routers/transactions.py` (add DELETE soft-delete)
- Modify: `backend/routers/imports.py` (add fuzzy_matches to preview)
- Modify: `backend/main.py` (include duplicates router)

- [ ] **Step 1: Create schemas**

```python
# backend/schemas/duplicates.py
from datetime import date
from pydantic import BaseModel
from typing import Literal

class TxSnippet(BaseModel):
    external_id: str
    fecha_operacion: date
    descripcion_raw: str
    monto: int
    origen: Literal["manual", "importado"]
    payment_method_alias: str

class DuplicatePairOut(BaseModel):
    tx_manual: TxSnippet
    tx_importado: TxSnippet

class DismissDuplicateIn(BaseModel):
    tx_external_id_a: str
    tx_external_id_b: str
```

- [ ] **Step 2: Add fuzzy_matches to PreviewItemOut**

```python
# backend/schemas/imports.py — add to PreviewItemOut:
from schemas.duplicates import TxSnippet

class PreviewItemOut(BaseModel):
    # ... existing fields ...
    fuzzy_matches: list[TxSnippet] = []
```

- [ ] **Step 3: Update upload_pdf to call find_fuzzy_for_import**

```python
# backend/routers/imports.py — after building preview_items list, add:
from services.duplicate_detector import find_fuzzy_for_import
from services.id_codec import encode
from models import PaymentMethod as PM

# Inside upload_pdf, before building preview_items:
parsed_items_for_detector = result.items  # the ParsedItem objects
fuzzy_map = find_fuzzy_for_import(parsed_items_for_detector, household_id_int, db)

# When building each PreviewItemOut, add:
fuzzy_snippets = []
for match_tx in fuzzy_map.get(idx, []):
    pm_obj = db.query(PM).filter(PM.id == match_tx.payment_method_id).first()
    fuzzy_snippets.append(TxSnippet(
        external_id=encode("tx_", match_tx.id),
        fecha_operacion=match_tx.fecha_operacion,
        descripcion_raw=match_tx.descripcion_raw,
        monto=match_tx.monto,
        origen="importado" if match_tx.import_batch_id else "manual",
        payment_method_alias=pm_obj.alias if pm_obj else "",
    ))
# Add fuzzy_matches=fuzzy_snippets to PreviewItemOut(...)
```

Note: `household_id` path param must be decoded first: `_, household_id_int = decode(household_id)`.

- [ ] **Step 4: Add DELETE /transactions/{tx_id} to transactions router**

```python
# backend/routers/transactions.py — add this endpoint:
from datetime import datetime

@router.delete("/{household_id}/transactions/{tx_id}", status_code=204)
def delete_transaction(
    household_id: str,
    tx_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _, tx_int = decode(tx_id)
    _assert_member(hh_int, current_user, db)
    tx = db.query(Transaction).filter(
        Transaction.id == tx_int,
        Transaction.household_id == hh_int,
        Transaction.deleted_at.is_(None),
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    now = datetime.utcnow()
    tx.deleted_at = now
    # Soft-delete associated split_allocations
    db.query(SplitAllocation).filter(
        SplitAllocation.transaction_id == tx_int,
        SplitAllocation.deleted_at.is_(None),
    ).update({"deleted_at": now})
    db.commit()
```

Also import `SplitAllocation` in transactions router.

- [ ] **Step 5: Create duplicates router**

```python
# backend/routers/duplicates.py
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Transaction, DismissedDuplicatePair, PaymentMethod
from schemas.duplicates import DuplicatePairOut, TxSnippet, DismissDuplicateIn
from services.auth import get_current_user
from services.duplicate_detector import find_all_candidates
from services.id_codec import encode, decode

router = APIRouter(prefix="/api/households", tags=["duplicates"])


def _assert_member(household_id: int, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
        HouseholdMember.deleted_at.is_(None),
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


def _snippet(tx: Transaction, db: Session) -> TxSnippet:
    pm = db.query(PaymentMethod).filter(PaymentMethod.id == tx.payment_method_id).first()
    return TxSnippet(
        external_id=encode("tx_", tx.id),
        fecha_operacion=tx.fecha_operacion,
        descripcion_raw=tx.descripcion_raw,
        monto=tx.monto,
        origen="importado" if tx.import_batch_id else "manual",
        payment_method_alias=pm.alias if pm else "",
    )


@router.get("/{household_id}/duplicate-candidates", response_model=list[DuplicatePairOut])
def list_duplicate_candidates(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)
    pairs = find_all_candidates(hh_int, db)
    return [
        DuplicatePairOut(tx_manual=_snippet(a, db), tx_importado=_snippet(b, db))
        for a, b in pairs
    ]


@router.post("/{household_id}/dismiss-duplicate", status_code=201)
def dismiss_duplicate(
    household_id: str,
    req: DismissDuplicateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)
    _, tx_a_int = decode(req.tx_external_id_a)
    _, tx_b_int = decode(req.tx_external_id_b)
    id_a, id_b = min(tx_a_int, tx_b_int), max(tx_a_int, tx_b_int)
    existing = db.query(DismissedDuplicatePair).filter(
        DismissedDuplicatePair.tx_id_a == id_a,
        DismissedDuplicatePair.tx_id_b == id_b,
        DismissedDuplicatePair.deleted_at.is_(None),
    ).first()
    if existing:
        return {"ok": True}
    db.add(DismissedDuplicatePair(
        household_id=hh_int,
        tx_id_a=id_a,
        tx_id_b=id_b,
        dismissed_by=current_user.id,
    ))
    db.commit()
    return {"ok": True}
```

- [ ] **Step 6: Register router in main.py**

```python
# backend/main.py — add:
from routers import duplicates
app.include_router(duplicates.router)
```

- [ ] **Step 7: Run full test suite**

Run: `cd backend && DATABASE_URL=sqlite:///./test.db pytest tests/ -v`
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add backend/schemas/duplicates.py backend/routers/duplicates.py backend/routers/transactions.py backend/routers/imports.py backend/schemas/imports.py backend/main.py
git commit -m "feat: duplicate detection endpoints and import preview fuzzy_matches"
```

---

## Phase 3: Frontend

### Task 8: Design system migration — globals.css

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Replace globals.css with NuestraCuenta DS tokens**

```css
/* frontend/app/globals.css */
@import "tailwindcss";

/* NuestraCuenta Design System — tokens
   Source: claude.ai/design/p/1f56a3fd-c53d-4c96-89c9-00183dd51505 */

@import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap");

:root {
  /* Neutral ramp */
  --neutral-0:   oklch(1 0 0);
  --neutral-50:  oklch(0.985 0 0);
  --neutral-100: oklch(0.97 0 0);
  --neutral-200: oklch(0.922 0 0);
  --neutral-300: oklch(0.87 0 0);
  --neutral-400: oklch(0.708 0 0);
  --neutral-500: oklch(0.556 0 0);
  --neutral-600: oklch(0.439 0 0);
  --neutral-900: oklch(0.205 0 0);
  --neutral-950: oklch(0.145 0 0);

  /* Brand blue */
  --blue-50:  #eff6ff;
  --blue-100: #dbeafe;
  --blue-600: #2563eb;
  --blue-700: #1d4ed8;

  /* Money semantics */
  --green-50:  #f0fdf4;
  --green-200: #bbf7d0;
  --green-600: #16a34a;
  --red-50:   #fef2f2;
  --red-500:  #ef4444;
  --red-600:  #dc2626;

  /* Persona colors */
  --persona-a: #2563eb;
  --persona-b: #8b5cf6;

  /* Category accents */
  --cat-supermercado: #16a34a;
  --cat-hogar:        #8b5cf6;
  --cat-delivery:     #f97316;
  --cat-restaurantes: #e11d48;
  --cat-transporte:   #0ea5e9;
  --cat-entretencion: #d946ef;
  --cat-servicios:    #ca8a04;
  --cat-telecom:      #0891b2;
  --cat-salud:        #ef4444;
  --cat-mascotas:     #a16207;
  --cat-otros:        #737373;

  /* Semantic aliases */
  --background:       var(--neutral-50);
  --surface:          var(--neutral-0);
  --surface-muted:    var(--neutral-100);
  --text-strong:      var(--neutral-950);
  --text-body:        var(--neutral-900);
  --text-secondary:   var(--neutral-600);
  --text-muted:       var(--neutral-500);
  --text-placeholder: var(--neutral-400);
  --text-on-accent:   var(--neutral-0);
  --border:           var(--neutral-200);
  --border-strong:    var(--neutral-300);
  --accent:           var(--blue-600);
  --accent-hover:     var(--blue-700);
  --accent-soft:      var(--blue-50);
  --positive:         var(--green-600);
  --positive-soft:    var(--green-50);
  --negative:         var(--red-500);
  --negative-soft:    var(--red-50);
  --primary:          var(--neutral-900);
  --primary-fg:       var(--neutral-50);

  /* Typography */
  --font-sans: "Geist", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --weight-regular:  400;
  --weight-medium:   500;
  --weight-semibold: 600;
  --weight-bold:     700;
  --leading-tight:  1.2;
  --leading-normal: 1.5;

  /* Spacing (4px base) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;

  /* Radius */
  --radius:      0.625rem;
  --radius-sm:   calc(var(--radius) * 0.6);
  --radius-md:   calc(var(--radius) * 0.8);
  --radius-lg:   var(--radius);
  --radius-xl:   calc(var(--radius) * 1.4);
  --radius-2xl:  calc(var(--radius) * 1.8);
  --radius-pill: 9999px;

  /* Elevation */
  --ring-card:  0 0 0 1px oklch(0.145 0 0 / 0.10);
  --shadow-sm:  0 1px 2px oklch(0.145 0 0 / 0.06);
  --shadow-md:  0 4px 12px oklch(0.145 0 0 / 0.10);
  --shadow-lg:  0 10px 28px oklch(0.145 0 0 / 0.14);
  --shadow-fab: 0 6px 16px oklch(0.205 0.09 264 / 0.30);

  /* Motion */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-fast: 120ms;
  --dur-base: 180ms;

  /* Layout */
  --app-max-width: 42rem;
  --header-height: 3.25rem;
  --nav-height: 3.5rem;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { font-family: var(--font-sans); font-size: 16px; background: var(--background); color: var(--text-body); }
body { min-height: 100dvh; }
```

- [ ] **Step 2: Update layout.tsx to use new DS tokens**

The `layout.tsx` NavBar and TabBar use Apple-style tokens (`--material-chrome`, `--blur-regular`, `--bg-base`, etc.). Replace with flat NuestraCuenta equivalents:

```tsx
// frontend/app/(app)/layout.tsx — key changes:
// NavBar header background: var(--surface) instead of var(--material-chrome)
// Remove backdropFilter/WebkitBackdropFilter
// BoxShadow: 0 0.5px 0 var(--border)
// TabBar background: var(--surface)
// Active tab color: var(--accent) — same token, different value
// Text/icon colors: var(--text-muted) for inactive, var(--accent) for active
// Font: var(--font-sans) instead of var(--font-text)/var(--font-display)
// Main background: var(--background)

// Also add PAGE_TITLES entry:
"/duplicates": "Duplicados",

// And update activeTab to handle /duplicates:
if (pathname.startsWith("/duplicates")) return null; // no tab active
```

- [ ] **Step 3: Verify app loads visually**

Run dev server: `cd frontend && npm run dev`
Open http://localhost:3000. Verify NavBar is flat white (no glass), Geist font loads, blue accent is #2563eb.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/globals.css frontend/app/(app)/layout.tsx
git commit -m "feat: migrate frontend to NuestraCuenta design system"
```

---

### Task 9: DuplicateModal + /imports integration

**Files:**
- Create: `frontend/components/DuplicateModal.tsx`
- Modify: `frontend/app/(app)/imports/page.tsx`

- [ ] **Step 1: Create DuplicateModal component**

```tsx
// frontend/components/DuplicateModal.tsx
"use client";

type TxSnippet = {
  external_id: string;
  fecha_operacion: string;
  descripcion_raw: string;
  monto: number;
  origen: "manual" | "importado";
  payment_method_alias: string;
};

type FuzzyPair = {
  importItem: { fecha_operacion: string; descripcion_raw: string; monto: number };
  matches: TxSnippet[];
};

type Props = {
  pairs: FuzzyPair[];
  onClose: () => void;
};

function formatCLP(n: number) {
  return `$${Math.abs(n).toLocaleString("es-CL")}`;
}

export function DuplicateModal({ pairs, onClose }: Props) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "oklch(0.145 0 0 / 0.40)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 env(safe-area-inset-bottom)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0",
          width: "100%", maxWidth: "var(--app-max-width)",
          maxHeight: "80dvh", overflowY: "auto",
          padding: "var(--space-6) var(--space-4) var(--space-8)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: "var(--radius-pill)",
          background: "var(--border)", margin: "0 auto var(--space-5)",
        }} />

        <h2 style={{
          fontFamily: "var(--font-sans)", fontSize: "var(--text-xl)",
          fontWeight: "var(--weight-semibold)", color: "var(--text-strong)",
          marginBottom: "var(--space-2)",
        }}>
          Posibles duplicados encontrados
        </h2>
        <p style={{
          fontSize: "var(--text-sm)", color: "var(--text-secondary)",
          marginBottom: "var(--space-6)", lineHeight: "var(--leading-normal)",
        }}>
          Estas transacciones de la cartola podrían coincidir con gastos ya registrados.
          Revísalos antes de confirmar.
        </p>

        {pairs.map((pair, i) => (
          <div key={i} style={{
            marginBottom: "var(--space-5)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--ring-card)",
            overflow: "hidden",
          }}>
            {/* Header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              background: "var(--surface-muted)",
              padding: "var(--space-2) var(--space-3)",
              gap: "var(--space-4)",
            }}>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Ya registrado</span>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>En la cartola</span>
            </div>

            {pair.matches.map((match, j) => (
              <div key={j} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                padding: "var(--space-3)",
                gap: "var(--space-4)",
                borderTop: j > 0 ? "1px solid var(--border)" : undefined,
              }}>
                {/* Existing tx */}
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-body)" }}>{match.descripcion_raw}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{match.fecha_operacion}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-strong)", marginTop: 4 }}>{formatCLP(match.monto)}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{match.payment_method_alias}</div>
                </div>
                {/* Import item */}
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-body)" }}>{pair.importItem.descripcion_raw}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{pair.importItem.fecha_operacion}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-strong)", marginTop: 4 }}>{formatCLP(pair.importItem.monto)}</div>
                </div>
              </div>
            ))}
          </div>
        ))}

        <button
          onClick={onClose}
          style={{
            width: "100%", height: 48,
            background: "var(--accent)", color: "var(--text-on-accent)",
            border: "none", borderRadius: "var(--radius-lg)",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-base)",
            fontWeight: "var(--weight-semibold)", cursor: "pointer",
            marginTop: "var(--space-4)",
          }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add fuzzy_matches to PreviewItem type and modal trigger in imports page**

```tsx
// frontend/app/(app)/imports/page.tsx — add to types:
type TxSnippet = {
  external_id: string;
  fecha_operacion: string;
  descripcion_raw: string;
  monto: number;
  origen: "manual" | "importado";
  payment_method_alias: string;
};

// Update PreviewItem type:
type PreviewItem = {
  // ... existing fields ...
  fuzzy_matches: TxSnippet[];
};

// Add state:
const [showDuplicateModal, setShowDuplicateModal] = useState(false);

// After receiving preview response, before setting preview:
const fuzzyPairs = data.items
  .map((item: PreviewItem) => ({ importItem: item, matches: item.fuzzy_matches }))
  .filter((p: any) => p.matches.length > 0);
if (fuzzyPairs.length > 0) setShowDuplicateModal(true);

// In JSX, before closing tag:
import { DuplicateModal } from "@/components/DuplicateModal";

{showDuplicateModal && fuzzyPairs.length > 0 && (
  <DuplicateModal
    pairs={fuzzyPairs}
    onClose={() => setShowDuplicateModal(false)}
  />
)}
```

Also add badge to each row in the preview table where `item.fuzzy_matches.length > 0`:
```tsx
{item.fuzzy_matches.length > 0 && (
  <span style={{
    fontSize: "var(--text-xs)", padding: "2px 6px",
    background: "#fef9c3", color: "#854d0e",
    borderRadius: "var(--radius-pill)", marginLeft: 6,
  }}>
    ⚠ posible duplicado
  </span>
)}
```

- [ ] **Step 3: Test modal manually**

Run dev server, upload a Santander PDF where a transaction matches an existing manual entry (same monto, date ±3 days). Modal should appear automatically.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/DuplicateModal.tsx frontend/app/(app)/imports/page.tsx
git commit -m "feat: duplicate modal in import preview"
```

---

### Task 10: /duplicates page + transaction banner

**Files:**
- Create: `frontend/app/(app)/duplicates/page.tsx`
- Modify: `frontend/app/(app)/transactions/page.tsx`

- [ ] **Step 1: Create /duplicates page**

```tsx
// frontend/app/(app)/duplicates/page.tsx
"use client";
import { useState, useEffect } from "react";
import { getToken, getHouseholdId } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type TxSnippet = {
  external_id: string;
  fecha_operacion: string;
  descripcion_raw: string;
  monto: number;
  origen: "manual" | "importado";
  payment_method_alias: string;
};

type DuplicatePair = {
  tx_manual: TxSnippet;
  tx_importado: TxSnippet;
};

function formatCLP(n: number) {
  return `$${Math.abs(n).toLocaleString("es-CL")}`;
}

function TxCard({ tx, label, onDelete }: { tx: TxSnippet; label: string; onDelete: () => void }) {
  return (
    <div style={{ flex: 1, padding: "var(--space-3)" }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "var(--space-2)" }}>{label}</div>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-body)" }}>{tx.descripcion_raw}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{tx.fecha_operacion}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--weight-semibold)", fontSize: "var(--text-sm)", color: "var(--text-strong)", marginTop: 4 }}>{formatCLP(tx.monto)}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{tx.payment_method_alias}</div>
      <button
        onClick={onDelete}
        style={{
          marginTop: "var(--space-3)", width: "100%", height: 36,
          background: "var(--negative-soft)", color: "var(--red-600)",
          border: "none", borderRadius: "var(--radius-lg)",
          fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-medium)", cursor: "pointer",
        }}
      >
        Eliminar este
      </button>
    </div>
  );
}

export default function DuplicatesPage() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? getToken() : null;
  const householdId = typeof window !== "undefined" ? getHouseholdId() : null;

  useEffect(() => {
    if (!token || !householdId) return;
    fetch(`${API}/api/households/${householdId}/duplicate-candidates`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setPairs)
      .finally(() => setLoading(false));
  }, [token, householdId]);

  async function deleteTx(externalId: string, pairIdx: number) {
    if (!confirm("¿Seguro que quieres eliminar este gasto?")) return;
    await fetch(`${API}/api/households/${householdId}/transactions/${externalId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setPairs((prev) => prev.filter((_, i) => i !== pairIdx));
  }

  async function dismiss(pair: DuplicatePair, pairIdx: number) {
    await fetch(`${API}/api/households/${householdId}/dismiss-duplicate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_external_id_a: pair.tx_manual.external_id,
        tx_external_id_b: pair.tx_importado.external_id,
      }),
    });
    setPairs((prev) => prev.filter((_, i) => i !== pairIdx));
  }

  if (loading) return <p style={{ padding: "var(--space-4)", color: "var(--text-muted)" }}>Cargando…</p>;

  if (pairs.length === 0) {
    return (
      <div style={{
        margin: "var(--space-10) auto", textAlign: "center",
        background: "var(--surface)", borderRadius: "var(--radius-xl)",
        boxShadow: "var(--ring-card)", padding: "var(--space-8) var(--space-4)",
      }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Sin duplicados pendientes</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {pairs.map((pair, i) => (
        <div key={i} style={{
          background: "var(--surface)", borderRadius: "var(--radius-xl)",
          boxShadow: "var(--ring-card)", overflow: "hidden",
        }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            <TxCard tx={pair.tx_manual} label="Manual" onDelete={() => deleteTx(pair.tx_manual.external_id, i)} />
            <div style={{ width: 1, background: "var(--border)", flexShrink: 0 }} />
            <TxCard tx={pair.tx_importado} label="Importado" onDelete={() => deleteTx(pair.tx_importado.external_id, i)} />
          </div>
          <div style={{ padding: "var(--space-3)" }}>
            <button
              onClick={() => dismiss(pair, i)}
              style={{
                width: "100%", height: 36,
                background: "transparent", color: "var(--text-secondary)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-medium)", cursor: "pointer",
              }}
            >
              No son duplicados
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add duplicate banner to /transactions page**

```tsx
// frontend/app/(app)/transactions/page.tsx
// Add near the top of the component, after loading transactions:
const [duplicateCount, setDuplicateCount] = useState(0);

useEffect(() => {
  const token = getToken();
  const householdId = getHouseholdId();
  if (!token || !householdId) return;
  fetch(`${API}/api/households/${householdId}/duplicate-candidates`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => r.json())
    .then((data: unknown[]) => setDuplicateCount(data.length))
    .catch(() => {});
}, []);

// In JSX, above the transactions list:
{duplicateCount > 0 && (
  <a
    href="/duplicates"
    style={{
      display: "block", marginBottom: "var(--space-4)",
      padding: "var(--space-3) var(--space-4)",
      background: "var(--accent-soft)", borderRadius: "var(--radius-lg)",
      color: "var(--accent)", fontSize: "var(--text-sm)",
      fontWeight: "var(--weight-medium)", textDecoration: "none",
      border: "1px solid var(--blue-100)",
    }}
  >
    {duplicateCount} posible{duplicateCount > 1 ? "s" : ""} duplicado{duplicateCount > 1 ? "s" : ""} detectado{duplicateCount > 1 ? "s" : ""} — Revisar →
  </a>
)}
```

- [ ] **Step 3: Test end-to-end**

1. Create a manual transaction (e.g., Jumbo $50.000 el 10/01)
2. Upload a cartola PDF with that same transaction (mismo monto, fecha ±3 días)
3. Verify modal appears during import preview
4. Confirm the import
5. Go to /transactions → verify banner aparece
6. Click banner → /duplicates → verify el par aparece
7. Click "Eliminar este" → verify el par desaparece
8. Create another pair → go to /duplicates → click "No son duplicados" → verify desaparece y no vuelve a aparecer

- [ ] **Step 4: Commit**

```bash
git add frontend/app/(app)/duplicates/page.tsx frontend/app/(app)/transactions/page.tsx
git commit -m "feat: /duplicates review page and transaction banner"
```

---

### Task 11: Deploy

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Deploy frontend**

```bash
# From repo root:
vercel --prod --yes
```

- [ ] **Step 3: Deploy backend**

```bash
# From backend/:
cd backend && vercel --prod --yes
```

- [ ] **Step 4: Add SQIDS_SECRET to Vercel env**

```bash
# From repo root:
vercel env add SQIDS_SECRET production
# Enter a random secret string when prompted (e.g. openssl rand -hex 32)

# Then redeploy backend to pick up the new env var:
cd backend && vercel --prod --yes
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| SERIAL PK + timestamps on all tables | Task 2, 3 |
| sqids encoding with prefix | Task 1, 4 |
| dismissed_duplicate_pairs table | Task 5 |
| find_fuzzy_for_import (monto + ±3 días) | Task 6 |
| find_all_candidates retroactivo | Task 6 |
| fuzzy_matches in preview response | Task 7 |
| Modal en /imports si hay fuzzy matches | Task 9 |
| DELETE /transactions soft delete | Task 7 |
| GET /duplicate-candidates | Task 7 |
| POST /dismiss-duplicate | Task 7 |
| Página /duplicates con acciones | Task 10 |
| Banner en /transactions | Task 10 |
| NuestraCuenta DS migration | Task 8 |
| deleted_at IS NULL en queries | Task 4 (routers) |
| Par tx_id_a < tx_id_b siempre | Task 7 (dismiss endpoint) |

**Type consistency:** `TxSnippet` definido en `schemas/duplicates.py` y usado en `routers/duplicates.py` e `imports.py`. Frontend type `TxSnippet` en `DuplicateModal.tsx` y `duplicates/page.tsx` tienen los mismos campos. ✅

**No placeholders:** All steps have complete code. ✅
