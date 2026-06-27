# NuestraCuenta — Spec de Diseño Consolidado

**Fecha:** 26 junio 2026
**Estado:** Aprobado
**Basado en:** PRD_Gastos_Compartidos.md + Doc_Tecnico_ERD.md
**Cubre:** Decisiones de sesión de diseño que resuelven las preguntas abiertas del PRD

---

## 1. Decisiones tomadas (preguntas abiertas resueltas)

| Pregunta abierta (PRD §11) | Decisión |
|---|---|
| ¿Build vs Buy para ingesta? | **Build** — parser propio con `pdfplumber`. El formato PDF Santander es consistente y determinístico. |
| ¿Plataforma? | **Next.js** (frontend) + **FastAPI** (backend) + **Vercel Postgres** |
| ¿Sincronización bancaria automática? | Fuera del MVP. Roadmap Fase 4. |
| ¿Impuestos y comisiones se reparten 57/43? | **Sí** — `tipo_movimiento = impuesto`, `es_hogar = true`, genera `SPLIT_ALLOCATION` 57/43. |
| ¿Cuotas por mes o por total? | **Por cuota del mes** — `transaction.monto = valor_cuota_mensual`. El total vive en `INSTALLMENT_PLAN.monto_total`. |
| ¿Cómo nombrar a las personas A/B? | Campo `HOUSEHOLD_MEMBER.nombre_display` configurable (ej. "Tomas", "Cata"). |

---

## 2. Arquitectura y stack

### Stack definitivo

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (React) |
| Backend | FastAPI (Python) — serverless functions en Vercel |
| Base de datos | Vercel Postgres (Neon serverless) — compatible con SQLAlchemy |
| Auth | bcrypt + JWT (`passlib[bcrypt]`, `python-jose`) |
| Parser PDF | `pdfplumber` — procesamiento in-memory |
| Hosting | Vercel |
| Control de versiones | GitHub — auto-deploy en push a `main` |

### Estructura del monorepo

```
/
├── frontend/          → Next.js app
│   ├── app/           → App Router de Next.js
│   ├── components/
│   └── lib/
├── backend/           → FastAPI
│   ├── api/
│   │   └── index.py   → entry point para Vercel serverless
│   ├── routers/
│   ├── models/        → SQLAlchemy models
│   ├── schemas/       → Pydantic schemas
│   ├── services/      → parser, categorización, split
│   └── alembic/       → migraciones
├── vercel.json        → routing: /* → Next.js, /api/* → FastAPI
└── requirements.txt
```

### Decisión clave: PDF in-memory

El Doc Técnico originalmente proponía guardar el PDF en un tmp cifrado. En Vercel serverless **no hay filesystem persistente**, por lo que el PDF se procesa íntegramente en memoria:

```python
# BytesIO directo, sin tocar disco
pdf_bytes = await file.read()
with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
    # procesar...
```

Esto es viable para cartolas de ~60 movimientos y es más seguro (el archivo nunca persiste en ningún lado).

---

## 3. Modelo de datos

El ERD completo está definido en `Doc_Tecnico_ERD.md §2`. Se mantiene sin cambios estructurales. Adiciones de esta sesión:

### Adición al modelo

**`HOUSEHOLD_MEMBER.nombre_display`** (string, nullable) — nombre visible en la UI. Si es null, se muestra "Persona A" / "Persona B" como fallback.

### Reglas de negocio confirmadas

- **Impuestos (`IMPTO. DECRETO LEY 3475`):** `tipo_movimiento = impuesto`, `es_hogar = true` → genera `SPLIT_ALLOCATION` con ratio 57/43. Se tratan igual que cualquier gasto del hogar.
- **Cuotas:** `transaction.monto` siempre es `valor_cuota_mensual`. El total de la compra vive en `INSTALLMENT_PLAN.monto_total` y no se doble-contabiliza.
- **`payer_user_id` vs `SPLIT_ALLOCATION`:** la separación entre quién pagó y quién debe pagar es el mecanismo que resuelve el caso "tarjeta personal = gasto del hogar".

---

## 4. Flujo de invitación al Hogar

Para el MVP de 2 personas el flujo es minimalista:

1. El primer usuario crea su cuenta y crea el Hogar (define nombre, ratio 57/43, `nombre_display` de cada miembro).
2. La app genera un **código de invitación de 6 caracteres** (ej. `X7K2QP`), válido por 48 horas.
3. El segundo usuario crea su cuenta e ingresa el código → queda vinculado al Hogar.
4. Ambos son co-administradores; no hay roles asimétricos en el MVP.

Endpoint: `POST /households/{id}/invite` → devuelve código. `POST /households/join` → acepta código + user_id.

---

## 5. Parser de cartola PDF

### Especificación completa

Ver `Doc_Tecnico_ERD.md §4` para el mapeo de columnas y las 4 sub-secciones de la cartola Santander.

### Pipeline (actualizado para in-memory)

