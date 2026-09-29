---
paths:
  - "odoo/custom_addons/custom_barcode_activos/**"
---

# Código único RC — invariantes + evidencia

Modelo: `stock.rc.label.pending` (`models/stock_rc_label_pending.py`). Reescrito 2026-09-28 tras
verificar contra el código de `changes_stock` (grep + lectura directa, sin CodeGraph — no rindió
mejor que grep dirigido en este módulo). Las líneas citadas pueden moverse con cada commit; si un
grep no encuentra el símbolo citado, confiar en el nombre de método/archivo, no en el número.

## Identidad

`barcode_value` = `[LSN]\d{5,}` (regex real: `_RC_LABEL_RE`, `stock_rc_label_pending.py:7`).
La letra es el **tracking del producto en el momento de generar la etiqueta**, no un enum libre:

- `L` = `tracking='lot'` (Lote)
- `S` = `tracking='serial'` (Serie)
- `N` = `tracking='none'` (Sin trazabilidad)

Generado por `ir.sequence.next_by_code(...)` en dos wizards. El mapeo tracking→letra ya **no** está
duplicado: ambos importan de `models/rc_label_common.py` (`TRACKING_TO_LABEL_TYPE` / `label_type_for`,
`rc_label_common.py:11,14,33`) — `rc_label_generator_wizard.py:8,48` y
`alist_label_generator_wizard.py:7` (`label_type_for`, `LABEL_TYPE_SEQUENCE`). El regex `RC_LABEL_RE`
también vive ahí y lo importan `controllers/main.py:7` y `stock_rc_label_pending.py:5`.

Secuencias reales en `data/rc_label_sequences.xml`: `stock.rc.label.lot` (L), `stock.rc.label.serial` (S),
`stock.rc.label.none` (N).

El regex de formato **solo se valida en `resolve_for_scan` (línea 248)**. `mark_in_progress` (línea 283)
NO revalida formato: asume que el código ya pasó por `resolve_for_scan`. Un caller que invoque
`mark_in_progress` directo (RPC, wizard futuro) se salta esa validación.

Campos (todos en `stock_rc_label_pending.py`):
- `purchase_line_id` → `Many2one('purchase.order.line')` (18)
- `requisition_item_id` → `Many2one('custom_requisiciones.material_electrico')` (27)
- `source_location_id` → `Many2one('stock.location')` (44)
- `tracking_lot_id` → `Many2one('stock.lot')` (52)
- `consumed_lot_item_id` → `Many2one('stock.lot.item')` (121)

`UNIQUE(barcode_value)` real a nivel BD: `_sql_constraints` en `stock_rc_label_pending.py:133`
(`barcode_value_uniq`), no solo `index=True`.

Nunca crear/inferir `stock.lot` a partir de `barcode_value`.

## Arquitectura: tres orígenes por fábrica

`models/rc_label_source.py` es una fábrica (`get_label_source(origen)`, línea 132) sobre un registro
`_SOURCES` (línea 125): `'recepcion'` → `RecepcionSource` (18), `'alistamiento'` → `AlistamientoSource`
(32), `'inventario'` → `InventarioSource` (44).

**`AlistamientoSource` está registrada pero muerta**: `get_label_source` solo se llama con
`'recepcion'` (`wizard/rc_label_generator_wizard.py:116`) y `'inventario'`
(`models/stock_quant_inventory.py:70`, `wizard/inventory_count_wizard.py:71`) en todo el módulo.
`wizard/alist_label_generator_wizard.py` arma sus `vals` directo, sin pasar por la fábrica — necesita
congelar ubicación exacta y lote/serial real por unidad antes de crear, algo que el contrato genérico
de `RcLabelSource.build_pending_vals` no cubre hoy. Decidir si se conecta o se borra.

**Solo `InventarioSource` materializa en un paso**: `materialize()` (línea 55) crea la unidad
(`stock.lot.item` vía `_materialize_lot_items:88` o `stock.reception.record` vía
`_materialize_records:66`) y consume la etiqueta en la misma transacción que la genera — no hay
ventana `pending → in_progress` porque el stock ya está físicamente en bodega (viene de un conteo).

