# custom_barcode_activos

44 commits de `digital18`, 2026-08-04 → 2026-09-29. Versión del manifest: `2.2`.

!!! note "Alcance de esta página"
    El historial cubre solo los 44 commits de `digital18`. En el mismo periodo `digital7` (mafe) hizo 17 commits sobre el módulo que no aparecen en las tablas. Algunos cambian piezas descritas aquí: `b8dadf914` (Gestión de Bodega en 4 menús con fases), `4d36da004` (persistir el número RC en servidor), `9c05203e3` (Inventario Cíclico como tercer origen de etiqueta RC y centralización de helpers en `rc_label_common.py`) y `4adaa5e58` (Crear factura silencioso en Recepción). La descripción funcional refleja el código actual de `changes_stock`, venga de quien venga.

## Visión general

Módulo de bodega sobre `stock_barcode` (Enterprise). Da una identidad física única (código RC) a cada unidad que entra por compra, o que ya está en bodega, y la sigue por cuatro dominios:

- Código único RC / etiquetas
- Recepción
- Alistamiento / Separación
- Entrega / Devolución

También arrastra funciones anteriores al periodo documentado: códigos de barras de activos fijos (`custom.activos.fijos`), canastillas, ubicaciones de estantería y cronograma de priorización de OT.

Depende de `stock_barcode`, `stock_barcode_mrp`, `purchase`, `custom_activos_fijos`, `custom_inventario`, `custom_requisiciones`, `custom_proyectos` y `custom_compras`. La dependencia de `stock_barcode_mrp` es deliberada: fija el orden de carga para que el `replace` del botón Validar de este módulo gane sobre el de mrp (comentario en `__manifest__.py`).

## Qué problema resuelve

- **Trazabilidad por unidad, no por cantidad.** Odoo nativo sabe cuántas unidades de un lote hay, no cuál caja física fue a qué OT. El módulo guarda una fila por unidad (`stock.lot.item` con lote/serial, `stock.reception.record` sin rastreo) con su código RC, su requisición y su entrega.
- **Recepción ligada a la requisición.** Una OC puede cubrir varias OT; el escaneo de recepción resuelve a qué OT/proyecto va cada unidad, incluso cuando una línea de compra la comparten varias requisiciones.
- **Separación guiada por demanda.** Alistamiento arma su propia cola a partir del estado de las líneas de requisición (`custom_requisiciones.material_electrico`), sin despacho manual previo, y crea los OUT de separación con el lote/serial y la ubicación exactos que escaneó el operario.
- **Entrega y devolución por escaneo.** El operario escanea el código de la unidad; el sistema resuelve la OT y el documento de salida sin que tenga que teclear el lote.
- **Impresión directa en Zebra.** Las etiquetas pequeñas salen en ZPL por Zebra Browser Print, sin PDF intermedio.

## Arquitectura / componentes principales

<div class="diagram" data-diagram-src="../custom_barcode_activos.diagram.html"><a href="../custom_barcode_activos.diagram.html">Abrir diagrama: ciclo de la etiqueta y la unidad RC</a></div>

| Capa | Componentes |
|---|---|
| Identidad RC | `stock.rc.label.pending` (etiqueta con código `[LSN]\d{5,}`), `rc_label_common.py` (regex, mapa tracking→letra, secuencias), `rc_label_source.py` (fábrica de orígenes: Recepción, Alistamiento, Inventario) |
| Unidades físicas | `stock.lot.item`, `stock.reception.record` y sus historiales; `stock.rc.anulado.log` para numeración liberada por devolución a proveedor |
| Recepción | patches OWL de `stock_barcode` (`barcode_ui_patch.js`, `reception_analytic_patch.js`, `line_component_patch.xml`), `reception.analytic.wizard`, lista de OC propia (`recepcion_oc_list.js`, `recepcion_toolbar.js`), extensiones de `purchase.order` |
| Alistamiento | `stock_alistamiento.py` (2.434 líneas, extiende `material_electrico`, `stock.picking`, `stock.move`), `alistamiento_scan.js` |
| Entrega / Devolución | `stock_entrega_scan.py`, `stock_devolucion_scan.py`, `entrega_devolucion.js`; hooks en `stock.picking.button_validate` (`stock_lot.py`) |
| Navegación | `recepcion.perfil`: pestañas "Fase N - …" por menú (Recepción, Alistamiento, Entrega, Devolución, Inventario cíclico) con grupos `group_gb_<operacion>_user/_admin` |
| Escaneo global | `controllers/main.py` (`/stock_barcode/scan_from_main_menu`): enruta el código a activo, canastilla, ubicación, OC, picking, unidad RC o producto |
| Impresión | reportes QWeb (PDF) + ZPL generado en servidor (`get_zpl_chica`) y enviado por `browserprint_utils.js` al SDK Zebra vendorizado en `static/src/lib/browserprint/` |

