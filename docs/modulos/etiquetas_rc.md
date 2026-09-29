# Etiquetas RC

Código único que `custom_barcode_activos` asigna a cada unidad física de bodega (un lote, un serial o una unidad sin rastreo) para seguirla desde que se genera hasta que se entrega. Esta página reúne todo lo relativo a la etiqueta: de dónde sale, cómo cambia de estado y qué hace cada dominio con ella. El resto del módulo está en [custom_barcode_activos](custom_barcode_activos.md).

!!! note "Alcance de esta página"
    Verificado contra el código de la rama `changes_stock` el 2026-09-28. Se cita `archivo::método` y no número de línea, porque las líneas cambian con cada commit. Nada se comprobó en base de datos ni en navegador: las reglas salen de leer el código.

## Identidad del código

| Aspecto | Regla | Dónde |
|---|---|---|
| Formato | Letra + 5 o más dígitos: `^[LSN]\d{5,}$`, sin distinguir mayúsculas | `rc_label_common.py::RC_LABEL_RE` |
| Letra | Sigue el rastreo del producto **al generar** la etiqueta: `lot` → `L`, `serial` → `S`, `none` → `N` | `rc_label_common.py::TRACKING_TO_LABEL_TYPE` |
| Numeración | Una secuencia por letra: `stock.rc.label.lot`, `stock.rc.label.serial`, `stock.rc.label.none` | `data/rc_label_sequences.xml` |
| Unicidad | `unique(barcode_value)` en base de datos | `stock.rc.label.pending._sql_constraints` (`barcode_value_uniq`) |

La etiqueta RC identifica una **unidad**. No confundir con la etiqueta CTS de producto (`product.template`), que identifica el producto y no lleva código único.

**Impresión.** El tamaño chico sale en ZPL directo a la Zebra por Browser Print. El rollo mide 102 mm de ancho con 3 columnas de 32×15 mm, a 203 dpi (816 dots). Se manda un `^XA` por fila de hasta 3 etiquetas: si se manda una sola columna, la impresora avanza una fila física completa por cada etiqueta (`stock_rc_label_pending.py`, `_ZPL_PAGE_WIDTH_DOTS`). Los demás tamaños salen en PDF.

## Tres orígenes, un solo modelo

<div class="diagram" data-diagram-src="../etiquetas_rc.origenes.diagram.html"><a href="../etiquetas_rc.origenes.diagram.html">Abrir diagrama: tres orígenes, un solo modelo</a></div>

Toda etiqueta vive en `stock.rc.label.pending`, pero nace desde uno de tres orígenes (`origen`), cada uno con su ancla:

| Origen | Ancla | Quién la genera | ¿Pasa por la fábrica? |
|---|---|---|---|
| `recepcion` | `purchase_line_id`, y `requisition_item_id` cuando se conoce | `rc.label.generator.wizard` | Sí: `get_label_source('recepcion')` + `create_pending_labels` |
| `alistamiento` | `requisition_item_id` + ubicación (`source_location_id`) + lote/serial real (`tracking_lot_id`), congelados | `alist.label.generator.wizard` | No: el wizard arma sus propios valores |
| `inventario` | `inventory_location_id` | `inventory.count.wizard` o el árbol de `stock.quant` (columnas "Con Etiqueta" / "Sin Etiqueta") | Sí: `get_label_source('inventario')` + `InventarioSource.materialize()` |

La fábrica es `rc_label_source.py::get_label_source`. `AlistamientoSource` está registrada en su diccionario de orígenes, pero nadie la llama: `get_label_source` solo se invoca con `'recepcion'` e `'inventario'`. Alistamiento arma sus valores a mano porque necesita congelar la ubicación exacta y el lote/serial real de cada unidad, algo que el contrato genérico de la fábrica no cubre.

## Ciclo de vida

<div class="diagram" data-diagram-src="../etiquetas_rc.estados.diagram.html"><a href="../etiquetas_rc.estados.diagram.html">Abrir diagrama: ciclo de vida de la etiqueta RC</a></div>

`state` es un `Selection` de 4 valores. Desde `9d756afbc` (2026-09-29) los 4 ocurren en la práctica —
antes `cancelled` no tenía escritor real.

| Estado | Se llega desde | Quién lo escribe |
|---|---|---|
| `pending` | Valor por defecto al crear, o `in_progress` al liberar | `create_pending_labels` (Recepción, Inventario) o los valores directos de `alist.label.generator.wizard`; `release_in_progress` al liberar |
| `in_progress` | `pending` | `mark_in_progress` (Recepción) · `resolve_rc_scan` (Alistamiento) |
| `consumed` | `in_progress`, o directo desde `pending` en Recepción (relleno sin escaneo) e Inventario Cíclico | `_create_lot_items` / `_assign_rc_reception_records` (Recepción) · `confirm_alistamiento` (Alistamiento) · `InventarioSource.materialize()` (Inventario) |
| `cancelled` | `pending` (recién creada, sin escanear) | `action_release_unprinted` (`stock_rc_label_pending.py`, `9d756afbc`), cuando el ZPL no llegó a la impresora |

