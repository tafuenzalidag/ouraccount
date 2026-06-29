# Motor de detección de duplicados — Spec

**Fecha:** 2026-06-28
**Estado:** Aprobado, pendiente implementación

---

## 1. Problema

Un usuario puede registrar un gasto manualmente y luego volver a encontrarlo al importar la cartola Santander en PDF. El sistema actual solo bloquea duplicados exactos (mismo hash SHA256 de fecha + monto + descripción normalizada). No detecta el caso común donde la descripción o la fecha difieren levemente entre el registro manual y la cartola.

---

## 2. Solución

Motor de detección fuzzy que:
- Identifica pares sospechosos usando **monto exacto + fecha ±3 días**.
- No toma decisiones automáticas — solo presenta los pares al usuario para que decida.
- Actúa en dos momentos: al importar (modal preventivo) y de forma retroactiva (página de revisión).

---

## 3. Cambios globales al modelo de datos

### 3.1 Estándar de tabla (aplica a TODAS las tablas, existentes y nuevas)

Todas las tablas deben seguir este patrón base:

```sql
id          SERIAL PRIMARY KEY        -- entero auto-incremental, nunca expuesto externamente
created_at  TIMESTAMP NOT NULL DEFAULT now()
updated_at  TIMESTAMP NOT NULL DEFAULT now()
deleted_at  TIMESTAMP NULL            -- soft delete; queries filtran WHERE deleted_at IS NULL
```

Los UUIDs actuales se eliminan. El `id` entero se codifica al exponerse via API.

### 3.2 IDs externos codificados

El entero interno nunca viaja en la API ni en el frontend. Se expone como un string prefijado y codificado mediante la librería `sqids` con un `SQIDS_SECRET` en variables de entorno.

**Formato:** `{prefijo}{string_codificado}` — ej. `tx_k7mNpQ`

**Prefijos por entidad:**

| Entidad | Prefijo | Ejemplo |
|---|---|---|
| users | `us_` | `us_k7mNpQ` |
| households | `hh_` | `hh_3xRtYa` |
| household_members | `hm_` | `hm_9bWvLz` |
| payment_methods | `pm_` | `pm_4cJqXn` |
| transactions | `tx_` | `tx_2mFhKp` |
| import_batches | `ib_` | `ib_8nDsEw` |
| categories | `cat_` | `cat_5pGrMj` |
| installment_plans | `ip_` | `ip_1tBkVc` |
| settlements | `set_` | `set_6yHuQo` |
| merchant_rules | `mr_` | `mr_7aLiNf` |
| dismissed_duplicate_pairs | `ddp_` | `ddp_0rCeYx` |

**`services/id_codec.py`:**
```python
encode(prefix: str, internal_id: int) -> str   # "tx_" + sqids.encode([42]) → "tx_k7mNpQ"
decode(external_id: str) -> tuple[str, int]     # "tx_k7mNpQ" → ("tx_", 42)
```

Todos los routers llaman a `decode()` al recibir IDs del frontend, y a `encode()` al serializar respuestas. Los schemas Pydantic exponen `external_id: str` (nunca `id: int`).

### 3.3 Nueva tabla: `dismissed_duplicate_pairs`

```sql
CREATE TABLE dismissed_duplicate_pairs (
    id           SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id),
    tx_id_a      INTEGER NOT NULL REFERENCES transactions(id),  -- siempre el menor
    tx_id_b      INTEGER NOT NULL REFERENCES transactions(id),  -- siempre el mayor
    dismissed_by INTEGER NOT NULL REFERENCES users(id),
    created_at   TIMESTAMP NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMP NULL,
    UNIQUE (tx_id_a, tx_id_b)
);
```

`tx_id_a` siempre es el entero menor de los dos, para garantizar unicidad del par sin importar el orden en que se registre.

---

## 4. Backend

### 4.1 Migraciones Alembic

Se requieren dos migraciones secuenciales:

1. **`add_timestamp_columns`** — agrega `created_at`, `updated_at`, `deleted_at` a todas las tablas existentes. Valores iniciales: `created_at = now()`, `updated_at = now()`, `deleted_at = NULL`.
2. **`replace_uuid_with_serial`** — reemplaza las PKs UUID string por `SERIAL INTEGER` en todas las tablas, actualiza todos los FKs en cascada, elimina columnas UUID.
3. **`create_dismissed_duplicate_pairs`** — crea la nueva tabla.

> **Nota sobre datos en Neon:** Las migraciones 1 y 2 se ejecutan sobre la DB de producción con datos existentes. La migración 2 requiere estrategia de backfill: crear columna `new_id SERIAL`, poblar FKs nuevos, luego drop de columnas UUID. Hacerlo en una transacción por tabla.

### 4.2 `services/duplicate_detector.py`

**`find_fuzzy_for_import(items, household_id, db, window_days=3)`**
- Para cada ítem del PDF parseado, consulta:
  ```sql
  SELECT * FROM transactions
  WHERE household_id = :hh_id
    AND monto = :monto
    AND fecha_operacion BETWEEN :fecha - 3 AND :fecha + 3
    AND deleted_at IS NULL
  ```
- Retorna `dict[int, list[TxSnippet]]` (índice del ítem → lista de matches).
- Excluye ítems con `hash_dedupe` exacto (esos ya los maneja el flujo existente).
- Excluye pares donde la combinación `(min(tx_existente.id, item_futuro_id), max(...))` ya existe en `dismissed_duplicate_pairs` — un par descartado no reaparece en el modal.