El módulo extiende `custom_requisiciones.material_electrico` por `_inherit` en tres archivos y nunca edita `custom_requisiciones`. El precio de esa regla es la duplicación de dominio y disponibilidad descrita en [D-012](#bugs-y-decisiones-relevantes).

## Procesos funcionales

### Recepción

Menú **Gestión de Bodega → Recepción**, pestañas Admin / Fase 1 - Pendiente / Fase 2 - Recepcionados / Fase 3 - Cancelados.

1. La lista de OC (`recepcion_oc_list.js`) abre por defecto en la semana vigente. El filtro es por `date_planned` de cada línea (`get_ids_recepcion_semana_actual`, `get_ids_recepcion_por_fecha`), no por el `date_planned` de la cabecera, que es el mínimo entre líneas. Las OC muestran estado Pendiente o Parcial (`rc_pending_reception`, `rc_recepcion_parcial`, campos stored).
2. Antes de recibir se generan las etiquetas RC desde la selección de OC: **Impr Etiquetas** (rollo 32×15 mm, ZPL) o **Imp Etiq 17x17**. Las etiquetas quedan en `stock.rc.label.pending` con estado `pending`. Si una línea ya no tiene pendiente (`qty_pendiente <= 0`), `rc.label.generator.wizard.action_open_lines` la excluye de la tabla del wizard; si TODAS quedan así, bloquea con `UserError` en vez de abrir un wizard vacío (`667d31da9`).
3. Escanear el código de OC (`OC.<name>`) o hacer clic en la fila abre la recepción pendiente (`action_open_reception_scan`). Si hay varias pendientes, muestra la lista en vez de adivinar.
4. En la vista de escaneo nativa parcheada, cada etiqueta RC escaneada pasa a `in_progress` atada al picking (`mark_in_progress`). Sobrevive a un F5 o a otro equipo: `get_inprogress_for_picking` rehidrata los chips de Identificación al abrir.
5. El input de Rastreo (serial/lote) solo aparece cuando la línea ya tiene `qty_done > 0` (`ctsRcGateOpen`). Si se teclea un código RC en ese campo, se descarta en vez de guardarse como `lot_name`.
6. Cuando un producto tiene varias OT pendientes, el wizard analítico (`reception.analytic.wizard`) reparte la cantidad por OT. La ambigüedad se decide por OT/analítica distinta real, filtrada por los filtros OT/Proyecto activos en pantalla.
7. Al validar, `_cts_check_rc_completeness` bloquea si en un producto con rastreo hay más unidades con lote capturado que etiquetas `in_progress` de ese picking. Luego `_action_done` consume etiquetas (primero las `in_progress` del mismo picking, después `pending` por id) y crea una unidad `stock.lot.item` o `stock.reception.record` por cada unidad recibida.
8. Si el operario sale con escaneos sin validar, un diálogo ofrece "Descartar y salir", que libera las etiquetas con `release_in_progress`.

Un administrador de bodega (`group_barcode_admin`) puede reimprimir etiquetas ya existentes de una OC (REC-01) sin gastar código nuevo; cada reimpresión suma `reprint_count`.

### Etiquetas CTS/RC

Hay dos familias:

- **Etiqueta CTS de producto** (`product.template`): identifica el producto, no la unidad. Wizard de tamaño `product.barcode.label.size.wizard`.
- **Etiqueta RC** (`stock.rc.label.pending`): identifica una unidad. Código `L`/`S`/`N` + 5 o más dígitos; la letra sigue el rastreo del producto al generarla y el código es único en base de datos.

Los tres orígenes de la etiqueta RC (Recepción, Alistamiento, Inventario Cíclico), su ciclo de estados, la impresión ZPL, la reimpresión (REC-01) y sus riesgos están en [Etiquetas RC](etiquetas_rc.md).

### Alistamiento

Menú **Gestión de Bodega → Alistamiento**, pestañas Admin / Fase 1 - Pendiente / Fase 2 - Separado.

1. **Cola derivada.** No hay botón "Enviar a Alistamiento". La cola sale de `_domain_gestion_pendiente` (aprobados, pendientes de separar físico o con reabastecimiento) y de la demanda `_demanda_gestion`:

    - reabastecimiento pendiente > 0 → esa cantidad tal cual;
    - si no → `aprobado − cantidad_enviada_a_separar − cantidad_enviada_a_comprar`;
    - rama Recepción (`source='recepcion'`) → `recepcionado − separado − entregado − cantidad_enviada_a_separar`.

    Las líneas con demanda > 0 entran solas: `write()` de `material_electrico` marca `enviado_alistamiento_recepcion`.

2. **Ventana por defecto.** Fase 1 muestra las líneas dentro de 3 días hábiles desde la aprobación, lunes a viernes, sin festivos. Si se aprobó después de las 11:00 (hora de Bogotá), el conteo arranca el siguiente día hábil, pero el día calendario de aprobación siempre cuenta. La píldora se puede apagar y convive con el rango manual de fechas.

3. **Vigencia.** Columna aparte junto a la ventana: `vigente`/`vencida` según la misma regla (`_en_ventana_alistamiento`), o vacía si la línea no tiene `fecha_aprobacion` — sin fecha no hay plazo que vencer (`stock_alistamiento.py`, `88af87c38`).

4. **Ubicación de separación.** Por línea se elige una sububicación dentro del árbol de la bodega (`source_location_id`). Es la selección vigente para las próximas etiquetas; las ya generadas conservan la suya.

5. **Etiquetas propias.** `alist.label.generator.wizard` imprime etiquetas RC ancladas a la línea de requisición. Congela en cada etiqueta la ubicación exacta (hoja, nunca la raíz si el stock vive en una hija) y el lote/serial real. Nunca imprime por encima del disponible libre de esa ubicación.

6. **Escaneo.** `resolve_rc_scan` busca primero en `stock.lot.item`/`stock.reception.record` (la unidad ya fue recibida por Recepción); si no aparece ahí, cae a `stock.rc.label.pending` exigiendo `purchase_line_id=False`. Valida pertenencia y marca `in_progress` en la misma llamada, a diferencia de Recepción que lo hace en dos pasos. `preview_alistamiento` muestra el resultado antes de confirmar.

    - Riesgo: sin ese filtro, una etiqueta de Recepción todavía sin recibir podría colarse por esta rama — una misma `requisition_item_id` puede tenerla poblada por una POL compartida entre varias OT (caso `bb8001012`) — y quedar consumida sin código para cuando de verdad se reciba.

7. **Confirmar** (`confirm_alistamiento`):

    - *Pase 1*: valida todo antes de crear nada: ubicación dentro de la bodega, un lote/serial real por unidad en productos con rastreo y disponible libre en la ubicación congelada. Si el stock cambió, bloquea; no reasigna.
    - *Pase 2*: crea o reutiliza un OUT en borrador por (bodega, requisición/origen, ubicación). Un OUT nunca mezcla dos ubicaciones. Crea un move por spec y lo reserva con el lote/serial escaneado. Ancla cada unidad al move (`alistamiento_move_id`) y pasa las etiquetas a `consumed` con su `move_id`.
    - Confirma y reserva los OUT. Si algún move de esta confirmación no reservó exacto, aborta todo con `UserError` (ALI-05B). Al final marca `separado_en_fisico=True`, lo que refleja `separado` en la requisición.

8. **Comprar restante** (ALI-05). Si falta stock, el operario decide por línea: mantener pendiente o solicitar compra del restante. `_solicitar_compra_desde_alistamiento` acumula en `cantidad_enviada_a_comprar` y avisa a los responsables de compra de la bodega (actividad + chat de Discuss).

    - Decisión con 2 botones toggle (`btn-group-vertical`) en vez de radios — mismo `setDecision`/`isComprarRestante`, sin cambio de comportamiento (`6af770be9`).

### Entrega/Devolución

Pantalla única `entrega_devolucion.js`, con menús y pestañas separados:

- **Entrega**: Admin / Por entregar / Entregado / Cancelado.
- **Devolución**: Admin / Borrador / Preparado / Validado.

**Entrega**

1. Carga OUT con `separado_en_fisico=True`, filtrados por fase. Las fases terminales se acotan por defecto a los últimos 90 días de `create_date`; un rango de calendario explícito reemplaza ese tope. Toda fase de **Entrega** pagina en servidor (`search_count` + `limit/offset` sobre `get_entrega_devolucion_data`, no solo `fase='admin'` desde `a495121a4`); **Devolución** sigue trayendo todo en un solo RPC y pagina en el cliente.
2. `entrega_scan_unit` resuelve el código escaneado en este orden: `stock.lot.item` no entregado → `stock.reception.record` no entregado → etiqueta propia de Alistamiento `consumed` no entregada.
    - Unidad de recepción: la reserva (`reserved_move_id`) al `material.move_id` vigente. Rechaza si ya está reservada en otro documento.
    - Etiqueta de Alistamiento: usa el `move_id` fijado al confirmar, nunca el de la línea. A diferencia de las otras dos, nunca se "reserva" al escanear — nació ligada a ese `move_id` único desde que `confirm_alistamiento` la consumió, sin ambigüedad que resolver. Por eso `entrega_unscan_unit` no tiene rama para deshacerla: no hay reserva que deshacer.
3. `entrega_dev_prepare` aplica cantidades y lotes, y guarda una firma por creador del picking (`firma_responsable`).
4. Antes de validar, `_ensure_requisicion_validada` ejecuta sola el candado de `custom_requisiciones` (Separar/Validar Requisición). El backorder se resuelve con el wizard nativo.
5. Al validar el OUT, `_mark_lot_items_delivered` marca entregadas primero las unidades reservadas para ese move y completa por FIFO solo el faltante. Las etiquetas de Alistamiento se emparejan por `tracking_lot_id`, o por cantidad si no hay rastreo.

**Devolución**

1. `devolucion_scan_unit` resuelve una unidad **ya entregada** (`stock.reception.record` o `stock.lot.item`). La agrega a un IN en borrador marcado `x_devolucion_scan`, agrupado por requisición, y lo confirma.
2. Al validar, `_process_rc_returns` desmarca `is_delivered`, limpia los datos de entrega y escribe historial `returned`.

Una devolución a proveedor (OUT que devuelve un IN de compra) borra las unidades RC del IN original y deja registro en `stock.rc.anulado.log`, lo que libera la numeración.

## Evolución del módulo

### 1. Escaneo de Recepción — puesta en marcha (04-ago-2026)

Un solo día de trabajo sobre la vista de escaneo nativa. Se agregó el salto por código de OC y las columnas Comprado/Recepcionado, que se leen del ítem de requisición porque `qty_received` no es confiable a media operación. El wizard analítico empezó a decidir la ambigüedad de OT por analítica real y no por conteo de movimientos. Los menús de bodega pasaron de Requisiciones a Inventario.

??? abstract "Commits y archivos del capítulo (8 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `a182ac982` | 2026-08-04 | Escanear el código de OC salta a su recepción pendiente. |
    | `67f781b24` | 2026-08-04 | Columnas Comprado/Recepcionado y agrupación por Producto en escaneo. |
    | `8efc4d1ef` | 2026-08-04 | Resuelve la ambigüedad de OT en el wizard analítico según los filtros activos. |
    | `74e86b11f` | 2026-08-04 | Mueve los menús de bodega de Requisiciones a Inventario. |
    | `d5ad2b300` | 2026-08-04 | Menú Recepción en Inventario, reusando el lector. |
    | `4dbdf92f9` | 2026-08-04 | Evita expulsar del filtro el grupo desplegado durante la captura. |
    | `bf26e15ae` | 2026-08-04 | Unifica la etiqueta de producto entre fila, sección y dropdown. |
    | `7d42b1e5d` | 2026-08-04 | Resuelve la línea exacta al escanear con filtro OT/Proyecto activo. |

    **Archivos:** `controllers/main.py`, `static/src/js/patches/barcode_ui_patch.js` (+xml), `static/src/xml/patches/line_component_patch.xml`, `static/src/scss/barcode_theme.scss`, `models/stock_move_line.py`, `models/stock_picking_type.py`, `views/stock_picking_type_views.xml`, `views/actions.xml`, `views/menus.xml`, `static/src/js/inventario_barcode_menu.js` (+xml), `static/src/js/patches/reception_analytic_patch.js`, `wizard/reception_analytic_wizard.py`

### 2. Sistema de etiquetas CTS/RC e impresión ZPL (18-ago → 24-sep)

Primero se calibraron tres tamaños de PDF. El 28 de agosto cambió el modelo: las etiquetas RC se imprimen **una vez, antes de recibir**, y se consumen al validar; ya no se generan al vuelo. El 15 de septiembre llegó la impresión ZPL directa por Browser Print. Esa ruta se eligió porque el servidor corre en AWS y no alcanza la LAN de la bodega (ver `zebra-zd421-zpl-implementacion.md`). Al final se sumaron las etiquetas propias de Alistamiento, la reimpresión y el chequeo de impresora.

??? abstract "Commits y archivos del capítulo (12 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `69032247b` | 2026-08-18 | Selector de tamaño/diseño para etiquetas CTS y RC (32×15 / 60×30 / 70×40 mm). |
    | `4dea7e809` | 2026-08-20 | La impresión RC al validar usaba los defaults del template; se fuerza `chica` + `con_ot`. |
    | `4e551d09d` | 2026-08-28 | Etiquetas RC generadas antes de recibir (`stock.rc.label.pending`, código persistido) y consumo FIFO al validar. |
    | `3ae2c8d2a` | 2026-08-31 | Reconecta el wizard de tamaño de la Etiqueta CTS de producto. |
    | `3367002a3` | 2026-08-31 | Reactiva el botón "RC (elegir diseño)" en el formulario del picking. |
    | `2aa0416e0` | 2026-08-31 | Quita el botón obsoleto de Etiquetas RC en Recepción. |
    | `5b397bf90` | 2026-09-02 | Botón "Imp Etiq 17x17" en Recepción. |
    | `438703aa0` | 2026-09-11 | Wizard de etiqueta de línea para Alistamiento. |
    | `7a73ffce0` | 2026-09-15 | ZPL directo a Zebra vía Browser Print; corrige 3 etiquetas que salían en 3 filas. |
    | `dca126d6d` | 2026-09-19 | Etiquetas de Alistamiento con ubicación y lote/serial real congelados. |
    | `e06eaa0f2` | 2026-09-21 | Reimpresión de etiquetas RC existentes (REC-01), con control de grupo en servidor. |
    | `8cec91587` | 2026-09-24 | Contador `reprint_count` y chequeo de impresora antes de consumir etiqueta. |

    **Archivos:** `models/product_template.py`, `models/stock_lot.py`, `models/stock_rc_label_pending.py` (nuevo), `models/purchase_order.py`, `models/stock_move_line_lot.py`, `data/rc_label_sequences.xml`, `migrations/2.2/post-migrate.py`, `wizard/product_barcode_label_size_wizard.py`, `wizard/rc_label_mode_wizard.py`, `wizard/rc_label_generator_wizard.py`, `wizard/alist_label_generator_wizard.py`, `reports/report_product_labels.xml`, `reports/report_rc_labels_combined.xml`, `reports/report_canastilla_labels.xml`, `reports/report_ubicacion_labels.xml`, `reports/report_rc_label_pending.xml`, `static/src/js/rc_label_lines_list.js`, `rc_reprint_lines_list.js`, `alist_label_lines_list.js`, `browserprint_utils.js`, `static/src/lib/browserprint/BrowserPrint*.js`, `docs/zebra_zpl_poc.md`, `controllers/main.py`

### 3. Alistamiento — cola, separación/compra y reserva de stock (03-sep → 24-sep)

El 11 de septiembre Alistamiento dejó de depender del despacho manual desde Solicitudes de Bodega: ese tablero nunca sumaba `cantidad_enviada_a_separar` ni creaba OUT, y se retiró. El 19 de septiembre `confirm_alistamiento` se reescribió en dos pases (validar todo, luego crear). Con eso llegaron la reserva nativa exacta y el ancla por move. El 24 de septiembre se cerró el fallo silencioso de reserva y la doble reserva con el auto-assign.

??? abstract "Commits y archivos del capítulo (10 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `12875bfd0` | 2026-09-03 | Bug: el OUT de Alistamiento quedaba con `separacion_confirmada=False` y el `write()` de `custom_requisiciones` bloqueaba cualquier cambio posterior. |
    | `7440f2e35` | 2026-09-11 | Cola derivada de la demanda; retira Solicitudes de Bodega y su wizard de reabastecimiento; `_reflejar_separacion_move` idempotente por move. |
    | `bb8001012` | 2026-09-15 | Resuelve la OT real cuando una línea de compra la comparten varias requisiciones (caso OC26-03739). |
    | `5cf436141` | 2026-09-15 | Renombra pestañas: "Por alistar" → "Pendiente", "Alistado" → "Separado". |
    | `79a6d8706` | 2026-09-19 | Ubicación de separación por línea; `confirm_alistamiento` en dos pases con reserva nativa exacta (+ test). |
    | `96a950a4a` | 2026-09-21 | Comprar el restante no separado al confirmar (ALI-05) (+ test). |
    | `477ef4035` | 2026-09-21 | Ventana por defecto de 3 días hábiles desde la aprobación. |
    | `968799687` | 2026-09-24 | Hidrata Proyecto/OT/Requisición de `stock.move.line` en batch (perf). |
    | `6b26f79fa` | 2026-09-24 | ALI-05B reserva estricta, cola más liviana, calendario extraído; **borra los dos archivos de test** agregados días antes. |
    | `a8a2acdd5` | 2026-09-24 | Bug: doble reserva entre `confirm_alistamiento` y el auto-assign de `stock_move_rc`. |

    **Archivos:** `models/stock_alistamiento.py`, `models/stock_move_rc.py`, `models/stock_lot_item.py`, `models/stock_reception_record.py`, `models/recepcion_perfil.py`, `data/recepcion_perfil_data.xml`, `static/src/js/alistamiento_scan.js` (+xml+scss), `static/src/js/cts_date_range_calendar.js` (+xml+scss), `static/src/js/solicitudes_bodega.js`, `views/alistamiento_views.xml`, `views/menus.xml`, `views/actions.xml`

??? warning "Riesgo — acoplamiento por bypass privado (`12875bfd0`)"
    El guard de `custom_requisiciones/models/stock_picking.py` (`write()`, líneas 23-34) aplica solo a pickings con `requisition_id`, es decir, a los OUT de la rama Recepción. En ellos, si `separado_en_fisico=True`, hay moves y `separacion_confirmada=False`, cualquier `write()` posterior falla. Alistamiento no pasa por `action_separar_requisicion`: sale del bloqueo escribiendo `separacion_confirmada=True` con el flag de contexto `bypass_separacion_validacion`, que además salta toda la lógica de distribución de ese `write()`. Funciona, pero cualquier flujo nuevo que cree pickings fuera de la vía nativa necesita el mismo bypass (bitácora D-003). No se midió cuántos pickings quedaron bloqueados antes del fix.

??? warning "Riesgo — cobertura de test eliminada (`6b26f79fa`)"
    `79a6d8706` y `96a950a4a` agregaron `tests/test_confirm_alistamiento_recepcion.py` (291 líneas) y `tests/test_ali05_separar_comprar.py` (159 líneas). `6b26f79fa`, 3 y 5 días después, borró ambos junto con `tests/__init__.py`. El mensaje del commit lo declara: "no se van a mantener en este repositorio". La cobertura no se repuso por otra vía: hoy el módulo no tiene carpeta `tests/`. La reserva estricta ALI-05B y la compra del restante quedan protegidas solo por `UserError` en servidor y prueba manual.

??? warning "Riesgo — doble reserva entre dos rutas (`a8a2acdd5`)"
    `stock.move.create()` (`stock_move_rc.py`) llama a `_try_assign_rc_lot`, que reserva lotes por FIFO en cualquier move saliente con `origin` `REQ-<req>-ITEM-<item>`. `confirm_alistamiento` crea su move con ese mismo formato y después reserva el lote/serial escaneado. El auto-assign llegaba primero, dejaba 0 libre y la reserva explícita fallaba con "el serial ya no tiene stock disponible" aunque el quant estuviera libre. `6b26f79fa` pasó `skip_rc_auto_assign=True` al crear el move, pero el guard que lee ese flag llegó en `a8a2acdd5`, el mismo día. Entre los dos commits el flag no tenía efecto. Otra ruta que cree moves con ese `origin` sin el flag vuelve a exponer el problema.

### 4. Entrega y Devolución por escaneo (15-sep → 24-sep)

La entrega pasó de "escanear producto y teclear lote" a escanear el código de la unidad, que ya trae su OT desde la recepción. Reservar la unidad al move (`reserved_move_id`) evita que dos OT del mismo lote físico se crucen por FIFO. Después se reconocieron las etiquetas propias de Alistamiento y se automatizó el candado de validación de requisición.

??? abstract "Commits y archivos del capítulo (6 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `c8f31bae9` | 2026-09-15 | Entrega en vivo por escaneo de numeración única (`stock_entrega_scan.py`). |
    | `e119c935d` | 2026-09-15 | El foco salta a Rastreo solo en serial; corrige doble conteo al capturar lote. |
    | `2a3df282a` | 2026-09-15 | Serial/Lote de Alistamiento usa `CtsChipsCell`; altura de fila igual a la nativa. |
    | `68368f4ea` | 2026-09-15 | Reconoce RC en Entrega, automatiza Separar/Validar Requisición, tope de 90 días en fases terminales. |
    | `71bf4e1ed` | 2026-09-19 | Reconoce etiquetas de Alistamiento en Entrega y muestra el avance de la requisición. |
    | `8a967a540` | 2026-09-24 | Bug: fase vacía cargaba todo sin tope; `admin` explícito y paginación en servidor. |

    **Archivos:** `models/stock_entrega_scan.py` (nuevo), `models/stock_lot.py`, `models/stock_lot_item.py`, `models/stock_alistamiento.py`, `static/src/js/entrega_devolucion.js` (+xml), `models/recepcion_perfil.py`, `data/recepcion_perfil_data.xml`

??? warning "Bug corregido — carga completa por condición de carrera (`8a967a540`)"
    En `get_entrega_devolucion_data`, con `tipo='entrega'`, una `fase` vacía no entraba en ningún `if/elif` y el dominio quedaba sin filtro de estado. El fallback de `onMounted` en `entrega_devolucion.js` podía ganarle al RPC asíncrono de `RecepcionPerfilTabs` que fija la fase, y disparaba esa carga: medido, 40k+ líneas / 38,7 MB contra ~2,5k líneas / 2,6 MB de `por_entregar`. Ahora solo `fase='admin'` trae todo, y paginado en servidor.

### 5. Recepción — refinamiento de lista, filtros y rendimiento (19-sep → 24-sep)

??? abstract "Commits y archivos del capítulo (3 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `22bd1fef5` | 2026-09-19 | Fase Pendiente acotada a la semana vigente, estado Parcial, aviso al salir con escaneos sin validar. |
    | `2b20b8545` | 2026-09-21 | Bug: Fecha límite comparaba contra el `date_planned` mínimo de la OC; ahora busca por línea. |
    | `a217da06d` | 2026-09-24 | Píldoras Comprador/Requisición/Producto con `read_group` directo (caso real 39 MB / 21 s); carga perezosa; `limit=40`. |

    **Archivos:** `models/purchase_order.py`, `static/src/js/patches/barcode_ui_patch.js`, `recepcion_oc_list.js` (+xml), `recepcion_toolbar.js`, `static/src/scss/barcode_theme.scss`, `wizard/rc_label_generator_wizard.py`, `inventory_count_list.js`, `rc_tags_field.js`, `views/purchase_order_recepcion_views.xml`

### 6. Cierre de periodo — ajustes puntuales (28-sep → 29-sep)

Cinco commits sin un tema único: extienden la paginación de Entrega a todas las fases, agregan una salida de emergencia para etiquetas RC cuyo ZPL no imprimió, suman una columna de vigencia en la cola de Alistamiento, bloquean generar etiquetas cuando ya no queda pendiente en Recepción, y cambian de radios a botones la decisión ALI-05. El único con riesgo real es `9d756afbc`: reactiva `cancelled` como estado alcanzable (ver [Etiquetas RC](etiquetas_rc.md#ciclo-de-vida)).

??? abstract "Commits y archivos del capítulo (5 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `a495121a4` | 2026-09-28 | Paginación server-side de Entrega en todas las fases de `tipo='entrega'`, no solo `admin`. |
    | `9d756afbc` | 2026-09-29 | Libera (cancela) etiquetas RC recién creadas si el ZPL no llega a imprimir. |
    | `88af87c38` | 2026-09-29 | Columna Vigencia (vigente/vencida) en la cola de Alistamiento. |
    | `667d31da9` | 2026-09-29 | Bloquea "Generar Etiquetas" en Recepción cuando ya no queda pendiente. |
    | `6af770be9` | 2026-09-29 | ALI-05: botones Mantener/Comprar en vez de radios (solo markup/CSS). |

    **Archivos:** `static/src/js/entrega_devolucion.js`, `models/stock_rc_label_pending.py`, `static/src/js/browserprint_utils.js`, `static/src/js/alist_label_lines_list.js`, `static/src/js/rc_label_lines_list.js`, `wizard/alist_label_generator_wizard.py`, `wizard/rc_label_generator_wizard.py`, `models/stock_alistamiento.py`, `static/src/js/alistamiento_scan.js`, `static/src/scss/alistamiento_scan.scss`, `static/src/xml/alistamiento_scan.xml`

`a495121a4` acepta un trade-off explícito: paginar por `create_date desc` de los documentos de separación puede partir en dos páginas una OT cuyos documentos abarcan fechas muy distintas — a cambio de no volver a cargar nunca más el histórico completo en ninguna fase de Entrega (antes solo `admin` estaba protegido; las demás fases arriesgaban el mismo problema que `8a967a540` cerró para `admin`, solo que todavía no habían corrido la misma carrera). El backend no cambió: el mecanismo `page`/`page_size` ya era genérico.

## Modelos principales

**Modelos propios**

| Modelo | Representa | Campos clave |
|---|---|---|
| `stock.rc.label.pending` | Etiqueta RC impresa, antes y después de ligarse a una unidad | `barcode_value` (único), `label_type` (L/S/N), `origen`, `state`, `purchase_line_id`, `requisition_item_id`, `source_location_id`, `tracking_lot_id`, `move_id`, `picking_id`, `consumed_lot_item_id`, `consumed_reception_record_id`, `is_delivered`, `reprint_count` |
| `stock.lot.item` | Unidad física dentro de un lote/serial | `lot_id`, `unit_sequence`, `barcode_value`, `requisition_id`, `purchase_value`, `is_delivered`, `delivery_*`, `reserved_move_id`, `alistamiento_move_id`, `origen` |
| `stock.reception.record` | Unidad física de producto sin rastreo | `product_id`, `unit_sequence`, `barcode_value`, `requisition_id`, `current_location_id`, `is_delivered`, `delivery_*`, `delivery_scanned`, `reserved_move_id`, `alistamiento_move_id` |
| `stock.lot.item.history` / `stock.reception.record.history` | Historial de requisiciones por unidad | `requisition_id`, `analytic_name`, `picking_id`, `state` (incl. `delivered`, `returned`) |
| `stock.rc.anulado.log` | Numeración RC liberada por devolución a proveedor | `unit_code`, `barcode_value`, `product_id`, `picking_in_id`, `picking_return_id` |
| `recepcion.perfil` | Pestaña/fase de un menú de Gestión de Bodega | `operacion`, `fase`, `group_id`, `user_ids` |
| `stock.canastilla` / `stock.canastilla.stage` / `stock.canastilla.relacion` | Canastilla de alistamiento y su relación con Proyecto/OT/Requisición | `state` (`vacia`/`llena`), `relacion_ids` |
| `ubicacion.bodega` / `product.ubicacion.line` | Estante/repisa/puesto de canastilla; ubicación de producto por bodega | — (no revisado en detalle) |
| `cronograma.ot` | Priorización de OT para el dashboard de bodega | — (no revisado en detalle) |
| `barcode.operation` / `barcode.operations.mixin` | Operaciones por código de barras sobre activos fijos | `code` (único) |

**Extensiones de modelos existentes**

| Modelo extendido | Qué agrega |
|---|---|
| `custom_requisiciones.material_electrico` | `estado_alistamiento` (informativo: pendiente/alistado/devuelto), `enviado_alistamiento_recepcion`, `source_location_id`; cola, escaneo, `confirm_alistamiento`, servicios de Entrega/Devolución |
| `stock.picking` | `enviado_desde_alistamiento`, `canastilla_id`, `x_devolucion_scan`; hooks en `button_validate`, `write`, `action_cancel` |
| `stock.move` | `separacion_reflejada` (guardián por move); auto-assign de lote RC en `create()` |
| `stock.move.line` | 11 campos analíticos no stored (OT, proyecto, sede, requisición, comprado/recepcionado) + `get_analytic_batch_data`; creación de unidades RC en `_action_done` |
| `stock.lot` | `rc_code`, `supplier_lot_name`, `requisition_id`, `purchase_value` |
| `purchase.order` / `purchase.order.line` | `rc_pending_reception`, `rc_recepcion_parcial` (stored); cantidades, analíticas, recepciones y facturas totalizadas (no stored) para la lista de Recepción |
| `stock.picking.type` | `barcode_group_by_ot/project/product/document` |
| `product.template` | Etiqueta CTS, ZPL en lote, conteo de unidades RC |

## Wizards / vistas / JS relevantes

**Wizards**

| Wizard | Uso |
|---|---|
| `rc.label.generator.wizard` (+ `.line`) | Genera etiquetas RC de una OC antes de recibir. `qty_to_generate` limitado a `qty_pendiente`. |
| `alist.label.generator.wizard` (+ `.line`) | Etiquetas propias de Alistamiento por línea de requisición, con ubicación y lote/serial congelados. |
| `inventory.count.wizard` (+ `.line`) | Inventario cíclico: contar y etiquetar unidades ya en bodega. |
| `reception.analytic.wizard` (+ `.line`) | Reparte la cantidad recibida entre OT cuando el producto tiene varias pendientes. |
| `product.barcode.label.size.wizard` | Tamaño de la Etiqueta CTS de producto. |
| `stock.picking.rc.label.mode.wizard` | Diseño de Etiquetas RC agrupadas desde el picking. |
| `wizard.rc.delivery` (+ `.line`) | Selección de unidades RC para un move de entrega (ruta de formulario). |
| `custom_requisiciones.alistar_comprar_wizard` | Reparte lo aprobado entre alistar y comprar; la suma debe ser exacta. |
| `wizard.lot.rc.scan`, `wizard.producto.scan.options`, `wizard.activo.scan.options`, `wizard.canastilla.scan` | Consultas abiertas desde el escaneo global. |

**JS / OWL**

| Archivo | Rol |
|---|---|
| `patches/barcode_ui_patch.js` | Patch principal de `stock_barcode`: agrupación por OT/proyecto/producto, escaneo RC en vivo (`ctsRcScanState`), gate de Rastreo, aviso al salir, rehidratación. Reimplementa `BarcodeModel.validate()` sin `super()`. |
| `patches/reception_analytic_patch.js` | Distribución analítica y validación RC en pickings de salida. |
| `recepcion_oc_list.js`, `recepcion_toolbar.js` | Lista de OC de Recepción, píldoras de filtro, impresión y reimpresión desde la selección. |
| `alistamiento_scan.js` | Pantalla de Alistamiento: fases, ubicación, escaneo, preview, confirmación. |
| `entrega_devolucion.js` | Pantalla de Entrega/Devolución: escaneo, firmas, validación, backorder. |
| `recepcion_perfil_tabs.js`, `recepcion_perfil_state.js` | Pestañas "Fase N" según `recepcion.perfil`. |
| `cts_date_range_calendar.js` | Calendario de rango compartido (extraído de Alistamiento, adoptado por Recepción y Entrega). |
| `rc_label_lines_list.js`, `alist_label_lines_list.js`, `rc_reprint_lines_list.js`, `browserprint_utils.js` | Impresión en dos pasos: el servidor crea y devuelve datos planos; el cliente manda ZPL o abre PDF. |

## Reglas de negocio

Validaciones que hoy existen en servidor:

| Regla | Dónde | Efecto |
|---|---|---|
| Código RC único | `stock.rc.label.pending._sql_constraints` | `unique(barcode_value)` en BD. |
| Ancla obligatoria y coherente | `stock.rc.label.pending._check_anchor` (`@api.constrains`) | Recepción/Alistamiento exigen `purchase_line_id` o `requisition_item_id`; si trae ambos, la OT de la requisición debe coincidir con la analítica de la línea de compra. Inventario exige ubicación. |
| No reutilizar etiqueta | `mark_in_progress` | Rechaza `consumed`, `cancelled` o `in_progress` en otro picking. |
| Completitud RC al validar recepción | `stock.picking._cts_check_rc_completeness` | En productos con rastreo, bloquea si hay más unidades con lote capturado que etiquetas `in_progress` de ese picking. Antes pone en 0 las líneas reservadas sin lote. |
| Tope de etiquetas | `_check_qty_to_generate` en ambos wizards | No negativas, no más que `qty_pendiente`; en serial cuenta `serial_ids`. |
| Lote del producto | `alist.label.generator.wizard._check_lote_pertenece_producto` | Rechaza un lote/serial de otro producto. |
| Disponible real al imprimir | `_ubicaciones_reales_sin_tracking` / `_ubicacion_exacta_lote` | No imprime más etiquetas que el disponible libre en la ubicación; no congela la raíz si el stock vive en una hija. |
| Validación previa en `confirm_alistamiento` | Pase 1 | Ubicación dentro de la bodega; un lote/serial real por unidad rastreada (nunca lo crea); disponible libre suficiente en la ubicación congelada. La rama Recepción no valida disponible. |
| Reserva exacta | `confirm_alistamiento`, ALI-05B | `UserError` si un move de la confirmación no reservó completo. |
| Bloqueo de separar/comprar durante alistamiento | `_bloquear_si_no_devuelto` | Con `estado_alistamiento` en `pendiente`/`alistado`, rechaza Solicitar compra y las cuatro variantes de Enviar a Separar. |
| Alistar/Comprar exacto | `alistar_comprar_wizard._check_cantidad_total` | `cantidad_alistar + cantidad_comprar` = `aprobado`. |
| Una unidad, un documento | `_entrega_scan_unit_impl` | Rechaza una unidad reservada en otro move; exige un move vigente (no done/cancel). |
| Devolución solo de lo entregado | `_devolucion_scan_unit_impl` | Exige `is_delivered` y requisición de entrega; rechaza si ya está en otro borrador de devolución. |
| Reimpresión solo para admin | `purchase.order.action_open_rc_reprint_lines` | `AccessError` sin `group_barcode_admin`. |

Efectos automáticos:

- `material_electrico.write()` marca `enviado_alistamiento_recepcion` cuando la línea queda en `solicitud_compra` + `compra_confirmada` con demanda pendiente.
- `stock.picking.write()`: la transición a `separado_en_fisico=True` en un OUT de Alistamiento suma `separado` por move y fija `separacion_confirmada`.
- `stock.move.create()`: auto-assign FIFO de lote RC para `origin` `REQ-x-ITEM-y`, salvo con `skip_rc_auto_assign`.
- `button_validate` del OUT: marca unidades entregadas; en devolución a proveedor borra unidades y registra la anulación; en IN de devolución restaura unidades.
- `action_cancel` del picking: libera `reserved_move_id` y `delivery_scanned` de `stock.reception.record`.
- `recepcion.perfil` `create`/`write`: da el grupo `_user` del menú a los usuarios asignados; no se lo quita al sacarlos.

## Bugs y decisiones relevantes

**Corregidos en el periodo**

| Tema | Causa raíz | Commit |
|---|---|---|
| OUT de Alistamiento bloqueado para siempre | `separacion_confirmada` nunca pasaba a True; el guard de `custom_requisiciones` rechazaba todo `write()`. | `12875bfd0` |
| `separado` se quedaba corto en rondas parciales (D-004) | El guardián era el estado global de la línea; la segunda ronda hacía early-return. Ahora es `separacion_reflejada` por move. | `7440f2e35` |
| OT cruzada en POL compartida (OC26-03739) | El `purchase_line_id` guardado en `material_electrico` podía estar mal enlazado; dos requisiciones heredaban el mismo req. Ahora se valida contra la analítica real y queda protegido por `_check_anchor`. | `bb8001012` |
| Doble reserva en rama Recepción (ALI-04B) | `MoveLine.create()` manual con `quantity` no sincroniza `reserved_quantity`; `_action_assign` volvía a reservar la demanda completa. Ahora se usa `_update_reserved_quantity(strict=True)`. | `79a6d8706` |
| Fallo silencioso al reservar el OUT | `action_confirm`/`action_assign` corrían en `try/except` que solo logueaba; la UI decía "Alistamiento confirmado". | `6b26f79fa` |
| Doble reserva con auto-assign | Ver callout del capítulo 3. | `6b26f79fa` + `a8a2acdd5` |
| Fecha límite ocultaba OC vigentes | Se comparaba el `date_planned` de cabecera (mínimo entre líneas). | `2b20b8545` |
| Unidades ya entregadas sin Identificación en Entrega | `stock.lot.item` solo traía las reservadas pendientes, no las entregadas. | `68368f4ea` |
| Carga completa en Entrega | Ver callout del capítulo 4. | `8a967a540` |
| Payload de Recepción de 39 MB | `read_group` con `order_id in [~2200 ids]` repite el dominio en cada grupo. | `a217da06d` |
| Etiqueta gastada sin papel | El paso ZPL crea la etiqueta antes de enviar; sin impresora quedaba consumida. | `8cec91587` |
| Generar etiquetas sobre una OC ya completa | El wizard no filtraba `qty_pendiente <= 0`; abría una tabla sin filas útiles en vez de avisar. | `667d31da9` |
| Etiqueta descontada si el ZPL no llega a imprimir (parcial) | `hasBrowserPrintDevice` solo confirmaba el dispositivo, no el envío; `action_release_unprinted` cancela la etiqueta cuando `sendZplViaBrowserPrint` falla. Ver caveat abajo (caso "sin papel pero `send()` responde éxito" sigue abierto). | `9d756afbc` |

**Decisiones**

- **Imprimir antes de recibir** (`4e551d09d`): si faltan etiquetas al validar, la unidad queda con `barcode_value=False` y se avisa en el picking. No se inventa un código.
- **La letra sigue al tracking, no al origen**: se descartó un prefijo `A` propio de Alistamiento (bitácora P-005, 2026-09-11).
- **Ventana lunes-viernes fija**: el `resource.calendar` de la compañía marca el sábado como hábil y no tiene festivos (comentario en `_sig_dia_habil`).
- **Dominio duplicado en barcode (D-012)**: `_domain_gestion_pendiente` y `_disponible_alistamiento` copian lógica de `custom_requisiciones/models/requisition.py` para no tocar ese módulo. Si uno cambia, las dos pantallas divergen sin aviso.
- **Browser Print y no socket TCP**: el servidor está en AWS, sin ruta a la IP privada de la impresora.

**Abiertos, verificados contra el código actual**

!!! warning "Sin tests automatizados"
    No existe `tests/` en el módulo (ver capítulo 3). El discovery del 2026-09-03 ya lo marcaba como el mayor riesgo transversal.

!!! warning "`apply_operation` sin control de grupo ni compañía"
    `/activo_barcode/apply_operation` (`controllers/main.py`) hace `sudo().browse(activo_id)` y ejecuta la operación con solo `auth='user'`. Eso incluye dar de baja un activo fijo. Clasificado CRÍTICO en `CUSTOM_BARCODE_ACTIVOS_REFACTOR_DISCOVERY.md`; sigue igual.

??? warning "Entrega: move marcado `picked` sin líneas"
    En `entrega_dev_prepare`, rama `tracking == 'lot'`, `move.picked = True` está fuera del `if lot:`. Si el lote escaneado no existe, el move queda `picked` sin `move.line`. En la rama serial, un serial inexistente se salta con `continue`. Detectado por el discovery; sigue igual.

- **`resolve_for_scan` expone datos de OC**: usa `sudo()` y devuelve `purchase_order_name`/producto a cualquier usuario autenticado que llame el método por RPC (`2026-09-02-bugs-identificacion-rc-recepcion.md`, punto 8).
- **Carrera en `mark_in_progress`**: hace `search` → chequeo de `state` → `write` sin bloqueo de fila. Dos escaneos casi simultáneos del mismo código desde dos pickings pueden pasar ambos.
- **Emparejamiento código↔unidad en Recepción**: `_consume_pending_labels` ya prioriza las etiquetas `in_progress` del picking, pero dentro de una misma línea de OC el orden sigue siendo por id, no por unidad física. Para productos **sin rastreo**, `_cts_check_rc_completeness` no aplica: validar sin escanear consume etiquetas `pending` por FIFO.
- **Devolución no reconoce etiquetas propias de Alistamiento**: `_devolucion_resolve_unit` busca solo en `stock.reception.record` y `stock.lot.item`. Entrega sí marca `is_delivered` en `stock.rc.label.pending` (`71bf4e1ed`), pero ese código no se puede devolver por escaneo. Relacionado con P-005: esas etiquetas no crean unidad ni historial.
- **Backorder de recepción que suma en vez de restar** (OC26-03661, `2026-08-28-bug-backorder-recepcion-suma-en-vez-de-restar.md`): 14 pedidas, recibidas 1 y 2, el backorder quedó en 13 con 15 cargadas. Sin causa raíz: no se reprodujo por `odoo shell`; la sospecha apunta al flujo JS del wizard analítico.
- **Pertenencia solo en cliente (Recepción)**: `barcode_ui_patch.js` filtra que la etiqueta escaneada sea del mismo producto/línea *antes* de llamar `mark_in_progress`, pero el método en servidor no repite ese chequeo — solo valida que la etiqueta no esté `consumed`/`cancelled`/en otro picking. Un RPC directo puede marcar `in_progress` una etiqueta de otra línea.
- **El chequeo de impresora no garantiza la impresión (parcialmente cerrado)**: `hasBrowserPrintDevice` (`8cec91587`) confirma que hay un dispositivo Zebra visible antes de crear la etiqueta, no que el `device.send()` posterior vaya a funcionar. `9d756afbc` cierra el caso de falla explícita de envío (sin agente, sin impresora, error de `send()`): `releaseUnprintedLabels` cancela la etiqueta recién creada (`action_release_unprinted`) para que deje de descontar disponible. Sigue abierto el caso en que `device.send()` reporta éxito (el callback dispara) pero no sale papel físico (sin cinta o sin rollo, por ejemplo): ahí la etiqueta queda consumida sin que nada la libere.
- **Lote fantasma en Inventario Cíclico**: si el `stock.quant` contado no tiene `lot_id`, `rc_label_source.py::_resolve_lot` crea un `stock.lot` nuevo con un código de secuencia como nombre. Contradice la regla dura de Alistamiento ("nunca crea un lote nuevo", ver arriba) — en Inventario Cíclico el contexto es distinto (conteo de lo que ya está físicamente en bodega, no separación), pero es una excepción real a esa regla, no una coincidencia.

## Historial de commits

??? note "Ver los 44 commits en orden"

    | # | Commit | Fecha | Mensaje |
    |---|---|---|---|
    | 1 | `a182ac982` | 2026-08-04 | Escanear código de OC para saltar a recepción pendiente |
    | 2 | `67f781b24` | 2026-08-04 | Columnas Comprado/Recepcionado y agrupación por Producto en escaneo |
    | 3 | `8efc4d1ef` | 2026-08-04 | Resolver ambigüedad de OT en wizard analítico según filtros activos |
    | 4 | `74e86b11f` | 2026-08-04 | Mover menús de bodega de Requisiciones a Inventario |
    | 5 | `d5ad2b300` | 2026-08-04 | Menú Recepción en Inventario reutilizando el lector |
    | 6 | `4dbdf92f9` | 2026-08-04 | No expulsar del filtro el grupo desplegado durante la captura |
    | 7 | `bf26e15ae` | 2026-08-04 | Unificar la etiqueta de producto entre fila, sección y dropdown |
    | 8 | `7d42b1e5d` | 2026-08-04 | Resolver la línea exacta al escanear con filtro OT/Proyecto activo |
    | 9 | `69032247b` | 2026-08-18 | Selector de tamaño/diseño a etiquetas CTS y RC |
    | 10 | `4dea7e809` | 2026-08-20 | Forzar tamaño/modo chica+con_ot en impresión RC al validar |
    | 11 | `4e551d09d` | 2026-08-28 | Generar etiquetas RC antes de recibir y estandarizar lista de Recepción |
    | 12 | `3ae2c8d2a` | 2026-08-31 | Reconectar wizard de tamaño en Etiqueta CTS de producto |
    | 13 | `3367002a3` | 2026-08-31 | Botón para elegir diseño de Etiquetas RC en Recepción |
    | 14 | `2aa0416e0` | 2026-08-31 | Eliminar botón obsoleto de Etiquetas RC en Recepción |
    | 15 | `5b397bf90` | 2026-09-02 | Botón Imp Etiq 17x17 en Recepción |
    | 16 | `12875bfd0` | 2026-09-03 | Fix: `separacion_confirmada` quedaba False y bloqueaba el picking |
    | 17 | `438703aa0` | 2026-09-11 | Wizard de etiqueta de línea para Alistamiento |
    | 18 | `7440f2e35` | 2026-09-11 | Cola derivada de Alistamiento y retiro de Solicitudes de Bodega |
    | 19 | `bb8001012` | 2026-09-15 | Resolver OT real cuando una línea de compra es compartida por varias requisiciones |
    | 20 | `7a73ffce0` | 2026-09-15 | Impresión ZPL directa a Zebra vía Browser Print (POC Ruta B) |
    | 21 | `c8f31bae9` | 2026-09-15 | Entrega en vivo por escaneo de numeración única |
    | 22 | `e119c935d` | 2026-09-15 | Foco de Rastreo solo en serial y doble conteo al capturar lote |
    | 23 | `5cf436141` | 2026-09-15 | Renombrar pestañas de perfil de Alistamiento |
    | 24 | `2a3df282a` | 2026-09-15 | Reusar CtsChipsCell en Serial/Lote de Alistamiento y ajustar fila al nativo |
    | 25 | `68368f4ea` | 2026-09-15 | Reconocer RC en Entrega, automatizar validación de requisición y acotar carga por fecha |
    | 26 | `dca126d6d` | 2026-09-19 | Etiquetas RC propias de Alistamiento con ubicación y lote/serial real |
    | 27 | `79a6d8706` | 2026-09-19 | Ubicación de separación por línea y `confirm_alistamiento` con trazabilidad exacta por move |
    | 28 | `71bf4e1ed` | 2026-09-19 | Reconocer etiquetas RC de Alistamiento en Entrega y mostrar trazabilidad de requisición |
    | 29 | `22bd1fef5` | 2026-09-19 | Recepción por semana actual, estado Parcial y aviso al salir con escaneos sin validar |
    | 30 | `e06eaa0f2` | 2026-09-21 | Reimpresión de etiquetas RC existentes desde Recepción (REC-01) |
    | 31 | `2b20b8545` | 2026-09-21 | Fix: filtro Fecha límite por `date_planned` por línea en Recepción |
    | 32 | `96a950a4a` | 2026-09-21 | Comprar restante no separado al validar Alistamiento (ALI-05) |
    | 33 | `477ef4035` | 2026-09-21 | Ventana por defecto de 3 días hábiles en cola pendiente de Alistamiento |
    | 34 | `8cec91587` | 2026-09-24 | Contador de reimpresión RC (REC-01) y chequeo de impresora antes de consumir etiqueta |
    | 35 | `968799687` | 2026-09-24 | Hidratar Proyecto/OT/Requisición en batch en vez de por línea |
    | 36 | `6b26f79fa` | 2026-09-24 | Alistamiento: ventana default, ALI-05B reserva estricta y cola más liviana |
    | 37 | `a8a2acdd5` | 2026-09-24 | Evitar doble reserva RC entre `confirm_alistamiento` y el auto-assign de `move_rc` |
    | 38 | `a217da06d` | 2026-09-24 | Recepción: lista de OC más liviana y calendario compartido |
    | 39 | `8a967a540` | 2026-09-24 | Fix: Entrega Admin con paginación server-side (fase vacía cargaba todo sin tope) |
    | 40 | `a495121a4` | 2026-09-28 | Extender paginación server-side de Entrega a todas las fases (no solo Admin) |
    | 41 | `9d756afbc` | 2026-09-29 | Liberar etiquetas RC si el ZPL no llega a imprimir |
    | 42 | `88af87c38` | 2026-09-29 | Columna Vigencia (vigente/vencida) en cola de Alistamiento |
    | 43 | `667d31da9` | 2026-09-29 | Bloquear generar etiquetas cuando ya no queda pendiente |
    | 44 | `6af770be9` | 2026-09-29 | Botones Mantener/Comprar en vez de radios en ALI-05 |

## Pendientes / puntos por confirmar

**Cobertura y calidad**

- [ ] Reponer tests de `confirm_alistamiento` (ramas Recepción y propia, ALI-05, ALI-05B). La decisión de `6b26f79fa` fue no mantenerlos en el repo; confirmar si viven en otro lugar o si la cobertura queda en cero a propósito.
- [ ] Medir cuántos OUT quedaron bloqueados por `separacion_confirmada=False` antes de `12875bfd0`, y si alguno sigue así en BD.
- [ ] Buscar otras rutas que creen moves salientes con `origin` `REQ-x-ITEM-y` sin `skip_rc_auto_assign`.

**Seguridad (abiertos)**

- [ ] `apply_operation`: agregar control de grupo y compañía.
- [ ] `resolve_for_scan`: quitar `sudo()` o recortar los datos que devuelve.
- [ ] `entrega_dev_prepare`: mover `move.picked = True` dentro del `if lot:`.

**Rendimiento**

- [x] ~~Entrega: la paginación server-side solo existe en `fase='admin'`~~ — resuelto por `a495121a4` (2026-09-28): las 4 fases de `tipo='entrega'` paginan en servidor.
- [ ] Devolución sigue sin paginación server-side: trae todo en un solo RPC y pagina en memoria, sin el tope de 90 días parametrizable de Entrega. Falta decidir si migrarla al mismo mecanismo, y con qué granularidad (por OT o por documento) si el volumen lo justifica (`2026-09-15-migracion-paginacion-server-side-entrega-devolucion.md`).
- [ ] Alistamiento: el cliente sigue mandando `bodega_id=false` a `get_alistamiento_scan_data` (`alistamiento_scan.js`). Acotarlo a la bodega activa es el candidato pendiente para bajar de ~6 s (`2026-09-22-performance-recepcion-alistamiento.md`).
- [ ] Campo de demanda con `search=` en SQL (patrón de `tiene_pendiente_reporte`) para no traer ~33k líneas a Python. No implementado; primero hay que medir el `CASE WHEN` en Postgres (`2026-09-24-necesidad-campo-demanda-alistamiento.md`).

**Funcionales / de producto**

- [ ] P-003: `qty_to_generate` arranca en 0 en el wizard de etiquetas; decidir con bodega si se mantiene.
- [ ] P-004: se retiró la revisión manual de lo recepcionado antes de alistar; confirmar con bodega que era trámite y no control.
- [ ] P-005 + Devolución: dar unidad/historial a las etiquetas propias de Alistamiento y reconocerlas en `devolucion_scan_unit`.
- [ ] `devolver_seleccion_a_bodega` sigue existiendo; con la cola derivada la línea reaparece si su demanda es > 0 (diseño 10.3, sin decidir).
- [ ] D-012: volver a comparar los ids de `_domain_gestion_pendiente` contra el original de `custom_requisiciones` cada vez que se toque cualquiera de las dos copias (criterio de aceptación 17 del diseño).
- [ ] Bug de backorder que suma (OC26-03661): reproducir con la interfaz real siguiendo los pasos del documento.

**Higiene del repo**

- [ ] Hay stashes viejos de este módulo en `changes_stock` (p. ej. `wip: fix parcial identificacion RC en input Rastreo`). El guard RC en Rastreo ya está en el código actual; revisar si se pueden descartar.
- [ ] Al escribir esta página, `static/src/js/entrega_devolucion.js` tenía cambios sin commitear en el working tree.
- [ ] `reports/report_rc_labels_combined copy.xml` está en el repo y no aparece en el manifest.
- [ ] `.claude/rules/alistamiento.md` y `.claude/rules/barcode-rc.md` están desactualizados en tres puntos: el `try/except` silencioso (cerrado por ALI-05B), `release_in_progress` "sin llamadores" (hoy lo llaman `alistamiento_scan.js` y `barcode_ui_patch.js`) y el mapa tracking→letra "duplicado" (hoy centralizado en `rc_label_common.py`). Un análisis del código verificado el 2026-09-28 ya trae el reemplazo de la sección de etiquetas RC de `barcode-rc.md`; falta decidir si se aplica al archivo de reglas del repo.
- [ ] `AlistamientoSource` (`rc_label_source.py:32`, registrada en el diccionario de orígenes) no tiene ningún llamador real — verificado: `get_label_source` solo se invoca con `'recepcion'` e `'inventario'` en todo el módulo. Decidir si se conecta (para que Alistamiento pase por la fábrica como los otros dos orígenes) o se borra.

**Pendiente de documentar**

- `ubicacion.bodega`, `stock.canastilla` y `cronograma.ot`: se listan en Modelos pero sus reglas no se revisaron.
- Fail-open de validación RC en pickings de salida (`reception_analytic_patch.js`), clasificado CRÍTICO en el discovery del 2026-09-03: no se volvió a verificar contra el código actual para esta página.