```
1. Recibir PDF como bytes (multipart) → BytesIO, no se guarda en disco
2. Abrir con pdfplumber desde BytesIO
3. Anclar por cabeceras de sección:
   - "2. PERIODO ACTUAL" / "MOVIMIENTOS TARJETA"
   - "3. CARGOS, COMISIONES, IMPUESTOS Y ABONOS"
   - "4. INFORMACION COMPRAS EN CUOTAS EN EL PERIODO"
4. Extraer filas por página (multipágina) con extract_table() / extract_words()
5. Parsear y normalizar montos CLP ("$ 1.268.949" → 1268949, respetar negativos)
6. Aplicar reglas obligatorias:
   - MONTO CANCELADO → es_interno = true, excluido del preview por defecto
   - Nota de crédito → monto negativo, tipo_movimiento = abono
   - Cuotas (Nº CUOTA presente) → monto = valor_cuota_mensual, crear INSTALLMENT_PLAN
   - Impuestos → tipo_movimiento = impuesto, es_hogar = true, split 57/43
   - Normalizar descripcion_norm (quitar MP*, FLOW*, MERCADOPAGO*, DP *, PedidosYa*)
7. Validar cuadre: Σ(montos del periodo) vs "MONTO TOTAL FACTURADO A PAGAR"
   - Si no calza: advertencia en el preview (no bloquear)
8. Calcular hash_dedupe por movimiento; marcar posibles duplicados
9. Devolver JSON de preview — nada se persiste hasta que el usuario confirma
```

### Output del preview

Cada movimiento en el preview incluye:

```json
{
  "fecha_operacion": "2026-05-15",
  "descripcion_raw": "MP*CASAVINTE",
  "descripcion_norm": "CASAVINTE",
  "lugar": "LAS CONDES",
  "monto": 45000,
  "tipo_movimiento": "compra",
  "es_interno": false,
  "incluido": true,
  "categoria_sugerida": "Hogar/Muebles",
  "es_duplicado_posible": false,
  "installment_plan": null
}
```

---

## 5. Motor de reparto y liquidación

### Split por transacción

```python
for tx in transactions where tx.es_hogar:
    ratio_A = tx.split_override or household_member_A.ratio_default  # 0.57
    monto_A = round(tx.monto * ratio_A)
    monto_B = tx.monto - monto_A  # evita pérdida de 1 peso por redondeo
    create SPLIT_ALLOCATION(user=A, monto=monto_A, ratio=ratio_A)
    create SPLIT_ALLOCATION(user=B, monto=monto_B, ratio=1-ratio_A)
```

Los abonos (monto negativo) siguen el mismo cálculo → split negativo reduce deuda proporcionalmente.

### Liquidación del periodo

```python
for member in [A, B]:
    pagado[member]  = SUM(tx.monto for tx in household_txs where tx.payer == member)
    debido[member]  = SUM(alloc.monto for alloc in split_allocations where alloc.user == member)
    balance[member] = pagado[member] - debido[member]

# balance > 0 → le deben | balance < 0 → debe
# El de balance negativo paga al de balance positivo
create SETTLEMENT(deudor=..., acreedor=..., monto=abs(balance_negativo))
```

**Ejemplo de validación:**
- Gasto del hogar $20.000, pagado por B (tarjeta personal). Ratio A=0.57, B=0.43.
- Asignado: A=$11.400, B=$8.600.
- Pagado: A=$0, B=$20.000. Debido: A=$11.400, B=$8.600.
- Balance: A=−$11.400, B=+$11.400 → **A le debe $11.400 a B.** ✔️

---

## 6. Deployment

### Flujo de deploy

```
1. Código en GitHub (monorepo)
2. Vercel conectado al repo → auto-deploy en push a main
3. vercel.json: 
   - /* → Next.js
   - /api/* → FastAPI serverless (Python runtime)
4. Vercel Postgres: provisionar desde dashboard Vercel → string de conexión como variable de entorno
5. Variables de entorno en Vercel: DATABASE_URL, JWT_SECRET, ALLOWED_ORIGINS
```

### Consideraciones serverless

- **Cold start Python:** ~1-2s en primera llamada del día — aceptable para uso personal (2 usuarios).
- **Sin filesystem:** PDF procesado in-memory con BytesIO. No se persisten archivos.
- **Tiempo de ejecución:** cartola de ~60 movimientos procesa en < 3s (requisito no funcional del PRD). Verificar con la cartola de ejemplo como benchmark.

---

## 7. Roadmap (confirmado)

| Fase | Contenido |
|---|---|
| **Fase 0** | Setup: repo GitHub, proyecto Vercel, Vercel Postgres, estructura monorepo |
| **Fase 1 — MVP** | Auth + Hogar + medios de pago + imputación manual + split 57/43 + liquidación + dashboard básico |
| **Fase 2 — Ingesta** | Parser PDF Santander con pdfplumber + preview + categorización por reglas + cuotas |
| **Fase 3 — Análisis** | Evolución mensual, proyección de cuotas futuras, soporte CSV secundario |
| **Fase 4 — Conveniencia** | Sincronización bancaria, presupuestos, recurrentes, exportación |

---

## 8. Referencias

- `PRD_Gastos_Compartidos.md` — requisitos funcionales, épicas, flujos, casos borde, KPIs
- `Doc_Tecnico_ERD.md` — ERD completo, diccionario de datos, spec del parser, criterios de aceptación técnicos (10 casos de prueba)
