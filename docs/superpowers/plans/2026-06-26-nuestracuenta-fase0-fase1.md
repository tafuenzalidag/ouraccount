# NuestraCuenta — Plan de Implementación (Fase 0 + Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el MVP de NuestraCuenta: autenticación, gestión de Hogar, imputación manual de gastos, motor de split 57/43, liquidación de periodo y dashboard básico — desplegado en Vercel con FastAPI + Next.js + Vercel Postgres.

**Architecture:** Monorepo GitHub con `/backend` (FastAPI Python como serverless functions en Vercel) y `/frontend` (Next.js App Router). La base de datos es Vercel Postgres (Neon, compatible con SQLAlchemy). No hay filesystem persistente; todo el procesamiento es in-memory.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, passlib[bcrypt], python-jose, pytest, psycopg2-binary / asyncpg — Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui — Vercel, GitHub.

## Global Constraints

- Python >= 3.11
- Node >= 20
- Montos siempre en CLP como entero (bigint). Sin decimales. Negativo = abono.
- Ratio de reparto: suma de los 2 miembros debe ser exactamente 1.00
- El último peso de redondeo siempre va al segundo miembro (`monto_B = total - monto_A`)
- UUIDs como PK en todas las tablas
- Nunca guardar contraseñas en texto plano; solo `password_hash` (bcrypt)
- JWT firmado con `JWT_SECRET` de variable de entorno
- Datos del Hogar accesibles solo por sus 2 miembros (verificar `household_id` en cada endpoint)
- Moneda única: CLP
- Solo 2 personas por Hogar en el MVP

---

## Mapa de archivos

### Backend
```
backend/
├── main.py                          # FastAPI app + routers registrados
├── api/
│   └── index.py                     # Entry point Vercel serverless (importa app de main.py)
├── database.py                      # Engine SQLAlchemy + get_db dependency
├── models/
│   ├── __init__.py
│   ├── user.py                      # User
│   ├── household.py                 # Household, HouseholdMember
│   ├── payment_method.py            # PaymentMethod
│   ├── category.py                  # Category
│   ├── transaction.py               # Transaction, InstallmentPlan
│   ├── split.py                     # SplitAllocation
│   ├── settlement.py                # Settlement
│   ├── merchant_rule.py             # MerchantRule
│   └── import_batch.py              # ImportBatch
├── schemas/
│   ├── auth.py                      # RegisterRequest, LoginRequest, TokenResponse, UserOut
│   ├── household.py                 # HouseholdCreate, HouseholdOut, MemberOut, InviteOut
│   ├── payment_method.py            # PaymentMethodCreate, PaymentMethodOut
│   ├── category.py                  # CategoryCreate, CategoryOut
│   ├── transaction.py               # TransactionCreate, TransactionOut
│   ├── split.py                     # SplitAllocationOut
│   └── settlement.py                # SettlementOut, SettlementPeriodOut
├── routers/
│   ├── auth.py                      # POST /auth/register, /auth/login, GET /auth/me
│   ├── households.py                # POST /households, /households/{id}/members, /invite, /join
│   ├── payment_methods.py           # GET/POST /households/{id}/payment-methods
│   ├── categories.py                # GET/POST /households/{id}/categories
│   ├── transactions.py              # GET/POST /households/{id}/transactions
│   └── settlements.py               # GET /households/{id}/settlement, POST /settlements/{id}/pay
├── services/
│   ├── auth.py                      # hash_password, verify_password, create_token, decode_token
│   └── split.py                     # compute_split(tx, members), compute_settlement(period, db)
├── alembic/
│   ├── env.py
│   └── versions/                    # migraciones generadas
├── tests/
│   ├── conftest.py                  # fixtures: test DB, client, users, household
│   ├── test_auth.py
│   ├── test_households.py
│   ├── test_transactions.py
│   └── test_split.py
├── requirements.txt
├── alembic.ini
└── .env.example
```

### Frontend
```
frontend/
├── app/
│   ├── layout.tsx                   # Root layout (fuentes, providers)
│   ├── page.tsx                     # Redirect a /dashboard o /login
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (app)/
│       ├── layout.tsx               # Shell con nav lateral/bottom
│       ├── dashboard/page.tsx       # Resumen del periodo actual
│       ├── transactions/
│       │   ├── page.tsx             # Lista de transacciones
│       │   └── new/page.tsx         # Formulario imputación manual
│       ├── settlement/page.tsx      # Liquidación del periodo
│       └── settings/page.tsx        # Hogar, medios de pago, categorías
├── lib/
│   ├── api.ts                       # fetch wrapper con base URL + auth header
│   └── auth.ts                      # getToken, setToken, clearToken (localStorage)
├── components/
│   ├── ui/                          # shadcn/ui components (Button, Input, etc.)
│   ├── TransactionForm.tsx
│   ├── TransactionList.tsx
│   ├── SettlementCard.tsx
│   └── CategoryBadge.tsx
├── types/
│   └── api.ts                       # TypeScript types que reflejan los schemas del backend
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Raíz del monorepo
```
/
├── vercel.json
├── .gitignore
├── .env.example
└── README.md
```

---

## FASE 0 — Setup del proyecto

### Task 0.1: Inicializar monorepo y estructura de carpetas

**Files:**
- Create: `.gitignore`
- Create: `vercel.json`
- Create: `.env.example`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/main.py`
- Create: `backend/api/index.py`

**Interfaces:**
- Produces: repo git inicializado, estructura de carpetas, `app` FastAPI importable

- [ ] **Step 1: Crear repo local y estructura**

```bash
cd "/Users/tomaspersonal/Documents/Gastos Departamento"
git init
mkdir -p backend/{api,models,schemas,routers,services,tests,alembic/versions}
mkdir -p frontend
```

- [ ] **Step 2: Crear `.gitignore`**

```
# Python
__pycache__/
*.pyc
*.pyo
.env
.venv/
venv/
*.egg-info/
.pytest_cache/
.mypy_cache/

# Node
node_modules/
.next/
out/
.env.local
.env*.local

# Vercel
.vercel/

# OS
.DS_Store
```

- [ ] **Step 3: Crear `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
alembic==1.13.3
pydantic[email]==2.9.2
pydantic-settings==2.5.2
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
psycopg2-binary==2.9.9
python-multipart==0.0.12
pdfplumber==0.11.4
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
```

- [ ] **Step 4: Crear `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="NuestraCuenta API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Crear `backend/api/index.py`**

```python
from main import app  # noqa: F401 — Vercel busca `app` en este módulo
```

- [ ] **Step 6: Crear `vercel.json`**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/api/index.py",
      "use": "@vercel/python"
    },
    {
      "src": "frontend/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/api/index.py"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/$1"
    }
  ]
}
```

- [ ] **Step 7: Crear `.env.example` en raíz y en `backend/`**

```bash
# backend/.env.example
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=change-me-to-a-random-32-char-string
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
```

- [ ] **Step 8: Verificar que FastAPI arranca**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# En otro terminal:
curl http://localhost:8000/api/health
# Expected: {"status":"ok"}
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: init monorepo structure — FastAPI skeleton + vercel.json"
```

---

### Task 0.2: Inicializar frontend Next.js

**Files:**
- Create: `frontend/` — proyecto Next.js completo
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/auth.ts`
- Create: `frontend/types/api.ts`

**Interfaces:**
- Produces: Next.js corriendo en localhost:3000, `apiFetch` helper disponible

- [ ] **Step 1: Crear proyecto Next.js**

```bash
cd "/Users/tomaspersonal/Documents/Gastos Departamento"
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

Cuando pregunte por shadcn: seleccionar No (se instala en el siguiente paso).

- [ ] **Step 2: Instalar shadcn/ui**

```bash
cd frontend
npx shadcn@latest init
# Seleccionar: Default style, Zinc color, CSS variables: yes
npx shadcn@latest add button input label card badge separator
```

- [ ] **Step 3: Crear `frontend/lib/auth.ts`**

```typescript
const TOKEN_KEY = "nc_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
```

- [ ] **Step 4: Crear `frontend/lib/api.ts`**

```typescript
import { getToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? "API error");
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 5: Crear `frontend/types/api.ts`** (tipos base; se amplía en cada task)

```typescript
export interface UserOut {
  id: string;
  email: string;
  username: string;
  nombre: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
```

- [ ] **Step 6: Crear `frontend/.env.local`**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 7: Verificar que Next.js arranca**

