# PRD — App de Gastos Compartidos del Departamento

**Producto (nombre tentativo):** *NuestraCuenta*
**Versión del documento:** 1.0 (borrador)
**Fecha:** Junio 2026
**Autor:** Equipo fundador (pareja)
**Estado:** Para validación

---

## 1. Resumen ejecutivo

Una pareja que comparte un departamento necesita controlar, clasificar y entender sus gastos comunes, que hoy se pagan principalmente con **una cuenta corriente y una tarjeta de crédito compartidas**, pero también ocasionalmente con **tarjetas personales** de cada uno. La división del gasto del hogar es **proporcional: 57% / 43%**, no 50/50.

El producto resuelve tres cosas que ninguna herramienta del mercado cubre **de forma combinada**:

1. **Ingesta dual de datos:** carga manual de gastos *y* subida de la cartola (`.csv` / PDF del banco) con categorización asistida.
2. **Reparto proporcional configurable** (57/43) que distingue entre gasto del hogar y gasto personal, incluso cuando el pago se hizo con una tarjeta personal.
3. **Liquidación clara** (“quién le debe cuánto a quién”) que cierra el mes considerando quién *pagó* versus quién *debía* pagar.

---

## 2. El problema

Hoy la pareja vive estas fricciones:

- **Visibilidad nula:** no saben en qué se va la plata (alimentación, hogar, delivery, etc.) ni cómo evoluciona mes a mes.
- **Reparto manual y propenso a error:** calcular 57/43 a mano sobre decenas de movimientos es tedioso y se presta a discusiones.
- **Gastos cruzados:** a veces uno paga un gasto del depto con su tarjeta personal y eso se “pierde” o se olvida a la hora de cuadrar.
- **Movimientos ruidosos en la cartola:** la cartola trae cosas que **no** son gasto del hogar (pago de la propia tarjeta, notas de crédito/devoluciones, impuestos, cuotas ya contabilizadas) y hay que filtrarlas a mano.
- **Cuotas:** las compras en cuotas distorsionan la lectura del mes si no se manejan bien (ej.: una compra de $1.749.498 en 12 cuotas que aporta solo $145.792 al mes).

---

## 3. Análisis de soluciones existentes (benchmarking)

Resumen de la investigación de mercado y dónde queda la oportunidad.

### 3.1 Apps de gastos compartidos (el “reparto”)

| App | Fortalezas | Limitaciones para este caso |
|---|---|---|
| **Splitwise** | Estándar de facto; reparto desigual/porcentual; categorías; simplifica deudas; recurrentes; web + móvil | Pensada para grupos/viajes; versión gratis limitada (tope de gastos/día); **no importa cartola chilena ni categoriza automático**; reparto porcentual existe pero es manual por gasto |
| **Tricount** | Muy simple; no todos deben registrarse | Orientada a viajes; reseñas recientes reportan que quitaron exportación y versión web y que la sincronización falla; **sin importación bancaria** |
| **Splitt** | Gratis, en español, diseñada para parejas, PWA sin instalación | Foco en reparto simple; **sin ingesta de cartola ni analítica de categorías** |
| **Settle Up / Splid / Sesterce** | Reparto desigual, offline, exportación CSV/PDF | Mismo techo: registro manual, sin banco, sin foco en analítica de consumo |

> **Conclusión:** resuelven el *split* pero no el *entender en qué gastamos* ni la *ingesta automática* de la cartola.

### 3.2 Apps de finanzas personales chilenas (la “ingesta + categorías”)

| App | Fortalezas | Limitaciones para este caso |
|---|---|---|
| **piggi.cl** | Importa cartola (Excel/CSV) y **PDF de cuenta corriente Santander**; sincronización automática con Santander/Banco de Chile/Falabella; menciona “organizar finanzas en pareja o familia”; modo local sin cuenta | El reparto en pareja parece secundario; **no está claro el split proporcional 57/43 con liquidación** ni el caso “tarjeta personal = gasto del depto” |
| **mAImoney** | Importa cartola CSV; **auto-categorización de 100+ comercios chilenos** (Lider, Jumbo, Sodimac, MercadoPago, etc.); preview con desmarcado de movimientos internos (ej. pago de tarjeta); procesamiento local | Enfocada en finanzas **individuales** (“Safe-to-Spend”), no en reparto de pareja |
| **Fintonic / Wallet / Money Lover / Monefy / COIN** | Categorización automática, presupuestos, algunas con sincronización bancaria | Foco individual; reparto en pareja inexistente o muy básico |

> **Conclusión:** resuelven la *ingesta y categorización* pero no el *reparto proporcional de pareja con liquidación*.

