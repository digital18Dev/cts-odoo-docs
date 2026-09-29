# Dominio Recepción

> **Ámbito original:** `wizard/rc_label_generator_wizard.py` (+ vistas), `wizard/rc_label_mode_wizard.py`, `models/stock_move_line_lot.py`, `models/stock_reception_record.py` (+ vistas), `static/src/js/patches/barcode_ui_patch.js`, `static/src/xml/patches/line_component_patch.xml`. Ver [índice de reglas operativas](index.md).

> **Desactualizado en 1 punto** (no reescrito todavía, a diferencia de [Código único RC](barcode-rc.md)): la sección "Lifecycle" de abajo dice que `release_in_progress()` tiene cero llamadores y que no hay forma de deshacer un escaneo desde la UI de Recepción. Eso ya no es así — `barcode_ui_patch.js` lo llama al descartar escaneos sin validar (diálogo al salir de la pantalla), y esa sí es una ruta real desde la UI de Recepción.

## Alcance

```text
OC
→ picking IN
→ generación RC
→ escaneo
→ validación
→ parcial/completa
→ backorder
→ stock.lot.item / stock.reception.record
```

No desarrollar Alistamiento/Entrega salvo dependencia directa demostrada.

## Reglas confirmadas

- Recepción entra a `warehouse.lot_stock_id`: esto es config estándar de Odoo (destino por defecto del
  `stock.picking.type` de entrada), NO código de este módulo — no hay file:line que lo "fije" aquí.
  Confirmado indirectamente porque Alistamiento usa ese mismo `lot_stock_id` como origen al redistribuir
  después (`models/stock_alistamiento.py:706` y `:123,201,204,227,491-509`).
- `requisition_item_id` tiene prioridad como ancla; analítica/`purchase_line_id` son fallback. Evidencia
  que importa de verdad (no solo el wizard de display): `models/stock_move_line_lot.py:183,310` —
  `req_for_unit = label.requisition_item_id if (label and label.requisition_item_id) else fallback_req_line`.
  El fallback resuelve por analítica vía `_get_req_item_by_analytic`
  (`models/stock_move_line.py:8-47`) — es un **heurístico de substring** (`consecutivo in name`,
  línea 89), no un FK exacto: workaround para datos malos conocidos de `custom_requisiciones`
  (caso real OC26-03739, ver comentario en `stock_rc_label_pending.py:71-76`).
- Escanear NO escribe `consumed`. `resolve_for_scan` es de solo lectura (comentario explícito en
  `barcode_ui_patch.js:552`: "NO consume nada en BD"). `mark_in_progress`
  (`stock_rc_label_pending.py:244-266`) solo escribe `state='in_progress'` (línea 261).
  `consumed` se escribe únicamente en `_create_lot_items` (`stock_move_line_lot.py:204-209`, lote/serie)
  y `_assign_rc_reception_records` (`:330-335`, sin tracking), ambos disparados desde `_action_done`
  (`stock_move_line_lot.py:37-42`) dentro de `button_validate`.
- **Etiqueta de otra recepción SÍ se rechaza server-side**, no solo en JS:
  `stock_rc_label_pending.py:258-259`, dentro de `mark_in_progress`, antes de cualquier `write()`.
  **Pero ojo con el alcance real**: ese guard solo protege pertenencia al *picking* (mismo
  `picking_id`). NO valida que el `product_id`/`purchase_line_id` de la etiqueta correspondan a una
  línea de ESTE picking — ese match sí es solo client-side, en `_ctsHandleRcScan`
  (`barcode_ui_patch.js:580-591`, filtro `candidates`). Si ese filtro de cliente se saltara (RPC
  directo, bug), `mark_in_progress` reservaría sin problema una etiqueta de otro producto — el único
  freno downstream es que `_consume_pending_labels` filtra por `purchase_line_id` al consumir, así que
  la etiqueta mal asignada simplemente queda `in_progress` para siempre (ver gotcha de huérfanos).

Lifecycle confirmado (`state` en `stock_rc_label_pending.py:83-88`):

```text
pending (default)
→ escaneo válido → mark_in_progress: in_progress + picking_id (línea 260-265)
→ button_validate (stock_lot.py:355-374) → _cts_check_rc_completeness → super().button_validate()
→ _action_done (stock_move_line_lot.py:37-42) → consumed
```