```bash
cd frontend
npm run dev
# Abrir http://localhost:3000 — debe mostrar la página default de Next.js
```

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: init Next.js frontend with shadcn/ui and API helpers"
```

---

### Task 0.3: Base de datos, SQLAlchemy y Alembic

**Files:**
- Create: `backend/database.py`
- Create: `backend/models/__init__.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`

**Interfaces:**
- Produces: `get_db` dependency inyectable en FastAPI, `Base` para definir modelos

- [ ] **Step 1: Crear `backend/database.py`**

```python
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Inicializar Alembic**

```bash
cd backend
alembic init alembic
```

- [ ] **Step 3: Editar `backend/alembic/env.py`** — reemplazar el bloque de configuración de target_metadata:

```python
# Al inicio del archivo, después de los imports existentes:
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
from models import *  # noqa: F401,F403 — importar todos los modelos para que Alembic los detecte

# En la función run_migrations_offline() y run_migrations_online():
# Reemplazar: target_metadata = None
# Con:
target_metadata = Base.metadata

# También reemplazar la línea de config.get_main_option("sqlalchemy.url") con:
from database import DATABASE_URL
config.set_main_option("sqlalchemy.url", DATABASE_URL)
```

- [ ] **Step 4: Crear `backend/models/__init__.py`** (vacío por ahora, se llena en Task 1.1)

```python
```

- [ ] **Step 5: Configurar base de datos de test**

Para tests usaremos SQLite en memoria (sin necesidad de Postgres local):

Crear `backend/tests/conftest.py`:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 6: Verificar que pytest corre (sin tests todavía)**

```bash
cd backend
pytest tests/ -v
# Expected: "no tests ran" — sin errores de importación
```

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: SQLAlchemy + Alembic setup with test fixtures"
```

---

## FASE 1 — MVP Core

### Task 1.1: Modelos SQLAlchemy (todas las entidades)

**Files:**
- Create: `backend/models/user.py`
- Create: `backend/models/household.py`
- Create: `backend/models/payment_method.py`
- Create: `backend/models/category.py`
- Create: `backend/models/transaction.py`
- Create: `backend/models/split.py`
- Create: `backend/models/settlement.py`
- Create: `backend/models/merchant_rule.py`
- Create: `backend/models/import_batch.py`
- Modify: `backend/models/__init__.py`

**Interfaces:**
- Produces: todos los modelos SQLAlchemy importables desde `models.*`, listos para Alembic

- [ ] **Step 1: Crear `backend/models/user.py`**

```python
import uuid
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
```

- [ ] **Step 2: Crear `backend/models/household.py`**

```python
import uuid
from datetime import date
from sqlalchemy import String, Date, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class Household(Base):
    __tablename__ = "households"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    moneda: Mapped[str] = mapped_column(String, default="CLP")
    creado_en: Mapped[date] = mapped_column(Date, default=date.today)

class HouseholdMember(Base):
    __tablename__ = "household_members"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    ratio_default: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    nombre_display: Mapped[str | None] = mapped_column(String, nullable=True)
    invite_code: Mapped[str | None] = mapped_column(String, nullable=True)
```

- [ ] **Step 3: Crear `backend/models/payment_method.py`**

```python
import uuid
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    owner_user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    tipo: Mapped[str] = mapped_column(String, nullable=False)  # cuenta_corriente | tarjeta_credito
    alias: Mapped[str] = mapped_column(String, nullable=False)
    ultimos_digitos: Mapped[str | None] = mapped_column(String(4), nullable=True)
    es_compartido: Mapped[bool] = mapped_column(Boolean, default=True)
    banco: Mapped[str | None] = mapped_column(String, nullable=True)
```

- [ ] **Step 4: Crear `backend/models/category.py`**

```python
import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(String, ForeignKey("categories.id"), nullable=True)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    icono: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
```

- [ ] **Step 5: Crear `backend/models/transaction.py`**

```python
import uuid
from datetime import date
from sqlalchemy import String, BigInteger, Boolean, Date, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class InstallmentPlan(Base):
    __tablename__ = "installment_plans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    descripcion: Mapped[str] = mapped_column(String, nullable=False)
    monto_total: Mapped[int] = mapped_column(BigInteger, nullable=False)
    cuota_actual: Mapped[int] = mapped_column(Integer, nullable=False)
    cuotas_totales: Mapped[int] = mapped_column(Integer, nullable=False)
    valor_cuota_mensual: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tasa: Mapped[float] = mapped_column(Numeric(6, 4), default=0.0)

class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    import_batch_id: Mapped[str | None] = mapped_column(String, ForeignKey("import_batches.id"), nullable=True)
    payment_method_id: Mapped[str] = mapped_column(String, ForeignKey("payment_methods.id"), nullable=False)
    payer_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    category_id: Mapped[str | None] = mapped_column(String, ForeignKey("categories.id"), nullable=True)
    installment_plan_id: Mapped[str | None] = mapped_column(String, ForeignKey("installment_plans.id"), nullable=True)
    fecha_operacion: Mapped[date] = mapped_column(Date, nullable=False)
    descripcion_raw: Mapped[str] = mapped_column(String, nullable=False)
    descripcion_norm: Mapped[str] = mapped_column(String, nullable=False)
    lugar: Mapped[str | None] = mapped_column(String, nullable=True)
    monto: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tipo_movimiento: Mapped[str] = mapped_column(String, nullable=False)  # compra|abono|impuesto|cuota|interno
    es_hogar: Mapped[bool] = mapped_column(Boolean, default=True)
    es_interno: Mapped[bool] = mapped_column(Boolean, default=False)
    hash_dedupe: Mapped[str] = mapped_column(String, nullable=False)
    split_override: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    creado_en: Mapped[date] = mapped_column(Date, default=date.today)
```

- [ ] **Step 6: Crear `backend/models/split.py`**

```python
import uuid
from sqlalchemy import String, BigInteger, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class SplitAllocation(Base):
    __tablename__ = "split_allocations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id: Mapped[str] = mapped_column(String, ForeignKey("transactions.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    ratio: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    monto_asignado: Mapped[int] = mapped_column(BigInteger, nullable=False)
```

- [ ] **Step 7: Crear `backend/models/settlement.py`**

```python
import uuid
from datetime import date
from sqlalchemy import String, BigInteger, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    periodo_desde: Mapped[date] = mapped_column(Date, nullable=False)
    periodo_hasta: Mapped[date] = mapped_column(Date, nullable=False)
    deudor_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    acreedor_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    monto: Mapped[int] = mapped_column(BigInteger, nullable=False)
    estado: Mapped[str] = mapped_column(String, default="pendiente")  # pendiente | pagado
    pagado_en: Mapped[date | None] = mapped_column(Date, nullable=True)
```

- [ ] **Step 8: Crear `backend/models/merchant_rule.py`**

```python
import uuid
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class MerchantRule(Base):
    __tablename__ = "merchant_rules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    patron: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[str] = mapped_column(String, ForeignKey("categories.id"), nullable=False)
    es_hogar_default: Mapped[bool] = mapped_column(Boolean, default=True)
```

- [ ] **Step 9: Crear `backend/models/import_batch.py`**

```python
import uuid
from datetime import date
from sqlalchemy import String, BigInteger, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    payment_method_id: Mapped[str] = mapped_column(String, ForeignKey("payment_methods.id"), nullable=False)
    archivo_origen: Mapped[str] = mapped_column(String, nullable=False)  # pdf | csv
    periodo_desde: Mapped[date | None] = mapped_column(Date, nullable=True)
    periodo_hasta: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_facturado_declarado: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    importado_en: Mapped[date] = mapped_column(Date, default=date.today)
    estado: Mapped[str] = mapped_column(String, default="preview")  # preview | confirmado
```

- [ ] **Step 10: Actualizar `backend/models/__init__.py`**

```python
from .user import User
from .household import Household, HouseholdMember
from .payment_method import PaymentMethod
from .category import Category
from .import_batch import ImportBatch
from .transaction import Transaction, InstallmentPlan
from .split import SplitAllocation
from .settlement import Settlement
from .merchant_rule import MerchantRule
```

- [ ] **Step 11: Escribir test que verifica que todos los modelos se crean**

En `backend/tests/test_models.py`:

```python
from models import (
    User, Household, HouseholdMember, PaymentMethod, Category,
    ImportBatch, Transaction, InstallmentPlan, SplitAllocation,
    Settlement, MerchantRule
)
from database import Base

def test_all_models_importable():
    tables = Base.metadata.tables
    assert "users" in tables
    assert "households" in tables
    assert "household_members" in tables
    assert "payment_methods" in tables
    assert "categories" in tables
    assert "import_batches" in tables
    assert "transactions" in tables
    assert "installment_plans" in tables
    assert "split_allocations" in tables
    assert "settlements" in tables
    assert "merchant_rules" in tables