**Lote fantasma en Inventario Cíclico**: `_resolve_lot` (línea 109) busca un `stock.quant` con
`lot_id` en esa ubicación; si no lo encuentra, **crea un `stock.lot` nuevo** con un código de
secuencia como nombre (líneas 116-118). Contradice la regla de Alistamiento ("nunca crea un lote
nuevo") — aquí el contexto es distinto (conteo de lo que ya está en bodega, no separación), pero es
una excepción real, no una coincidencia de nombres.

## Lifecycle

`state` Selection (`stock_rc_label_pending.py:99`): `pending` / `in_progress` / `consumed` / `cancelled`.

**`cancelled` está confirmado muerto**: grep exhaustivo de `state = 'cancelled'` / `'state': 'cancelled'`
en todo el módulo (py+js) → cero escritores. Todo lo que toca `'cancelled'` son lecturas defensivas y
filtros de dominio. Ningún flujo actual produce ese estado — el código se defiende contra algo
que no ocurre en la práctica.

**`release_in_progress()` (`stock_rc_label_pending.py:325`) ya NO está muerto** (corregido 2026-09-28;
una versión anterior de esta regla decía lo contrario). 2 llamadores reales: `barcode_ui_patch.js`
(descartar escaneos sin validar en Recepción) y `alistamiento_scan.js` (respaldo si la línea ya no
está en pantalla).

Métodos de lectura/transición confirmados, mismos nombres:
- `mark_in_progress(barcode, picking_id)` (283): busca por `barcode_value`, rechaza si
  `consumed`/`cancelled`/`in_progress` en OTRO picking, escribe `state=in_progress` + `picking_id` +
  `scanned_by_uid` + `scanned_date`. Llamado desde `barcode_ui_patch.js`.
- `get_inprogress_for_picking(picking_id)` (307): rehidrata chips de Recepción tras refresh.
  Llamado desde `barcode_ui_patch.js`.
- `get_inprogress_por_material(material_ids)` (342): igual para Alistamiento propio
  (filtra `requisition_item_id` + `purchase_line_id=False`). Llamado desde `alistamiento_scan.js`.

### Race condition real en `mark_in_progress`

`search` → chequea `state` → `write`, sin `SELECT ... FOR UPDATE` ni retry. Bajo read-committed
(default Postgres/Odoo), dos escaneos casi simultáneos del MISMO `barcode_value` desde DOS pickings
distintos pueden ambos leer `pending` antes de que el primer `write` se comprometa: ambos pasan la
validación "no está in_progress en otro picking". No hay fila duplicada (el UNIQUE es sobre
`barcode_value`, no sobre código+picking), pero la etiqueta queda del picking que escriba último, sin
error visible para el otro operario. Contradice la invariante "una etiqueta in_progress de un picking
no debe consumirse desde otro" a nivel de garantía transaccional real; en la práctica el UI serializa
los escaneos, pero un caller concurrente (RPC, dos pestañas) no está protegido.

### Pertenencia: defensa solo en cliente

`resolve_for_scan` valida formato + existencia + estado, no pertenencia a la operación actual. Esa
pertenencia (producto + `purchase_line_id` correctos) se filtra en `_ctsHandleRcScan`
(`barcode_ui_patch.js:579-600`) **en el cliente**, antes de llamar a `mark_in_progress`, que no vuelve
a validarla en servidor. Mismo patrón de riesgo que marca `alistamiento.md`: "pertenencia crítica debe
tener defensa servidor, no solo JS" — aquí la defensa vive solo en JS.

### Contraejemplo positivo: invariante sí protegida en servidor

`_check_anchor` (`stock_rc_label_pending.py:74`) es un `@api.constrains` real que llama a
`_material_matches_pol_analytic` para rechazar etiquetas con `requisition_item_id` /
`purchase_line_id` incoherentes, incluso por RPC/import. Motivado por un caso real (comentario cita
OC26-03739, líneas 71-76). Ejemplo del patrón correcto "invariante → servidor" de
`odoo-development.md`, a diferencia del punto anterior.

## Recepción: asociación código ↔ unidad

- `ctsRcScanState` (reactive, `barcode_ui_patch.js:316-318`) con `byLine`, `byVirtualId`, `used`: pool
  por picking, NO indica a qué unidad pertenece el código.
- `byVirtualId` **nunca se rehidrata** (confirmado, comentario explícito líneas 317-318 y 2038:
  "virtual_id cambia entre sesiones"); solo `byLine` + `used` se rehidratan desde
  `get_inprogress_for_picking` (líneas 707-737).
- `consumed_lot_item_id` se escribe en `_create_lot_items` (`stock_move_line_lot.py:204-209`), cadena
  real: `_action_done` (37-42, `_inherit='stock.move.line'`) → `_assign_rc_lot_codes` (143) →
  `_create_lot_items` (170).
- Simétrico para productos SIN tracking: `consumed_reception_record_id` contra
  `stock.reception.record`, escrito en `_assign_rc_reception_records` (líneas 292, 331-334).
- `_consume_pending_labels` (`stock_move_line_lot.py:10-35`): **no es FIFO ciego puro**. Primero toma
  hasta `qty` de etiquetas `in_progress` de ESTE MISMO picking (20-26, `order='id asc', limit=qty`) —
  para ligar lo que el operario escaneó en vivo a su propia unidad — y solo el remanente
  (`qty - len(inprog)`) lo completa con `pending` FIFO por id (30-34).
- `_cts_check_rc_completeness` (`stock_lot.py:315-353`, llamado desde `button_validate` línea 355-356)
  compara conteos agregados por `purchase_line_id` (no parejas código↔unidad), ahora también acotado a
  `picking_id=picking.id` (línea 342-347). **Efecto secundario no anunciado por el nombre**: antes de
  decidir si bloquea, hace `sin_capturar.write({'quantity': 0, 'picked': False})` (332-334) para líneas
  sin lote capturado — muta datos incluso en pickings que luego sí pasan la validación.
- `barcode_value: False` es un valor legítimo por diseño en `stock.lot.item` / `stock.reception.record`
  cuando faltan etiquetas `pending`/`in_progress` para cubrir la cantidad recibida (comentado a
  propósito en `stock_move_line_lot.py:196-200` y `:312-316`: no generan código al vuelo). Cualquier
  reporte que asuma 1:1 código↔unidad debe filtrar esto.

DESCARTADO como solución (histórico, sigue vigente): resolver la columna "Identificación" editando
`ctsRcChips`/`byLine`/`byVirtualId` — 3 intentos fallidos, el dato de qué código escaneó el operario
para qué unidad no se persiste antes de validar; ningún cambio de display puede inventarlo.

`stock.lot.item` (`models/stock_lot_item.py:16-19`): unidad física individual dentro de un lote/serial
recibido por compra. Su análogo sin tracking es `stock.reception.record`
(`models/stock_reception_record.py:17`).

## Diagnóstico mínimo

```text
barcode_value
stock.rc.label.pending
requisition_item_id
purchase_line_id
source_location_id
tracking_lot_id
mark_in_progress
release_in_progress
get_inprogress_for_picking
get_inprogress_por_material
_consume_pending_labels
_cts_check_rc_completeness
state
picking_id
move_id
consumed_lot_item_id
consumed_reception_record_id
```

Separar en el reporte: comportamiento confirmado actual / dato histórico / riesgo / deuda de datos.