**`find_all_candidates(household_id, db, window_days=3)`**
- Busca pares dentro de `transactions` donde:
  - `tx_a.monto = tx_b.monto`
  - `|tx_a.fecha_operacion - tx_b.fecha_operacion| <= 3`
  - Uno tiene `import_batch_id IS NULL` (manual), el otro `IS NOT NULL` (importado)
  - `tx_a.deleted_at IS NULL AND tx_b.deleted_at IS NULL`
  - El par `(min(id_a,id_b), max(id_a,id_b))` no está en `dismissed_duplicate_pairs`
- Retorna `list[DuplicatePairOut]`.

### 4.3 Schemas nuevos

```python
class TxSnippet(BaseModel):
    external_id: str
    fecha_operacion: date
    descripcion_raw: str
    monto: int
    origen: Literal["manual", "importado"]

class DuplicatePairOut(BaseModel):
    tx_manual: TxSnippet
    tx_importado: TxSnippet

class DismissDuplicateIn(BaseModel):
    tx_external_id_a: str
    tx_external_id_b: str
```

`PreviewItemOut` agrega el campo:
```python
fuzzy_matches: list[TxSnippet] = []
```

### 4.4 Endpoints

| Método | Path | Descripción |
|---|---|---|
| `POST` | `/api/households/{hh_id}/imports` | Agrega `fuzzy_matches` por ítem (sin cambio de contrato para campos existentes) |
| `GET` | `/api/households/{hh_id}/duplicate-candidates` | Lista todos los pares candidatos no descartados |
| `DELETE` | `/api/households/{hh_id}/transactions/{tx_id}` | Soft delete: setea `deleted_at = now()` |
| `POST` | `/api/households/{hh_id}/dismiss-duplicate` | Guarda el par en `dismissed_duplicate_pairs` |

**`DELETE /transactions/{tx_id}`** también borra en cascada (soft) las `split_allocations` asociadas y recalcula el settlement del hogar.

---

## 5. Frontend

### 5.1 Migración de design system

El frontend migra del Apple Casa DS (commit `540b77e`) al **NuestraCuenta Design System** (proyecto `1f56a3fd-c53d-4c96-89c9-00183dd51505`):

- **Fuente:** Geist / Geist Mono (ya son los defaults de Next.js)
- **Acento:** `#2563eb` (Tailwind blue-600)
- **Superficies:** blancas con hairline ring (`inset 0 0 0 1px rgba(0,0,0,.10)`), flat sin glass
- **Tokens:** `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css` del DS
- **Componentes:** `Button`, `Card`, `Amount`, `Badge`, `TransactionRow`, `Input`, `Select` del DS
- Los `globals.css` actuales se reemplazan con los tokens del DS

### 5.2 Modal de duplicados en `/imports`

- Se abre automáticamente al recibir la respuesta del preview si `items.some(i => i.fuzzy_matches.length > 0)`.
- Si no hay fuzzy matches: el modal no se monta.
- **Contenido del modal:**
  - Header: "Posibles duplicados encontrados"
  - Subtítulo: "Estas transacciones de la cartola podrían coincidir con gastos ya registrados. Revísalos antes de confirmar."
  - Por cada par: dos columnas — "Ya registrado" (manual) vs "En la cartola" (importado), mostrando fecha, descripción, monto (`Amount`).
  - Badge `"⚠ posible duplicado"` en la fila del ítem dentro de la tabla de preview.
  - Botón primario: "Entendido" — cierra modal, muestra preview normalmente.

### 5.3 Página `/duplicates`

- Acceso: banner en `/transactions` — `"X posibles duplicados detectados — Revisar →"` (azul claro, `--accent-soft`). Se muestra solo si `GET /duplicate-candidates` retorna al menos un par. No agrega pestaña al TabBar.
- **Estructura:**
  - Título de página: "Duplicados posibles"
  - Por cada par: `Card` con dos columnas ("Manual" | "Importado"), cada columna con fecha, descripción, monto, medio de pago.
  - Acciones:
    - `Button variant="destructive"` "Eliminar este" — bajo cada columna, llama `DELETE /transactions/{id}`.
    - `Button variant="ghost"` "No son duplicados" — bajo el par completo, llama `POST /dismiss-duplicate`.
  - Confirmación antes de eliminar: `window.confirm` o mini-modal inline "¿Seguro que quieres eliminar este gasto?".
  - Estado vacío: `Card` centrada con texto "Sin duplicados pendientes".
- `PAGE_TITLES` en `layout.tsx` agrega `/duplicates → "Duplicados"`.

---

## 6. Criterios de éxito

- Al subir una cartola con una transacción que coincide en monto con una manual ±3 días → el modal aparece con el par.
- Al subir una cartola sin coincidencias → no aparece modal.
- Al eliminar una transacción → desaparece de la lista, el settlement se recalcula.
- Al descartar un par → no vuelve a aparecer en `/duplicates` ni en futuros imports.
- El hash exacto sigue funcionando igual (duplicado exacto = `skipped_dup`, no fuzzy).
- Todos los IDs en la API tienen formato `{prefijo}_{codificado}`.
- Todas las tablas tienen `created_at`, `updated_at`, `deleted_at`.

---

## 7. Fuera de alcance

- Matching por descripción fuzzy (texto similar).
- Detección automática de duplicados entre dos transacciones importadas.
- Notificaciones push o email sobre duplicados.
- Deshacer un "Eliminar".