!!! note "`cancelled` ya tiene un escritor real (`9d756afbc`, 2026-09-29)"
    `action_release_unprinted(label_ids)` cancela, desde el cliente (`releaseUnprintedLabels` en `browserprint_utils.js`), las etiquetas que acaba de crear el mismo wizard cuando `sendZplViaBrowserPrint` falla: exige `create_date >= now - 10 min`, mismo `create_uid`, y `reprint_count = 0` — así no puede cancelar una etiqueta ajena, vieja o ya reimpresa. Sigue sin salida: ninguna transición saca una etiqueta de `cancelled`. `mark_in_progress` la excluye igual que a `consumed`, así que una etiqueta liberada queda sin poder reescanearse; la unidad real termina con un código distinto.

!!! warning "Recepción puede consumir etiquetas que nadie escaneó"
    Al validar, `stock_move_line_lot.py::_consume_pending_labels` toma primero las etiquetas `in_progress` de ese mismo picking y **completa lo que falte con etiquetas `pending`** de la línea de compra, en orden de creación. El control que obliga a escanear (`stock_lot.py::_cts_check_rc_completeness`) solo revisa productos con lote o serial. Un producto sin rastreo validado sin escanear pasa de `pending` a `consumed` sin pasar por `in_progress`, y la etiqueta queda ligada a la unidad por orden, no por la caja física.