`cancelled` existe en el Selection, se LEE en varios sitios defensivos
(`stock_rc_label_pending.py:256-257`, ambos wizards, `stock_alistamiento.py:969`,
`barcode_ui_patch.js:615`). **Ya no es un estado muerto** (corregido 2026-09-29 — a diferencia de lo
que decía una versión anterior de esta página): desde `9d756afbc`, `action_release_unprinted` lo
escribe sobre una etiqueta `pending` recién creada cuando su ZPL no llegó a la impresora. Detalle
completo en [Código único RC](barcode-rc.md#lifecycle).

`release_in_progress()` (`stock_rc_label_pending.py:287-300`) — ver nota de corrección al inicio de
la página: hoy SÍ tiene llamadores reales, incluido uno desde la propia UI de Recepción.

## Parciales / backorders / impresión

**Confirmado e implementado**, no aspiracional. `action_open_lines`
(`wizard/rc_label_generator_wizard.py:200-299`):

- `ya_generado` = etiquetas con `state not in ('cancelled','consumed')` (líneas 205-206). `consumed` se
  excluye a propósito — bug real fijado (comentario cita "REC-02: backorder de 1 mostraba pendiente=0",
  líneas 201-204).
- `ya_recepcionado` = `mats.recepcionado` (línea 292).
- `qty_pendiente = max(0, product_qty - ya_generado - ya_recepcionado)` (línea 293).

Caso mínimo verificado paso a paso: OC=2 → imprimir 1 (`ya_generado=1`) → pendiente=1 → recibir 1
(consumida, sale de `ya_generado`, `recepcionado=1`) → pendiente = `2-0-1=1`. Cuadra exacto.

**Asimetría no documentada antes**: `_cts_check_rc_completeness` (`stock_lot.py:315-353`) solo bloquea
`button_validate` para productos con `tracking != 'none'` (línea 320-322, filtro `tracked`). Productos
sin tracking (`stock.reception.record`) NO tienen gate de completitud pre-validate: se puede validar
sin ningún escaneo RC, y las unidades quedan con `barcode_value=False` a propósito
(`stock_move_line_lot.py:312-316`).

## Reimpresión

**Confirmado, reutiliza identidad**: `action_print_rc_labels_picking_wizard` (`stock_lot.py:213-224`)
→ `rc_label_mode_wizard.py:36-43` → mismo reporte (`action_report_rc_labels_combined`), sin crear
`stock.rc.label.pending`/`stock.lot.item`/`stock.reception.record` nuevos. Los campos `barcode_value`
en ambos modelos "unidad" son `readonly=True, copy=False`, escritos una sola vez al consumir
(`stock_move_line_lot.py:200`, `:320`) — reimprimir garantiza mismo código, misma requisición, mismo
tracking. Reprint legado por lote: `stock_lot.py:80-89`.

Nota aparte (no en la regla original, ver [Código único RC](barcode-rc.md)): esto describe el reprint
por picking sobre unidades ya recibidas. El módulo también trae una reimpresión de etiquetas
`stock.rc.label.pending` individuales desde Recepción (REC-01), con contador `reprint_count` propio —
mecanismo distinto, mismo principio de "nunca crea identidad nueva".

## Modelos "unidad"

- `stock.reception.record` (`models/stock_reception_record.py:16-148`) — productos sin tracking.
- `stock.lot.item` (`models/stock_lot_item.py:16-90`) — productos con lote/serie.

Ambos con `barcode_value` indexado/readonly/copy=False, `requisition_id`, `purchase_value`,
`reserved_move_id` (para Entrega), e historial (`history_ids`).

## Gotchas confirmados (no triviales)

1. **Huérfanos `in_progress`**: si una etiqueta se reserva en un picking pero nunca matchea ningún move
   al validar (ver gap de pertenencia arriba), queda `in_progress` indefinidamente si nadie la libera
   antes de validar — ver nota de corrección al inicio: hoy hay un camino real (`release_in_progress`
   al salir sin validar), pero solo cubre ese momento puntual, no un barrido posterior a validar.
2. **`_cts_check_rc_completeness` compara agregados, no parejas** — puede confirmar "N escaneadas ≥ N
   capturadas" para una línea de compra sin garantizar que sean las unidades correctas (mismo hallazgo
   que [Código único RC](barcode-rc.md), sigue vigente).
3. **Heurístico de analítica es adivinanza por substring**, no FK — si se usa como ancla "limpia" en
   código nuevo, revisar `_get_req_item_by_analytic` primero.

## Refactorización

Clasificar métodos por: generación; cantidad/disponibilidad; lifecycle/scan; consumo; creación de
unidad; tracking; backorder; UI. No extraer solo por tamaño.