```

- [ ] **Step 12: Correr el test**

```bash
cd backend
pytest tests/test_models.py -v
# Expected: PASSED — 1 test
```

- [ ] **Step 13: Generar migración Alembic**

```bash
# Asegurarse de que DATABASE_URL esté en el entorno (usar una DB de desarrollo)
alembic revision --autogenerate -m "initial schema"
# Revisar el archivo generado en alembic/versions/
```

- [ ] **Step 14: Commit**

```bash
git add backend/
git commit -m "feat: all SQLAlchemy models + initial Alembic migration"
```

---

### Task 1.2: Auth — register, login, JWT

**Files:**
- Create: `backend/services/auth.py`
- Create: `backend/schemas/auth.py`
- Create: `backend/routers/auth.py`
- Modify: `backend/main.py`

**Interfaces:**
- Produces:
  - `hash_password(plain: str) -> str`
  - `verify_password(plain: str, hashed: str) -> bool`
  - `create_token(user_id: str) -> str`
  - `get_current_user(token: str, db: Session) -> User`
  - `POST /api/auth/register` → `TokenResponse`
  - `POST /api/auth/login` → `TokenResponse`
  - `GET /api/auth/me` → `UserOut`

- [ ] **Step 1: Escribir tests de auth**

En `backend/tests/test_auth.py`:

```python
def test_register(client):
    res = client.post("/api/auth/register", json={
        "email": "tomas@test.com",
        "username": "tomas",
        "password": "secret123",
        "nombre": "Tomas"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_register_duplicate_email(client):
    payload = {"email": "a@test.com", "username": "u1", "password": "x", "nombre": "A"}
    client.post("/api/auth/register", json=payload)
    res = client.post("/api/auth/register", json={**payload, "username": "u2"})
    assert res.status_code == 400

def test_login(client):
    client.post("/api/auth/register", json={
        "email": "b@test.com", "username": "b", "password": "pass", "nombre": "B"
    })
    res = client.post("/api/auth/login", json={"email": "b@test.com", "password": "pass"})
    assert res.status_code == 200
    assert "access_token" in res.json()

def test_login_wrong_password(client):
    client.post("/api/auth/register", json={
        "email": "c@test.com", "username": "c", "password": "right", "nombre": "C"
    })
    res = client.post("/api/auth/login", json={"email": "c@test.com", "password": "wrong"})
    assert res.status_code == 401

def test_me(client):
    client.post("/api/auth/register", json={
        "email": "d@test.com", "username": "d", "password": "p", "nombre": "D"
    })
    login = client.post("/api/auth/login", json={"email": "d@test.com", "password": "p"})
    token = login.json()["access_token"]
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "d@test.com"
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
pytest tests/test_auth.py -v
# Expected: ERROR — router no existe
```

- [ ] **Step 3: Crear `backend/services/auth.py`**

```python
import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_db
from models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

SECRET_KEY = os.environ.get("JWT_SECRET", "dev-secret-change-me")
ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "10080"))

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user
```

- [ ] **Step 4: Crear `backend/schemas/auth.py`**

```python
from pydantic import BaseModel, EmailStr

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    nombre: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    email: str
    username: str
    nombre: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 5: Crear `backend/routers/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserOut
from services.auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email ya registrado")
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username ya tomado")
    user = User(
        email=req.email,
        username=req.username,
        password_hash=hash_password(req.password),
        nombre=req.nombre,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_token(user.id))

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return TokenResponse(access_token=create_token(user.id))

@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
```

- [ ] **Step 6: Registrar router en `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth

app = FastAPI(title="NuestraCuenta API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Correr tests**

```bash
pytest tests/test_auth.py -v
# Expected: 5 PASSED
```

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: auth — register, login, JWT, /me endpoint"
```

---

### Task 1.3: Hogar — crear, invitar, unirse

**Files:**
- Create: `backend/schemas/household.py`
- Create: `backend/routers/households.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `get_current_user` de `services/auth.py`
- Produces:
  - `POST /api/households` → `HouseholdOut`
  - `POST /api/households/{id}/invite` → `InviteOut` (código 6 chars, expira 48h)
  - `POST /api/households/join` → `HouseholdOut`
  - `GET /api/households/{id}` → `HouseholdOut`

- [ ] **Step 1: Escribir tests**

En `backend/tests/test_households.py`:

```python
import pytest