`is_delivered` no es un estado: es un campo aparte que marca Entrega (ver [Entrega](#entrega)).

## Flujos por dominio

<div class="diagram" data-diagram-src="../etiquetas_rc.flujos.diagram.html"><a href="../etiquetas_rc.flujos.diagram.html">Abrir diagrama: generar, escanear y consumir por dominio</a></div>

### Recepción

1. **Generar.** `rc.label.generator.wizard` propone por línea de OC lo pendiente de etiquetar: lo comprado menos las etiquetas ya generadas (`pending` o `in_progress`) menos lo recepcionado. Las `consumed` quedan fuera a propósito, porque su cantidad ya está restada en lo recepcionado (REC-02). No valida stock: la compra todavía no llegó. La cantidad a imprimir arranca en 0.
2. **Chequeo de impresora.** Antes de crear las etiquetas, el cliente llama `browserprint_utils.js::hasBrowserPrintDevice`. Confirma que hay una Zebra visible, no que la impresión vaya a salir bien.
3. **Escanear.** `resolve_for_scan` resuelve el código sin escribir. El cliente filtra la pertenencia (mismo producto y línea de OC) y llama `mark_in_progress`, que rechaza etiquetas `consumed`, `cancelled` o `in_progress` en otro picking. El servidor no repite el filtro de pertenencia.
4. **Validar.** `_cts_check_rc_completeness` bloquea si, en un producto con rastreo, hay más unidades con lote capturado que etiquetas `in_progress` en el picking. Luego `_consume_pending_labels` elige las etiquetas (escaneadas primero, `pending` después) y `_create_lot_items` / `_assign_rc_reception_records` crean la unidad y marcan la etiqueta `consumed`.

### Alistamiento

1. **Generar.** `alist.label.generator.wizard` bloquea si el producto exige lote/serial y no se eligió uno real: Alistamiento nunca inventa un lote. Congela la ubicación exacta, nunca la raíz si el stock vive en una hija. Para productos sin rastreo, `_ubicaciones_reales_sin_tracking` reparte entre las ubicaciones reales de mayor a menor disponible, y aborta si no alcanza.
2. **Escanear.** `resolve_rc_scan` valida y escribe `in_progress` en la misma llamada (diagrama abajo).
3. **Confirmar.** `confirm_alistamiento` solo consume etiquetas `in_progress` y liga cada una al `move_id` exacto del OUT que crea. Si algún move no reserva completo, un `UserError` revierte toda la confirmación, incluidas las etiquetas ya marcadas (ALI-05B).

<div class="diagram" data-diagram-src="../etiquetas_rc.escaneo-alistamiento.diagram.html"><a href="../etiquetas_rc.escaneo-alistamiento.diagram.html">Abrir diagrama: escaneo en Alistamiento</a></div>

El filtro `purchase_line_id = False` es lo que distingue una etiqueta propia de Alistamiento de una de Recepción. Desde el arreglo multi-OT, las etiquetas de Recepción también llevan `requisition_item_id`: sin ese filtro, una etiqueta de Recepción todavía sin recibir podría consumirse por Alistamiento y la unidad real quedaría sin código al validar la compra.

### Inventario Cíclico

Tiene dos entradas al mismo mecanismo: el wizard guiado (`inventory.count.wizard`) y el botón directo sobre el árbol de `stock.quant`. Las dos llaman `InventarioSource.materialize()` en la misma transacción que crea la etiqueta: como el stock ya está en bodega, la unidad (`stock.lot.item` o `stock.reception.record`) se crea y la etiqueta queda `consumed` en el mismo paso. Es el único origen que consume **al generar**.

!!! warning "Inventario Cíclico puede crear un lote nuevo"
    Si el `stock.quant` contado no tiene `lot_id`, `rc_label_source.py::_resolve_lot` crea un `stock.lot` con un código de la secuencia `stock.lot.reception.rc`. Es la regla contraria a la de Alistamiento, que nunca crea un lote.

## Entrega

Al escanear en Entrega, `entrega_scan_unit` reconoce tres tipos de unidad. Las de Recepción (`stock.lot.item`, `stock.reception.record`) se reservan al move vigente con `reserved_move_id`. La etiqueta propia de Alistamiento usa el `move_id` fijado al confirmar, nunca el `move_id` de la línea de requisición, que se sobrescribe en cada confirmación. Como no se reserva, `entrega_unscan_unit` no tiene rama para ella: solo deshace reservas de las otras dos tablas.

Al validar el OUT, `stock_lot.py::_mark_lot_items_delivered` marca `is_delivered` con una lógica distinta por tabla:

| Tabla | Cómo empareja unidad y move |
|---|---|
| `stock.lot.item` | Primero las reservadas para ese move; el faltante por FIFO (`unit_sequence`) |
| `stock.reception.record` | Igual: reservadas primero, FIFO el resto |
| `stock.rc.label.pending` (`consumed`, sin entregar) | Busca por `requisition_item_id` del move. Con rastreo, empareja exacto por `tracking_lot_id`; sin rastreo, por cantidad (aproximación, según el propio comentario del código) |

## Reimpresión (REC-01)

Reimprimir no crea código nuevo. `purchase_order.py::action_open_rc_reprint_lines` exige el grupo `group_barcode_admin` en servidor (`AccessError` si falta), sin confiar en que el botón esté oculto. `stock_rc_label_pending.py::action_reprint_get_print_mode` solo suma 1 a `reprint_count`: no toca `state`, lote ni requisición, y el `barcode_value` es siempre el mismo.

## Riesgos conocidos

| Riesgo | Dónde | Detalle |
|---|---|---|
| Consumo sin escaneo en Recepción | `_consume_pending_labels` | Productos sin rastreo validados sin escanear consumen etiquetas `pending` por orden de creación (ver [Ciclo de vida](#ciclo-de-vida)). |
| Carrera en `mark_in_progress` | `stock_rc_label_pending.py` | Hace `search`, revisa el estado y escribe, sin bloqueo de fila. Dos escaneos casi simultáneos del mismo código desde dos pickings pueden pasar ambos. |
| Pertenencia solo en el cliente | `barcode_ui_patch.js` | `mark_in_progress` recibe solo código y picking; no revalida producto ni línea de OC. |
| Etiquetas `in_progress` huérfanas | `release_in_progress` | Solo se libera al salir de la pantalla antes de validar. `action_cancel` del picking libera reservas de `stock.reception.record`, pero no las etiquetas `in_progress`. |
| El chequeo de impresora no garantiza impresión | `browserprint_utils.js` | `hasBrowserPrintDevice` confirma que hay un dispositivo, no que el envío funcione. Parcialmente cerrado por `9d756afbc`: si `device.send()` falla (sin impresora, error de envío), `releaseUnprintedLabels` cancela la etiqueta creada. Sigue abierto el caso en que `send()` reporta éxito pero no sale papel físico (sin cinta/stock) — ahí la etiqueta queda `consumed`/`in_progress` sin haber impreso. |
| Lote nuevo en Inventario Cíclico | `rc_label_source.py::_resolve_lot` | Ver el aviso de [Inventario Cíclico](#inventario-ciclico). |
| `AlistamientoSource` sin conectar | `rc_label_source.py` | Clase registrada sin llamadores. Pendiente decidir si se conecta o se borra. |
| Emparejamiento de entrega sin filtro de origen | `_mark_lot_items_delivered` | La búsqueda de etiquetas no filtra `origen = 'alistamiento'`. Las etiquetas de Recepción consumidas también llevan `requisition_item_id` y podrían entrar como candidatas. No se verificó en base de datos. |
| Comentario desactualizado | `resolve_rc_scan` | El comentario dice "se consume al primer escaneo", pero el código escribe `in_progress`; el consumo real ocurre en `confirm_alistamiento`. |