### 3.3 La oportunidad (brecha)

Ninguna herramienta combina, para el caso de una pareja chilena, **las tres patas a la vez**:

```
Ingesta cartola CSV/PDF  +  Categorización  +  Reparto proporcional 57/43 con liquidación
        (piggi, mAImoney)        (mAImoney)             (Splitwise/Splitt)
```

El diferenciador del producto es ser la **intersección** de esos tres mundos, con el matiz crítico de **gasto del hogar pagado con tarjeta personal**.

> *Nota de build vs buy:* dado que **piggi** y **mAImoney** ya resuelven muy bien la ingesta/categorización de cartolas chilenas, vale la pena evaluar si conviene apoyarse en una de ellas (o en un agregador como Fintoc para conexión bancaria) y concentrar el esfuerzo propio en la capa de **reparto + liquidación de pareja**, que es donde está el valor único. Ver “Preguntas abiertas”.

---

## 4. Usuarios y objetivos

### 4.1 Personas

- **Persona A (57%):** uno de los miembros de la pareja. Paga la mayor proporción.
- **Persona B (43%):** el otro miembro.
- Ambos son **co-administradores** del mismo “Hogar” (workspace compartido). No hay roles asimétricos de permisos en el MVP.

### 4.2 Objetivos del producto

1. **Controlar:** registrar todos los gastos del hogar sin fugas.
2. **Clasificar:** asignar categoría a cada gasto, con la mínima fricción.
3. **Entender:** ver en qué se gasta y cómo evoluciona en el tiempo.
4. **Repartir y liquidar:** saber con exactitud cuánto le debe uno al otro cada periodo.

### 4.3 Métricas de éxito (KPIs)

- **% de movimientos categorizados** sin intervención manual (objetivo MVP: ≥ 70% vía reglas).
- **Tiempo para cuadrar el mes** (objetivo: < 5 minutos desde la subida de la cartola).
- **% de gastos del hogar capturados** que se pagaron con tarjeta personal (mide que el caso cruzado no se pierda).
- **Frecuencia de uso** (objetivo: al menos 1 sesión semanal por persona).
- **Discrepancia en la liquidación** (objetivo: $0 de descuadre entre lo que cada uno cree y lo que la app calcula).

---

## 5. Alcance

### 5.1 Dentro del MVP

- Workspace de **Hogar** para 2 personas con ratio de reparto configurable (default 57/43).
- **Cuentas/medios de pago**: cuenta corriente compartida, tarjeta de crédito compartida, y tarjetas personales de cada uno.
- **Imputación manual** de gastos.
- **Importación de cartola** (PDF crudo de tarjeta de crédito Santander vía `pdfplumber`; `.csv` como vía secundaria).
- **Preview de importación**: revisar, desmarcar movimientos internos, ajustar categoría antes de confirmar.
- **Categorización** con reglas por comercio (semilla de comercios chilenos) + aprendizaje simple.
- **Reparto por movimiento**: hogar (57/43 o custom) / 100% una persona / excluido.
- **Liquidación del periodo** (“quién le debe a quién”) y registro de pagos de saldo.
- **Dashboard**: gasto por categoría, evolución mensual, gasto por persona.
- **Manejo de cuotas**: identificar compras en cuotas y reflejar el valor de la cuota del mes vs el monto total.

### 5.2 Fuera del MVP (roadmap futuro)

- Sincronización bancaria automática (vía agregador tipo Fintoc o conexión directa).
- Soporte multi-banco más allá de Santander.
- Presupuestos por categoría con alertas.
- Multi-moneda.
- Gastos recurrentes/fijos automáticos (arriendo, suscripciones).
- Notificaciones push y recordatorios de liquidación.
- Exportación a PDF/Excel.
- Más de 2 personas (roommates).

---

## 6. Requisitos funcionales

Organizados por épica, con historias de usuario (HU) y criterios de aceptación (CA).

### Épica 1 — Configuración del Hogar

- **HU 1.1** Como usuario quiero crear un “Hogar” e invitar a mi pareja para compartir los datos.
- **HU 1.2** Como usuario quiero definir el **ratio de reparto por defecto** (ej. 57/43) y poder editarlo.
- **HU 1.3** Como usuario quiero registrar mis **medios de pago** (cuenta corriente compartida, TC compartida, mis tarjetas personales) y marcar cuáles son compartidos vs personales.
  - **CA:** cada medio de pago tiene dueño (Hogar, Persona A o Persona B) y un identificador (ej. últimos 4 dígitos `7777`).

### Épica 2 — Imputación manual