@pytest.fixture
def auth_client(client):
    """Retorna client + token para un usuario registrado."""
    client.post("/api/auth/register", json={
        "email": "a@test.com", "username": "a", "password": "p", "nombre": "A"
    })
    res = client.post("/api/auth/login", json={"email": "a@test.com", "password": "p"})
    token = res.json()["access_token"]
    return client, {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_client_b(client):
    client.post("/api/auth/register", json={
        "email": "b@test.com", "username": "b", "password": "p", "nombre": "B"
    })
    res = client.post("/api/auth/login", json={"email": "b@test.com", "password": "p"})
    token = res.json()["access_token"]
    return client, {"Authorization": f"Bearer {token}"}

def test_create_household(auth_client):
    client, headers = auth_client
    res = client.post("/api/households", json={
        "nombre": "Nuestro Depto",
        "ratio_a": 0.57,
        "nombre_display_a": "Tomas",
        "nombre_display_b": "Cata"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["nombre"] == "Nuestro Depto"
    assert "id" in data

def test_invite_and_join(auth_client, auth_client_b):
    client, headers_a = auth_client
    _, headers_b = auth_client_b

    # A crea hogar
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57,
        "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers_a).json()

    # A genera código
    invite = client.post(f"/api/households/{h['id']}/invite", headers=headers_a)
    assert invite.status_code == 200
    code = invite.json()["code"]
    assert len(code) == 6

    # B usa el código
    join = client.post("/api/households/join", json={"code": code}, headers=headers_b)
    assert join.status_code == 200
    assert join.json()["id"] == h["id"]

def test_join_invalid_code(auth_client_b):
    client, headers = auth_client_b
    res = client.post("/api/households/join", json={"code": "XXXXXX"}, headers=headers)
    assert res.status_code == 404
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
pytest tests/test_households.py -v
# Expected: ERROR
```

- [ ] **Step 3: Crear `backend/schemas/household.py`**

```python
from pydantic import BaseModel

class HouseholdCreate(BaseModel):
    nombre: str
    ratio_a: float  # 0.57 — ratio del creador
    nombre_display_a: str | None = None
    nombre_display_b: str | None = None

class HouseholdOut(BaseModel):
    id: str
    nombre: str
    moneda: str

    model_config = {"from_attributes": True}

class InviteOut(BaseModel):
    code: str
    expires_in_hours: int = 48

class JoinRequest(BaseModel):
    code: str
```

- [ ] **Step 4: Crear `backend/routers/households.py`**

```python
import random
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Household, HouseholdMember
from schemas.household import HouseholdCreate, HouseholdOut, InviteOut, JoinRequest
from services.auth import get_current_user

router = APIRouter(prefix="/api/households", tags=["households"])

def _generate_code(length=6):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))

@router.post("", response_model=HouseholdOut)
def create_household(req: HouseholdCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if abs(req.ratio_a - round(req.ratio_a, 4)) > 1e-6 or not (0 < req.ratio_a < 1):
        raise HTTPException(status_code=400, detail="ratio_a debe estar entre 0 y 1")
    h = Household(nombre=req.nombre)
    db.add(h)
    db.flush()
    member = HouseholdMember(
        household_id=h.id,
        user_id=current_user.id,
        ratio_default=req.ratio_a,
        nombre_display=req.nombre_display_a,
    )
    db.add(member)
    db.commit()
    db.refresh(h)
    return h

@router.post("/{household_id}/invite", response_model=InviteOut)
def invite(household_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")
    code = _generate_code()
    # Guardamos el código en un campo temporal del hogar (reutilizamos invite_code en HouseholdMember)
    # Creamos un slot de miembro vacío con solo el código
    slot = HouseholdMember(
        household_id=household_id,
        user_id="__pending__",  # marcador de slot pendiente
        ratio_default=round(1.0 - float(member.ratio_default), 4),
        invite_code=code,
    )
    db.add(slot)
    db.commit()
    return InviteOut(code=code)

@router.post("/join", response_model=HouseholdOut)
def join(req: JoinRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    slot = db.query(HouseholdMember).filter(
        HouseholdMember.invite_code == req.code,
        HouseholdMember.user_id == "__pending__",
    ).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Código inválido o expirado")
    slot.user_id = current_user.id
    slot.invite_code = None
    db.commit()
    h = db.query(Household).filter(Household.id == slot.household_id).first()
    return h

@router.get("/{household_id}", response_model=HouseholdOut)
def get_household(household_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")
    h = db.query(Household).filter(Household.id == household_id).first()
    return h

@router.get("/{household_id}/members")
def get_members(household_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _assert_member(household_id, current_user, db)
    members = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id != "__pending__",
    ).all()
    users = {u.id: u for u in db.query(User).filter(User.id.in_([m.user_id for m in members])).all()}
    return [
        {
            "user_id": m.user_id,
            "nombre_display": m.nombre_display or users[m.user_id].nombre,
            "ratio_default": float(m.ratio_default),
        }
        for m in members
    ]
```

- [ ] **Step 5: Registrar router en `backend/main.py`**

```python
from routers import auth, households

# ... (después de app.include_router(auth.router))
app.include_router(households.router)
```

- [ ] **Step 6: Correr tests**

```bash
pytest tests/test_households.py -v
# Expected: 4 PASSED
```

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: households — create, invite code, join"
```

---

### Task 1.4: Medios de pago y categorías semilla

**Files:**
- Create: `backend/schemas/payment_method.py`
- Create: `backend/schemas/category.py`
- Create: `backend/routers/payment_methods.py`
- Create: `backend/routers/categories.py`
- Create: `backend/services/seed_categories.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `get_current_user`, `Household`, `HouseholdMember`, `PaymentMethod`, `Category`
- Produces:
  - `POST /api/households/{id}/payment-methods` → `PaymentMethodOut`
  - `GET /api/households/{id}/payment-methods` → `list[PaymentMethodOut]`
  - `GET /api/households/{id}/categories` → `list[CategoryOut]`
  - `POST /api/households/{id}/categories` → `CategoryOut`
  - `seed_categories(household_id, db)` — crea las categorías iniciales al crear el hogar

- [ ] **Step 1: Crear `backend/services/seed_categories.py`**

```python
from sqlalchemy.orm import Session
from models import Category

SEED = [
    ("Alimentación", [("Supermercado", "🛒"), ("Delivery", "🛵"), ("Restaurantes", "🍽️")]),
    ("Hogar", [("Muebles y Deco", "🛋️"), ("Ferretería", "🔧"), ("Limpieza", "🧹")]),
    ("Transporte", []),
    ("Entretención", []),
    ("Servicios básicos", [("Luz", "💡"), ("Agua", "💧"), ("Gas", "🔥")]),
    ("Telecom", []),
    ("Salud", []),
    ("Mascotas", []),
    ("Comisiones/Impuestos", []),
    ("Otros", []),
]

def seed_categories(household_id: str, db: Session) -> None:
    for nombre_padre, hijos in SEED:
        padre = Category(household_id=household_id, nombre=nombre_padre)
        db.add(padre)
        db.flush()
        for nombre_hijo, icono in hijos:
            db.add(Category(household_id=household_id, parent_id=padre.id, nombre=nombre_hijo, icono=icono))
    db.commit()
```

- [ ] **Step 2: Llamar `seed_categories` al crear el hogar**

En `backend/routers/households.py`, después del `db.flush()` del hogar:

```python
from services.seed_categories import seed_categories
# ...
db.commit()
seed_categories(h.id, db)
db.refresh(h)
```

- [ ] **Step 3: Crear `backend/schemas/payment_method.py`**

```python
from pydantic import BaseModel

class PaymentMethodCreate(BaseModel):
    tipo: str  # cuenta_corriente | tarjeta_credito
    alias: str
    ultimos_digitos: str | None = None
    es_compartido: bool = True
    banco: str | None = None
    owner_user_id: str | None = None  # None = compartido

class PaymentMethodOut(BaseModel):
    id: str
    tipo: str
    alias: str
    ultimos_digitos: str | None
    es_compartido: bool
    banco: str | None

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Crear `backend/schemas/category.py`**

```python
from pydantic import BaseModel

class CategoryCreate(BaseModel):
    nombre: str
    parent_id: str | None = None
    icono: str | None = None
    color: str | None = None

class CategoryOut(BaseModel):
    id: str
    nombre: str
    parent_id: str | None
    icono: str | None
    color: str | None

    model_config = {"from_attributes": True}
```

- [ ] **Step 5: Crear `backend/routers/payment_methods.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, PaymentMethod
from schemas.payment_method import PaymentMethodCreate, PaymentMethodOut
from services.auth import get_current_user

router = APIRouter(prefix="/api/households", tags=["payment-methods"])

def _assert_member(household_id: str, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")
    return m

@router.get("/{household_id}/payment-methods", response_model=list[PaymentMethodOut])
def list_payment_methods(household_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _assert_member(household_id, current_user, db)
    return db.query(PaymentMethod).filter(PaymentMethod.household_id == household_id).all()

@router.post("/{household_id}/payment-methods", response_model=PaymentMethodOut)
def create_payment_method(household_id: str, req: PaymentMethodCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _assert_member(household_id, current_user, db)
    pm = PaymentMethod(household_id=household_id, **req.model_dump())
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return pm
```

- [ ] **Step 6: Crear `backend/routers/categories.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Category
from schemas.category import CategoryCreate, CategoryOut
from services.auth import get_current_user

router = APIRouter(prefix="/api/households", tags=["categories"])

def _assert_member(household_id: str, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")

@router.get("/{household_id}/categories", response_model=list[CategoryOut])
def list_categories(household_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _assert_member(household_id, current_user, db)
    return db.query(Category).filter(Category.household_id == household_id).all()

@router.post("/{household_id}/categories", response_model=CategoryOut)
def create_category(household_id: str, req: CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _assert_member(household_id, current_user, db)
    cat = Category(household_id=household_id, **req.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat
```

- [ ] **Step 7: Registrar routers en `backend/main.py`**

```python
from routers import auth, households, payment_methods, categories

app.include_router(payment_methods.router)
app.include_router(categories.router)
```

- [ ] **Step 8: Escribir tests**

En `backend/tests/test_households.py`, agregar:

```python
def test_seed_categories_on_create(auth_client):
    client, headers = auth_client
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57,
        "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers).json()
    cats = client.get(f"/api/households/{h['id']}/categories", headers=headers).json()
    nombres = [c["nombre"] for c in cats]
    assert "Alimentación" in nombres
    assert "Supermercado" in nombres
    assert "Comisiones/Impuestos" in nombres

def test_create_payment_method(auth_client):
    client, headers = auth_client
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57,
        "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers).json()
    res = client.post(f"/api/households/{h['id']}/payment-methods", json={
        "tipo": "tarjeta_credito",
        "alias": "TC Compartida",
        "ultimos_digitos": "7777",
        "es_compartido": True,
        "banco": "Santander"
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["alias"] == "TC Compartida"
```

- [ ] **Step 9: Correr tests**

```bash
pytest tests/ -v
# Expected: todos PASSED
```

- [ ] **Step 10: Commit**

```bash
git add backend/
git commit -m "feat: payment methods, categories with seed data"
```

---

### Task 1.5: Motor de split y servicio de liquidación

**Files:**
- Create: `backend/services/split.py`
- Create: `backend/tests/test_split.py`

**Interfaces:**
- Produces:
  - `compute_split(tx: Transaction, members: list[HouseholdMember], db: Session) -> list[SplitAllocation]`
  - `compute_settlement(household_id: str, desde: date, hasta: date, db: Session) -> SettlementResult`

- [ ] **Step 1: Escribir tests del motor de split**

En `backend/tests/test_split.py`:

```python
from datetime import date
from unittest.mock import MagicMock
from services.split import compute_split, compute_settlement, SettlementResult
from models import Transaction, HouseholdMember, SplitAllocation

def _make_member(user_id, ratio):
    m = MagicMock()
    m.user_id = user_id
    m.ratio_default = ratio
    return m

def _make_tx(monto, es_hogar=True, payer_id="A", split_override=None):
    tx = MagicMock()
    tx.id = "tx1"
    tx.monto = monto
    tx.es_hogar = es_hogar
    tx.payer_user_id = payer_id
    tx.split_override = split_override
    return tx

def test_split_57_43():
    members = [_make_member("A", 0.57), _make_member("B", 0.43)]
    tx = _make_tx(100_000)
    db = MagicMock()
    allocs = compute_split(tx, members, db)
    montos = {a.user_id: a.monto_asignado for a in allocs}
    assert montos["A"] == 57_000
    assert montos["B"] == 43_000
    assert montos["A"] + montos["B"] == 100_000

def test_split_no_rounding_loss():
    """$100.001 — el peso extra va al segundo miembro."""
    members = [_make_member("A", 0.57), _make_member("B", 0.43)]
    tx = _make_tx(100_001)
    allocs = compute_split(tx, members, MagicMock())
    montos = {a.user_id: a.monto_asignado for a in allocs}
    assert montos["A"] + montos["B"] == 100_001

def test_split_negative_abono():
    """Un abono de -$10.000 genera split negativo."""
    members = [_make_member("A", 0.57), _make_member("B", 0.43)]
    tx = _make_tx(-10_000)
    allocs = compute_split(tx, members, MagicMock())
    montos = {a.user_id: a.monto_asignado for a in allocs}
    assert montos["A"] < 0
    assert montos["B"] < 0
    assert montos["A"] + montos["B"] == -10_000

def test_split_override():
    """Override 0.5/0.5 ignora el ratio del hogar."""
    members = [_make_member("A", 0.57), _make_member("B", 0.43)]
    tx = _make_tx(100_000, split_override=0.5)
    allocs = compute_split(tx, members, MagicMock())
    montos = {a.user_id: a.monto_asignado for a in allocs}
    assert montos["A"] == 50_000
    assert montos["B"] == 50_000

def test_split_not_hogar():
    """Si es_hogar=False, no se crea split."""
    members = [_make_member("A", 0.57), _make_member("B", 0.43)]
    tx = _make_tx(50_000, es_hogar=False)
    allocs = compute_split(tx, members, MagicMock())
    assert allocs == []

def test_settlement_b_paid_household_expense():
    """
    Caso tarjeta personal: B pagó $20.000 por gasto del hogar.
    A debe $11.400 a B.
    """
    result = SettlementResult(
        pagado={"A": 0, "B": 20_000},
        debido={"A": 11_400, "B": 8_600},
    )
    assert result.balance["A"] == -11_400  # A debe
    assert result.balance["B"] == 11_400   # B recibe
    deudor, acreedor, monto = result.settlement()
    assert deudor == "A"
    assert acreedor == "B"
    assert monto == 11_400
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
pytest tests/test_split.py -v
# Expected: ImportError
```

- [ ] **Step 3: Crear `backend/services/split.py`**

```python
from dataclasses import dataclass, field
from datetime import date
from sqlalchemy.orm import Session
from models import Transaction, HouseholdMember, SplitAllocation

def compute_split(tx, members: list, db: Session) -> list:
    if not tx.es_hogar:
        return []

    ratio_a = float(tx.split_override) if tx.split_override is not None else float(members[0].ratio_default)
    monto_a = round(tx.monto * ratio_a)
    monto_b = tx.monto - monto_a  # resto: evita pérdida de pesos por redondeo

    allocs = []
    for member, monto_asignado in zip(members, [monto_a, monto_b]):
        alloc = SplitAllocation(
            transaction_id=tx.id,
            user_id=member.user_id,
            ratio=ratio_a if member == members[0] else round(1.0 - ratio_a, 4),
            monto_asignado=monto_asignado,
        )
        db.add(alloc)
        allocs.append(alloc)
    return allocs


@dataclass
class SettlementResult:
    pagado: dict[str, int]
    debido: dict[str, int]
    balance: dict[str, int] = field(init=False)

    def __post_init__(self):
        self.balance = {
            uid: self.pagado[uid] - self.debido[uid]
            for uid in self.pagado
        }

    def settlement(self) -> tuple[str, str, int]:
        """Retorna (deudor_id, acreedor_id, monto)."""
        deudor = min(self.balance, key=lambda u: self.balance[u])
        acreedor = max(self.balance, key=lambda u: self.balance[u])
        return deudor, acreedor, abs(self.balance[deudor])


def compute_settlement(household_id: str, desde: date, hasta: date, db: Session) -> SettlementResult:
    members = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id != "__pending__",
    ).all()

    txs = db.query(Transaction).filter(
        Transaction.household_id == household_id,
        Transaction.es_hogar == True,
        Transaction.es_interno == False,
        Transaction.fecha_operacion >= desde,
        Transaction.fecha_operacion <= hasta,
    ).all()

    allocs = db.query(SplitAllocation).filter(
        SplitAllocation.transaction_id.in_([t.id for t in txs])
    ).all() if txs else []

    pagado = {m.user_id: 0 for m in members}
    debido = {m.user_id: 0 for m in members}

    for tx in txs:
        if tx.payer_user_id in pagado:
            pagado[tx.payer_user_id] += tx.monto

    for alloc in allocs:
        if alloc.user_id in debido:
            debido[alloc.user_id] += alloc.monto_asignado

    return SettlementResult(pagado=pagado, debido=debido)
```

- [ ] **Step 4: Correr tests**

```bash
pytest tests/test_split.py -v
# Expected: 6 PASSED
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: split engine + settlement calculation with rounding safety"
```

---

### Task 1.6: Transacciones — imputación manual

**Files:**
- Create: `backend/schemas/transaction.py`
- Create: `backend/routers/transactions.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `compute_split` de `services/split.py`
- Produces:
  - `POST /api/households/{id}/transactions` → `TransactionOut` (crea tx + split automático)
  - `GET /api/households/{id}/transactions` → `list[TransactionOut]`

- [ ] **Step 1: Escribir tests**

En `backend/tests/test_transactions.py`:

```python
import pytest
from datetime import date

@pytest.fixture
def setup(client):
    """Crea 2 usuarios, 1 hogar, 1 medio de pago. Retorna (client, headers_a, headers_b, household_id, pm_id)."""
    # Registrar A
    client.post("/api/auth/register", json={"email": "a@t.com", "username": "a", "password": "p", "nombre": "A"})
    token_a = client.post("/api/auth/login", json={"email": "a@t.com", "password": "p"}).json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Registrar B
    client.post("/api/auth/register", json={"email": "b@t.com", "username": "b", "password": "p", "nombre": "B"})
    token_b = client.post("/api/auth/login", json={"email": "b@t.com", "password": "p"}).json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # A crea hogar
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57, "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers_a).json()
    hid = h["id"]

    # B se une
    code = client.post(f"/api/households/{hid}/invite", headers=headers_a).json()["code"]
    client.post("/api/households/join", json={"code": code}, headers=headers_b)

    # Crear medio de pago
    pm = client.post(f"/api/households/{hid}/payment-methods", json={
        "tipo": "tarjeta_credito", "alias": "TC", "es_compartido": True
    }, headers=headers_a).json()

    return client, headers_a, headers_b, hid, pm["id"]

def test_create_manual_transaction(setup):
    client, headers_a, _, hid, pm_id = setup
    res = client.post(f"/api/households/{hid}/transactions", json={
        "fecha_operacion": str(date.today()),
        "descripcion_raw": "JUMBO",
        "monto": 50_000,
        "payment_method_id": pm_id,
        "es_hogar": True,
    }, headers=headers_a)
    assert res.status_code == 200
    tx = res.json()
    assert tx["monto"] == 50_000
    assert tx["descripcion_norm"] == "JUMBO"

def test_list_transactions(setup):
    client, headers_a, _, hid, pm_id = setup
    client.post(f"/api/households/{hid}/transactions", json={
        "fecha_operacion": str(date.today()),
        "descripcion_raw": "LIDER",
        "monto": 30_000,
        "payment_method_id": pm_id,
        "es_hogar": True,
    }, headers=headers_a)
    res = client.get(f"/api/households/{hid}/transactions", headers=headers_a)
    assert res.status_code == 200
    assert len(res.json()) == 1

def test_household_isolation(setup):
    """Un usuario sin acceso al hogar no puede ver sus transacciones."""
    client, _, _, hid, _ = setup
    # Registrar un tercero
    client.post("/api/auth/register", json={"email": "c@t.com", "username": "c", "password": "p", "nombre": "C"})
    token_c = client.post("/api/auth/login", json={"email": "c@t.com", "password": "p"}).json()["access_token"]
    res = client.get(f"/api/households/{hid}/transactions", headers={"Authorization": f"Bearer {token_c}"})
    assert res.status_code == 403
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
pytest tests/test_transactions.py -v
# Expected: ERROR
```

- [ ] **Step 3: Crear `backend/schemas/transaction.py`**

```python
from datetime import date as date_type
from pydantic import BaseModel

class TransactionCreate(BaseModel):
    fecha_operacion: date_type
    descripcion_raw: str
    monto: int
    payment_method_id: str
    es_hogar: bool = True
    category_id: str | None = None
    split_override: float | None = None
    lugar: str | None = None

class TransactionOut(BaseModel):
    id: str
    fecha_operacion: date_type
    descripcion_raw: str
    descripcion_norm: str
    monto: int
    es_hogar: bool
    tipo_movimiento: str
    category_id: str | None
    payer_user_id: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Crear `backend/routers/transactions.py`**

```python
import hashlib
import re
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Transaction
from schemas.transaction import TransactionCreate, TransactionOut
from services.auth import get_current_user
from services.split import compute_split

router = APIRouter(prefix="/api/households", tags=["transactions"])

GATEWAY_PREFIXES = re.compile(r"^(MP\*|MERCADOPAGO\*|MERPAGO\*|DP \*|FLOW \*|PedidosYa\*)", re.IGNORECASE)

def _normalize(desc: str) -> str:
    return GATEWAY_PREFIXES.sub("", desc).strip().upper()

def _dedupe_hash(fecha: date, monto: int, desc_norm: str) -> str:
    raw = f"{fecha}|{monto}|{desc_norm}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]

def _assert_member(household_id: str, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")

@router.get("/{household_id}/transactions", response_model=list[TransactionOut])
def list_transactions(household_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _assert_member(household_id, current_user, db)
    return db.query(Transaction).filter(
        Transaction.household_id == household_id,
        Transaction.es_interno == False,
    ).order_by(Transaction.fecha_operacion.desc()).all()

@router.post("/{household_id}/transactions", response_model=TransactionOut)
def create_transaction(household_id: str, req: TransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _assert_member(household_id, current_user, db)

    desc_norm = _normalize(req.descripcion_raw)
    hash_d = _dedupe_hash(req.fecha_operacion, req.monto, desc_norm)

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

    members = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id != "__pending__",
    ).all()
    compute_split(tx, members, db)

    db.commit()
    db.refresh(tx)
    return tx
```

- [ ] **Step 5: Registrar router**

```python
from routers import auth, households, payment_methods, categories, transactions
app.include_router(transactions.router)
```

- [ ] **Step 6: Correr tests**

```bash
pytest tests/ -v
# Expected: todos PASSED
```

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: manual transaction entry with auto-split"
```

---

### Task 1.7: Liquidación — endpoint y marcar como pagado

**Files:**
- Create: `backend/schemas/settlement.py`
- Create: `backend/routers/settlements.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `compute_settlement` de `services/split.py`
- Produces:
  - `GET /api/households/{id}/settlement?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` → `SettlementOut`
  - `POST /api/settlements/{id}/pay` → `SettlementOut`

- [ ] **Step 1: Crear `backend/schemas/settlement.py`**

```python
from datetime import date
from pydantic import BaseModel

class SettlementOut(BaseModel):
    id: str
    deudor_user_id: str
    acreedor_user_id: str
    monto: int
    estado: str
    periodo_desde: date
    periodo_hasta: date
    pagado_en: date | None

    model_config = {"from_attributes": True}

class SettlementPeriodOut(BaseModel):
    settlement: SettlementOut | None
    pagado: dict[str, int]
    debido: dict[str, int]
    balance: dict[str, int]
```

- [ ] **Step 2: Crear `backend/routers/settlements.py`**

```python
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Settlement
from schemas.settlement import SettlementOut, SettlementPeriodOut
from services.auth import get_current_user
from services.split import compute_settlement

router = APIRouter(tags=["settlements"])

def _assert_member(household_id: str, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")

@router.get("/api/households/{household_id}/settlement", response_model=SettlementPeriodOut)
def get_settlement(
    household_id: str,
    desde: date,
    hasta: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)
    result = compute_settlement(household_id, desde, hasta, db)
    deudor_id, acreedor_id, monto = result.settlement()

    # Buscar o crear settlement en DB
    settlement = db.query(Settlement).filter(
        Settlement.household_id == household_id,
        Settlement.periodo_desde == desde,
        Settlement.periodo_hasta == hasta,
        Settlement.estado == "pendiente",
    ).first()

    if not settlement and monto > 0:
        settlement = Settlement(
            household_id=household_id,
            periodo_desde=desde,
            periodo_hasta=hasta,
            deudor_user_id=deudor_id,
            acreedor_user_id=acreedor_id,
            monto=monto,
        )
        db.add(settlement)
        db.commit()
        db.refresh(settlement)

    return SettlementPeriodOut(
        settlement=settlement,
        pagado=result.pagado,
        debido=result.debido,
        balance=result.balance,
    )

@router.post("/api/settlements/{settlement_id}/pay", response_model=SettlementOut)
def pay_settlement(
    settlement_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(Settlement).filter(Settlement.id == settlement_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    _assert_member(s.household_id, current_user, db)
    s.estado = "pagado"
    s.pagado_en = date.today()
    db.commit()
    db.refresh(s)
    return s
```

- [ ] **Step 3: Registrar router**

```python
from routers import auth, households, payment_methods, categories, transactions, settlements
app.include_router(settlements.router)
```

- [ ] **Step 4: Escribir tests**

En `backend/tests/test_transactions.py`, agregar:

```python
def test_settlement_calculation(setup):
    from datetime import date
    client, headers_a, headers_b, hid, pm_id = setup

    # B paga un gasto del hogar de $20.000 con su tarjeta personal
    # Primero necesitamos el pm de B (para este test reutilizamos el compartido como simplificación)
    client.post(f"/api/households/{hid}/transactions", json={
        "fecha_operacion": str(date.today()),
        "descripcion_raw": "SUPERMERCADO",
        "monto": 20_000,
        "payment_method_id": pm_id,
        "es_hogar": True,
    }, headers=headers_b)

    today = date.today()
    res = client.get(
        f"/api/households/{hid}/settlement",
        params={"desde": str(today), "hasta": str(today)},
        headers=headers_a,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["settlement"] is not None
    assert data["settlement"]["monto"] > 0
```

- [ ] **Step 5: Correr tests**

```bash
pytest tests/ -v
# Expected: todos PASSED
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: settlement endpoint + mark as paid"
```

---

### Task 1.8: Frontend — Auth (login + register)

**Files:**
- Create: `frontend/app/(auth)/login/page.tsx`
- Create: `frontend/app/(auth)/register/page.tsx`
- Create: `frontend/app/(auth)/layout.tsx`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/types/api.ts`

**Interfaces:**
- Consumes: `apiFetch`, `setToken`, `getToken` de `lib/`
- Produces: flujo completo de login/register que guarda JWT y redirige a `/dashboard`

- [ ] **Step 1: Actualizar `frontend/types/api.ts`**

```typescript
export interface UserOut {
  id: string;
  email: string;
  username: string;
  nombre: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface HouseholdOut {
  id: string;
  nombre: string;
  moneda: string;
}

export interface TransactionOut {
  id: string;
  fecha_operacion: string;
  descripcion_raw: string;
  descripcion_norm: string;
  monto: number;
  es_hogar: boolean;
  tipo_movimiento: string;
  category_id: string | null;
  payer_user_id: string;
}

export interface SettlementOut {
  id: string;
  deudor_user_id: string;
  acreedor_user_id: string;
  monto: number;
  estado: string;
  periodo_desde: string;
  periodo_hasta: string;
  pagado_en: string | null;
}

export interface SettlementPeriodOut {
  settlement: SettlementOut | null;
  pagado: Record<string, number>;
  debido: Record<string, number>;
  balance: Record<string, number>;
}
```

- [ ] **Step 2: Crear `frontend/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-sm">
        <h1 className="text-2xl font-bold text-center mb-6">NuestraCuenta</h1>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear `frontend/app/(auth)/register/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { TokenResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const data = await apiFetch<TokenResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          username: form.get("username"),
          password: form.get("password"),
          nombre: form.get("nombre"),
        }),
      });
      setToken(data.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" name="nombre" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" required />
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
      <p className="text-center text-sm text-gray-500">
        ¿Ya tienes cuenta? <Link href="/login" className="text-blue-600 hover:underline">Inicia sesión</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 4: Crear `frontend/app/(auth)/login/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { TokenResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const data = await apiFetch<TokenResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      setToken(data.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Entrando..." : "Iniciar sesión"}
      </Button>
      <p className="text-center text-sm text-gray-500">
        ¿Sin cuenta? <Link href="/register" className="text-blue-600 hover:underline">Regístrate</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 5: Guardar `household_id` al crear/unirse al hogar**

En `frontend/lib/auth.ts`, agregar:

```typescript
const HOUSEHOLD_KEY = "nc_household_id";

export function getHouseholdId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(HOUSEHOLD_KEY);
}

export function setHouseholdId(id: string): void {
  localStorage.setItem(HOUSEHOLD_KEY, id);
}
```

- [ ] **Step 7: Actualizar `frontend/app/page.tsx`** (redirigir según token y household)

```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getHouseholdId } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    router.replace(getHouseholdId() ? "/dashboard" : "/settings");
  }, [router]);
  return null;
}
```

- [ ] **Step 8: Verificar manualmente**

```bash
cd frontend && npm run dev
# Abrir http://localhost:3000
# 1. Debe redirigir a /login
# 2. Registrar usuario → debe redirigir a /dashboard (404 por ahora, ok)
# 3. Cerrar y volver a / → debe redirigir a /dashboard
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: auth UI — login + register pages with JWT storage"
```

---

### Task 1.9: Frontend — App shell y Dashboard básico

**Files:**
- Create: `frontend/app/(app)/layout.tsx`
- Create: `frontend/app/(app)/dashboard/page.tsx`
- Create: `frontend/components/SettlementCard.tsx`
- Create: `frontend/components/CategoryBadge.tsx`

**Interfaces:**
- Consumes: `apiFetch`, tipos de `types/api.ts`
- Produces: shell de navegación, dashboard con resumen del mes actual y liquidación

- [ ] **Step 1: Crear `frontend/app/(app)/layout.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { useEffect } from "react";

const NAV = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/transactions", label: "Gastos" },
  { href: "/settlement", label: "Liquidación" },
  { href: "/settings", label: "Ajustes" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <span className="font-bold text-lg">NuestraCuenta</span>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800">
          Salir
        </button>
      </header>
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">{children}</main>
      <nav className="bg-white border-t flex justify-around py-2">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`text-sm px-3 py-1 rounded ${pathname === n.href ? "font-bold text-blue-600" : "text-gray-500"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Crear `frontend/components/SettlementCard.tsx`**

```tsx
import { SettlementPeriodOut } from "@/types/api";

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
}

interface Props {
  data: SettlementPeriodOut;
  memberNames: Record<string, string>;
  onPay: (id: string) => void;
}

export function SettlementCard({ data, memberNames, onPay }: Props) {
  const { settlement } = data;
  if (!settlement || settlement.monto === 0) {
    return <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">Estás al día este mes 🎉</div>;
  }
  const deudorNombre = memberNames[settlement.deudor_user_id] ?? "Alguien";
  const acreedorNombre = memberNames[settlement.acreedor_user_id] ?? "Alguien";
  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <p className="font-semibold text-gray-800">
        {deudorNombre} le debe <span className="text-blue-600">{formatCLP(settlement.monto)}</span> a {acreedorNombre}
      </p>
      {settlement.estado === "pendiente" && (
        <button
          onClick={() => onPay(settlement.id)}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
        >
          Marcar como pagado
        </button>
      )}
      {settlement.estado === "pagado" && (
        <p className="text-green-600 text-sm">Pagado el {settlement.pagado_en}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Crear `frontend/components/CategoryBadge.tsx`**

```tsx
interface Props {
  nombre: string | null;
}
export function CategoryBadge({ nombre }: Props) {
  if (!nombre) return <span className="text-gray-400 text-xs">Sin categoría</span>;
  return (
    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{nombre}</span>
  );
}
```

- [ ] **Step 4: Crear `frontend/app/(app)/dashboard/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getHouseholdId } from "@/lib/auth";
import { SettlementCard } from "@/components/SettlementCard";
import { SettlementPeriodOut, TransactionOut } from "@/types/api";

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
}

function currentMonthRange() {
  const now = new Date();
  const desde = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const hasta = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  return { desde, hasta };
}

export default function DashboardPage() {
  const router = useRouter();
  const [settlement, setSettlement] = useState<SettlementPeriodOut | null>(null);
  const [txs, setTxs] = useState<TransactionOut[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    const hid = getHouseholdId();
    if (!hid) { router.push("/settings"); return; }
    setHouseholdId(hid);
    const { desde, hasta } = currentMonthRange();
    Promise.all([
      apiFetch<SettlementPeriodOut>(`/api/households/${hid}/settlement?desde=${desde}&hasta=${hasta}`),
      apiFetch<TransactionOut[]>(`/api/households/${hid}/transactions`),
      apiFetch<Array<{user_id: string; nombre_display: string}>>(`/api/households/${hid}/members`),
    ])
      .then(([s, t, members]) => {
        setSettlement(s);
        setTxs(t.slice(0, 5));
        setMemberNames(Object.fromEntries(members.map((m) => [m.user_id, m.nombre_display])));
      })
      .catch(() => setError("Error cargando datos"));
  }, [router]);

  async function handlePay(id: string) {
    await apiFetch(`/api/settlements/${id}/pay`, { method: "POST" });
    const hid = householdId!;
    const { desde, hasta } = currentMonthRange();
    const s = await apiFetch<SettlementPeriodOut>(`/api/households/${hid}/settlement?desde=${desde}&hasta=${hasta}`);
    setSettlement(s);
  }

  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Este mes</h2>

      {settlement && (
        <SettlementCard
          data={settlement}
          memberNames={memberNames}
          onPay={handlePay}
        />
      )}

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium text-gray-700">Últimos gastos</h3>
          <Link href="/transactions" className="text-sm text-blue-600">Ver todos</Link>
        </div>
        {txs.length === 0 && <p className="text-gray-400 text-sm">Sin gastos registrados aún.</p>}
        {txs.map((tx) => (
          <div key={tx.id} className="flex justify-between items-center py-2 border-b last:border-0">
            <div>
              <p className="text-sm font-medium">{tx.descripcion_norm}</p>
              <p className="text-xs text-gray-400">{tx.fecha_operacion}</p>
            </div>
            <span className={`text-sm font-medium ${tx.monto < 0 ? "text-green-600" : "text-gray-800"}`}>
              {formatCLP(tx.monto)}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/transactions/new"
        className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-medium hover:bg-blue-700"
      >
        + Agregar gasto
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: Crear páginas placeholder para rutas restantes**

```bash
mkdir -p frontend/app/\(app\)/transactions/new
mkdir -p frontend/app/\(app\)/settlement
mkdir -p frontend/app/\(app\)/settings
```

`frontend/app/(app)/transactions/page.tsx`:
```tsx
export default function TransactionsPage() {
  return <div><h2 className="text-xl font-semibold mb-4">Gastos</h2><p className="text-gray-400">Próximamente</p></div>;
}
```

`frontend/app/(app)/settlement/page.tsx`:
```tsx
export default function SettlementPage() {
  return <div><h2 className="text-xl font-semibold mb-4">Liquidación</h2><p className="text-gray-400">Próximamente</p></div>;
}
```

`frontend/app/(app)/settings/page.tsx`:
```tsx
export default function SettingsPage() {
  return <div><h2 className="text-xl font-semibold mb-4">Ajustes</h2><p className="text-gray-400">Próximamente</p></div>;
}
```

`frontend/app/(app)/transactions/new/page.tsx`:
```tsx
export default function NewTransactionPage() {
  return <div><h2 className="text-xl font-semibold mb-4">Nuevo gasto</h2><p className="text-gray-400">Próximamente</p></div>;
}
```

- [ ] **Step 6: Verificar manualmente**

```bash
# Backend corriendo en :8000, frontend en :3000
# 1. Registrar usuario, crear hogar → guardar household_id en localStorage manualmente
# 2. Ir a /dashboard → debe mostrar "Sin gastos" y el SettlementCard
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: app shell with nav, dashboard with settlement card"
```

---

### Task 1.10: Frontend — Imputación manual de gastos

**Files:**
- Create: `frontend/components/TransactionForm.tsx`
- Create: `frontend/components/TransactionList.tsx`
- Modify: `frontend/app/(app)/transactions/page.tsx`
- Modify: `frontend/app/(app)/transactions/new/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `TransactionOut`, `PaymentMethodOut`, `CategoryOut` de `types/api.ts`
- Produces: formulario funcional para crear gastos + lista de transacciones

- [ ] **Step 1: Actualizar `frontend/types/api.ts`** — agregar tipos faltantes

```typescript
// Agregar al archivo existente:
export interface PaymentMethodOut {
  id: string;
  tipo: string;
  alias: string;
  ultimos_digitos: string | null;
  es_compartido: boolean;
  banco: string | null;
}

export interface CategoryOut {
  id: string;
  nombre: string;
  parent_id: string | null;
  icono: string | null;
  color: string | null;
}
```

- [ ] **Step 2: Crear `frontend/components/TransactionList.tsx`**

```tsx
import { TransactionOut } from "@/types/api";
import { CategoryBadge } from "./CategoryBadge";

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
}

interface Props {
  transactions: TransactionOut[];
}

export function TransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Sin gastos registrados.</p>;
  }
  return (
    <ul className="divide-y">
      {transactions.map((tx) => (
        <li key={tx.id} className="py-3 flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-800">{tx.descripcion_norm}</p>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-400">{tx.fecha_operacion}</span>
              <CategoryBadge nombre={tx.category_id ? "Categoría" : null} />
              {tx.es_hogar && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Hogar</span>}
            </div>
          </div>
          <span className={`text-sm font-semibold ${tx.monto < 0 ? "text-green-600" : "text-gray-900"}`}>
            {formatCLP(tx.monto)}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Crear `frontend/components/TransactionForm.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { PaymentMethodOut, CategoryOut, TransactionOut } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  householdId: string;
  onCreated: (tx: TransactionOut) => void;
}

export function TransactionForm({ householdId, onCreated }: Props) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOut[]>([]);
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch<PaymentMethodOut[]>(`/api/households/${householdId}/payment-methods`),
      apiFetch<CategoryOut[]>(`/api/households/${householdId}/categories`),
    ]).then(([pms, cats]) => {
      setPaymentMethods(pms);
      setCategories(cats.filter((c) => !c.parent_id)); // solo categorías padre
    });
  }, [householdId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const tx = await apiFetch<TransactionOut>(`/api/households/${householdId}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          fecha_operacion: form.get("fecha"),
          descripcion_raw: form.get("descripcion"),
          monto: parseInt(form.get("monto") as string, 10),
          payment_method_id: form.get("payment_method_id"),
          category_id: form.get("category_id") || null,
          es_hogar: form.get("es_hogar") === "on",
        }),
      });
      onCreated(tx);
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="descripcion">Descripción / Comercio</Label>
        <Input id="descripcion" name="descripcion" placeholder="Ej: Jumbo" required />
      </div>
      <div>
        <Label htmlFor="monto">Monto (CLP)</Label>
        <Input id="monto" name="monto" type="number" min="1" placeholder="50000" required />
      </div>
      <div>
        <Label htmlFor="fecha">Fecha</Label>
        <Input id="fecha" name="fecha" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
      </div>
      <div>
        <Label htmlFor="payment_method_id">Medio de pago</Label>
        <select id="payment_method_id" name="payment_method_id" required className="w-full border rounded-md px-3 py-2 text-sm">
          {paymentMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>{pm.alias} {pm.ultimos_digitos ? `(${pm.ultimos_digitos})` : ""}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="category_id">Categoría</Label>
        <select id="category_id" name="category_id" className="w-full border rounded-md px-3 py-2 text-sm">
          <option value="">Sin categoría</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input id="es_hogar" name="es_hogar" type="checkbox" defaultChecked className="h-4 w-4" />
        <Label htmlFor="es_hogar">Gasto del hogar (se reparte 57/43)</Label>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || paymentMethods.length === 0}>
        {loading ? "Guardando..." : "Guardar gasto"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Actualizar `frontend/app/(app)/transactions/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { TransactionOut } from "@/types/api";
import { TransactionList } from "@/components/TransactionList";
import Link from "next/link";

export default function TransactionsPage() {
  const [txs, setTxs] = useState<TransactionOut[]>([]);
  const householdId = typeof window !== "undefined" ? localStorage.getItem("nc_household_id") : null;

  useEffect(() => {
    if (!householdId) return;
    apiFetch<TransactionOut[]>(`/api/households/${householdId}/transactions`).then(setTxs);
  }, [householdId]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Gastos</h2>
        <Link href="/transactions/new" className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700">
          + Nuevo
        </Link>
      </div>
      <TransactionList transactions={txs} />
    </div>
  );
}
```

- [ ] **Step 5: Actualizar `frontend/app/(app)/transactions/new/page.tsx`**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionOut } from "@/types/api";

export default function NewTransactionPage() {
  const router = useRouter();
  const householdId = typeof window !== "undefined" ? localStorage.getItem("nc_household_id") ?? "" : "";

  function handleCreated(_tx: TransactionOut) {
    router.push("/transactions");
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Nuevo gasto</h2>
      {householdId && <TransactionForm householdId={householdId} onCreated={handleCreated} />}
    </div>
  );
}
```

- [ ] **Step 6: Verificar manualmente**

```bash
# Con backend en :8000 y frontend en :3000:
# 1. Registrar usuario, crear hogar, guardar household_id en localStorage
# 2. Ir a /transactions/new → debe mostrar el formulario con medios de pago y categorías
# 3. Crear un gasto → debe redirigir a /transactions con el gasto listado
# 4. Ir a /dashboard → debe mostrar el gasto en "Últimos gastos"
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: transaction list and manual entry form"
```

---

### Task 1.11: Configurar GitHub + Vercel deploy

**Files:**
- Modify: `vercel.json`
- Create: `.github/workflows/test.yml`

**Interfaces:**
- Produces: auto-deploy en Vercel, tests corriendo en CI en cada PR

- [ ] **Step 1: Crear repo en GitHub**

```bash
# Crear repo en GitHub (desde la UI) → copiar la URL
git remote add origin https://github.com/TU_USUARIO/nuestracuenta.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Crear `.github/workflows/test.yml`**

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r backend/requirements.txt
      - run: cd backend && pytest tests/ -v
        env:
          DATABASE_URL: sqlite:///./test.db

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
```

- [ ] **Step 3: Conectar Vercel**

1. Ir a [vercel.com](https://vercel.com) → New Project → importar repo de GitHub
2. Framework: Next.js (Vercel lo detecta automáticamente para `frontend/`)
3. Root Directory: dejar en raíz (el `vercel.json` maneja el routing)
4. En "Environment Variables" agregar:
   - `DATABASE_URL` (desde Vercel Postgres → Settings → Connection String)
   - `JWT_SECRET` (string aleatorio de 32 chars)
   - `JWT_ALGORITHM` = `HS256`
   - `JWT_EXPIRE_MINUTES` = `10080`
   - `NEXT_PUBLIC_API_URL` = (URL del deploy de Vercel, ej. `https://nuestracuenta.vercel.app`)

- [ ] **Step 4: Provisionar Vercel Postgres**

1. En el proyecto de Vercel → Storage → Create Database → Postgres
2. Nombre: `nuestracuenta-db`
3. Copiar `DATABASE_URL` a las variables de entorno

- [ ] **Step 5: Correr migración inicial**

```bash
cd backend
# Con DATABASE_URL de producción en el entorno:
export DATABASE_URL="postgresql://..."
alembic upgrade head
```

- [ ] **Step 6: Verificar deploy**

```bash
# Push a main → Vercel dispara deploy automático
git push origin main
# Ir a la URL de Vercel y verificar:
# 1. /login carga
# 2. /api/health devuelve {"status": "ok"}
# 3. Registrar usuario funciona
```

- [ ] **Step 7: Commit**

```bash
git add .github/
git commit -m "ci: GitHub Actions tests + Vercel deploy config"
git push origin main
```

---

## Resumen de la Fase 1 al completar

Al terminar Task 1.11, el MVP estará operativo con:

- [x] Auth completo (register / login / JWT)
- [x] Hogar con código de invitación para 2 personas
- [x] Medios de pago + categorías semilla (Supermercado, Delivery, etc.)
- [x] Imputación manual de gastos con split 57/43 automático
- [x] Liquidación del periodo (quién le debe cuánto a quién)
- [x] Dashboard con últimos gastos y tarjeta de liquidación
- [x] Deploy en Vercel con CI en GitHub

---

## FASE 2 — Ingesta PDF (referencia)

La Fase 2 se planificará en un documento separado (`2026-06-26-nuestracuenta-fase2-ingesta.md`) y cubrirá:

- Task 2.1: Parser PDF Santander con `pdfplumber` (pipeline completo in-memory)
- Task 2.2: Endpoint de importación con preview (`POST /api/households/{id}/imports`)
- Task 2.3: Edición del preview (desmarcar internos, editar categoría)
- Task 2.4: Confirmación de importación (inyectar transacciones + splits)
- Task 2.5: Motor de categorización con reglas semilla (Jumbo → Supermercado, etc.)
- Task 2.6: Detección de duplicados via `hash_dedupe`
- Task 2.7: Manejo de cuotas (`INSTALLMENT_PLAN`)
- Task 2.8: UI de importación con preview interactivo
- Task 2.9: Tests de regresión con la cartola de ejemplo (10 criterios del Doc Técnico)

## FASE 3 — Análisis (referencia)

- Task 3.1: Gráfico de evolución mensual (gasto por mes)
- Task 3.2: Desglose por categoría (gráfico de torta o barras)
- Task 3.3: Calendario de cuotas futuras
- Task 3.4: Soporte CSV como vía secundaria de importación

## FASE 4 — Conveniencia (referencia)

- Task 4.1: Sincronización bancaria (Fintoc o similar)
- Task 4.2: Presupuestos por categoría con alertas
- Task 4.3: Gastos recurrentes automáticos
- Task 4.4: Exportación PDF/Excel