- **HU 2.1** Como usuario quiero registrar un gasto a mano con: fecha, monto, descripción/comercio, medio de pago, categoría y tipo de reparto.
- **HU 2.2** Como usuario quiero marcar un gasto como **del hogar** (se reparte) o **personal** (no se reparte).
- **HU 2.3** Como usuario quiero registrar que **pagué un gasto del hogar con mi tarjeta personal**, para que entre a la liquidación.
  - **CA:** el gasto queda con `pagador = Persona B`, `es_hogar = true`, y el split se calcula igual (57/43), generando deuda de A hacia B por su parte.

### Épica 3 — Importación de cartola

- **HU 3.1** Como usuario quiero subir el **PDF crudo de la cartola de la tarjeta Santander** y ver un **preview** con los movimientos detectados (extraídos con `pdfplumber`).
- **HU 3.2** Como usuario quiero, opcionalmente, subir un `.csv` para bancos cuyo PDF no sea tabular (vía secundaria).
- **HU 3.3** Como usuario quiero que el sistema **excluya por defecto los movimientos internos** (pago de la tarjeta / `MONTO CANCELADO`, transferencias entre cuentas propias).
- **HU 3.4** Como usuario quiero **desmarcar** movimientos que no quiero importar y **editar la categoría** antes de confirmar.
- **HU 3.5** Como usuario quiero que el sistema **detecte duplicados** si subo la misma cartola dos veces o si un gasto ya fue ingresado a mano.
  - **CA:** un movimiento se considera duplicado si coinciden fecha + monto + descripción normalizada (ver doc técnico).
- **HU 3.6** Como usuario quiero que se reconozcan **notas de crédito / devoluciones** (montos negativos) y se apliquen como abono.
- **HU 3.7** Como usuario quiero que las **compras en cuotas** se importen con su número de cuota (`06/24`), valor de cuota mensual y monto total, distinguiendo el cargo del mes.

### Épica 4 — Categorización

- **HU 4.1** Como usuario quiero que cada movimiento reciba una **categoría sugerida** según el comercio.
- **HU 4.2** Como usuario quiero **corregir** la categoría y que el sistema **recuerde** la regla para ese comercio.
- **HU 4.3** Como usuario quiero crear **categorías y subcategorías** personalizadas.
  - **CA:** categorías semilla sugeridas: Alimentación/Supermercado, Hogar/Muebles, Delivery, Restaurantes, Transporte, Entretención, Servicios básicos (luz/agua/gas), Telecom, Salud, Mascotas, Otros.

### Épica 5 — Reparto y liquidación

- **HU 5.1** Como usuario quiero que cada gasto del hogar se reparta automáticamente según el ratio (57/43).
- **HU 5.2** Como usuario quiero **sobrescribir el reparto** de un gasto puntual (ej. 50/50, 100% A, 100% B).
- **HU 5.3** Como usuario quiero ver, por periodo, **cuánto le debe cada uno al otro** considerando quién pagó.
- **HU 5.4** Como usuario quiero **registrar el pago de la liquidación** (transferencia de B a A, por ejemplo) y que el saldo se cierre.
- **HU 5.5** Como usuario quiero que el cálculo de liquidación sea **explicable** (poder ver el detalle de cómo se llegó al monto).

### Épica 6 — Análisis y reportes

- **HU 6.1** Como usuario quiero un **dashboard** con gasto total del hogar del periodo.
- **HU 6.2** Como usuario quiero ver **gasto por categoría** (gráfico) y por persona.
- **HU 6.3** Como usuario quiero ver la **evolución mensual** del gasto (similar al gráfico de la cartola).
- **HU 6.4** Como usuario quiero ver el **calendario de cuotas futuras** (qué se viene los próximos meses), aprovechando la sección “vencimiento próximos 4 meses” de la cartola.

---

## 7. Flujos clave

### 7.1 Flujo: cerrar el mes con la cartola

```
1. Llega la cartola → usuario descarga CSV del banco
2. Sube el CSV → app parsea y muestra preview
3. App auto-excluye internos (pago TC, transferencias propias) y auto-categoriza
4. Usuario revisa: desmarca lo que no aplica, corrige categorías, marca gastos personales
5. Usuario confirma → movimientos se inyectan
6. App calcula split 57/43 y liquidación del periodo
7. Usuario ve “B le debe $X a A” → registra el pago cuando se transfiere
```

### 7.2 Flujo: gasto del hogar con tarjeta personal

```
1. B compra en el super con su tarjeta personal ($20.000)
2. B registra el gasto a mano (o lo marca al importar su cartola personal)
3. Marca es_hogar = true, medio = tarjeta personal de B
4. App reparte: A debe $11.400 (57%), B debe $8.600 (43%)
5. Como B pagó $20.000, A le debe $11.400 → entra a la liquidación
```

---

## 8. Casos borde (derivados de la cartola real)

Estos casos provienen del análisis del estado de cuenta Santander de ejemplo y **deben** estar contemplados:

| Caso | Ejemplo en la cartola | Tratamiento esperado |
|---|---|---|
| **Pago de la propia tarjeta** | `MONTO CANCELADO $ -1.183.658` | Movimiento interno → **excluir** del gasto (no es consumo) |
| **Notas de crédito / devoluciones** | `NOTA DE CREDITO $ -499.990` | Abono → reduce el gasto de la categoría asociada (negativo) |
| **Impuesto de timbres** | `IMPTO. DECRETO LEY 3475 $ 7.600` | Cargo financiero → categoría “Comisiones/Impuestos”; decidir si es del hogar |
| **Compra en cuotas (ya vigente)** | `MACONLINE … 06/24, cuota $52.873, total $1.268.949` | El **cargo del mes** es la cuota ($52.873), no el total |
| **Compra en cuotas nueva del periodo** | `FLOW *SAMSUNG 12 CUOTAS, total $949.991, cuota $79.166` | Registrar plan de cuotas + proyección de cuotas futuras |
| **Propinas / micro-cargos** | `PedidosYa*Propina $150` | Gasto normal, categorizable |
| **Comercio con prefijos de pasarela** | `MP*`, `MERCADOPAGO*`, `DP *`, `FLOW *` | Normalizar descripción para categorizar (quitar prefijos) |
| **Mismo comercio, varias veces** | `JUMBO ALTO LAS CONDES` repetido | Cada uno es un movimiento independiente; no deduplicar entre sí |
| **Monto negativo vs positivo** | abonos vs cargos | Respetar signo; no convertir todo a positivo |

---

## 9. Requisitos no funcionales

- **Privacidad:** datos financieros sensibles. Preferir procesamiento local del archivo cuando sea posible (como hace mAImoney) o cifrado en reposo. **Nunca** pedir la clave del banco para parsear un CSV.
- **Seguridad:** autenticación por usuario; los datos del Hogar solo visibles para sus 2 miembros.
- **Usabilidad móvil:** el flujo de imputación manual debe ser de pocos toques (referencia: el “círculo de categorías” de Monefy).
- **Desempeño:** importar una cartola de ~60 movimientos en < 3 segundos.
- **Confiabilidad del cuadre:** la suma de los movimientos importados debe **validarse contra el “Monto Total Facturado a Pagar”** de la cartola (control de integridad).
- **Disponibilidad:** web responsive y/o PWA para no obligar a instalar (referencia: Splitt).

---

## 10. Supuestos

1. La pareja usa principalmente **Santander** (la cartola de ejemplo lo es); el MVP optimiza para ese formato.
2. El ratio 57/43 es **fijo y configurable** a nivel de Hogar, con override por gasto.
3. Moneda única: **CLP**.
4. Solo 2 personas en el MVP.
5. La cartola se sube como **PDF crudo** del estado de cuenta (CSV queda como opción secundaria).

## 11. Preguntas abiertas (a decidir antes de construir)

1. **¿Build vs Buy?** ¿Construir la ingesta/categorización desde cero o apoyarse en piggi/mAImoney/Fintoc y construir solo la capa de reparto de pareja?
2. **¿Plataforma?** ¿Web (PWA) primero, o app nativa móvil? (recomendación: PWA por menor fricción).
3. **¿Sincronización bancaria automática** en el roadmap, o quedarse en CSV/PDF por privacidad?
4. **¿Los impuestos y comisiones de la tarjeta compartida** se reparten 57/43 o se tratan aparte?
5. **¿Las cuotas** se reparten en el mes del cargo (la cuota) o en el mes de la compra (el total)? (recomendación: por cuota del mes, para que la liquidación calce con el flujo de caja real).
6. **¿Cómo nombrar a las personas** (A=57 / B=43) y confirmar quién es quién.

## 12. Roadmap sugerido

- **Fase 0 — Validación:** confirmar build vs buy y plataforma.
- **Fase 1 — MVP:** Hogar + medios de pago + imputación manual + split 57/43 + liquidación + dashboard básico.
- **Fase 2 — Ingesta:** importación del **PDF Santander con `pdfplumber`** + preview + categorización por reglas + manejo de cuotas.
- **Fase 3 — Análisis:** evolución mensual, proyección de cuotas, soporte CSV secundario.
- **Fase 4 — Conveniencia:** sincronización bancaria, presupuestos, recurrentes, exportación.
