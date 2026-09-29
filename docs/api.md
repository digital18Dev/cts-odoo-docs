# API interna

Métodos y endpoints que **otro módulo, el JS o un cron** llaman por diseño. No es la lista de todos los métodos públicos: en Odoo cualquier método sin `_` inicial se puede llamar por RPC, pero aquí solo entran los que tienen un llamador real encontrado en el código de `changes_stock`.

La superficie real es angosta:

- **`custom_barcode_activos`**: dos rutas HTTP y unos 50 métodos que llaman sus pantallas OWL.
- **`custom_solicitudes`**: el servicio de notificaciones y dos métodos de selección llamados desde JS.
- **`custom_sig`**: dos registries JS abiertos a extensión.
- **Los demás 7 módulos** no exponen nada pensado para otros. Sus controladores (`controllers/controllers.py` en `custom_documentos_sig`, `custom_compras`, `custom_reportes`, `custom_clientes`, `custom_activos_fijos` y `custom_despachos`) son el andamiaje del generador, con todas las rutas comentadas.

## custom_barcode_activos

### Rutas HTTP

Ambas en `controllers/main.py`, clase `ActivosFijosBarcodeController`, que hereda `StockBarcodeController` de `stock_barcode`.

| Ruta | Tipo / auth | Qué hace | Llamadores |
|---|---|---|---|
| `/stock_barcode/scan_from_main_menu` | `json`, `user` | **Sobrescribe** la ruta nativa. Prueba routers del más estricto al más general: `_route_asset` → `_route_canastilla` → `_route_location` → `_route_purchase_order` → `_route_picking` → `_route_rc_unit` → `_route_product`. Si ninguno reconoce el código, delega en `super().main_menu`. Devuelve `{'action': ..., 'warning': ...}`. | Menú principal de `stock_barcode`, `inventario_barcode_menu.js`, `recepcion_oc_list.js` |
| `/activo_barcode/apply_operation` | `json`, `user` | Ejecuta una `barcode.operation` (por `operation_code`) sobre un activo (`activo_id`), ambos con `sudo()`. | No se encontró llamador JS a la ruta. `activo_barcode_operations.js` llama `barcode.operation.execute_on_asset` por ORM. |

!!! warning "Riesgos abiertos de estas rutas"
    - `apply_operation` no controla grupo ni compañía, e incluye dar de baja un activo fijo.
    - `_route_asset` busca con `sudo()` y además **escribe** el contador de escaneos del activo.
    - `_route_purchase_order` busca **sin** `sudo()`, así que respeta las reglas de acceso del usuario.

    Ver [custom_barcode_activos → Bugs y decisiones relevantes](modulos/custom_barcode_activos.md#bugs-y-decisiones-relevantes).

Formatos que reconoce el router (regex al inicio de `controllers/main.py`):

| Formato | Ejemplo | Router |
|---|---|---|
| Código de activo (`barcode`, `consecutivo_activos`, `codigo` o `serial`) | — | `_route_asset` |
| Ubicación de canastilla `U.<...>.<...>` | `U.14BOD.A1.R1.P3` | `_route_location` |
| Orden de compra `OC.<name>` | `OC.OC26-03739` | `_route_purchase_order` |
| Picking nativo `<prefijo>/<OP>/<número>`, con separadores tolerantes | — | `_route_picking` |
| Etiqueta RC `[LSN]\d{5,}` (`RC_LABEL_RE`) y formatos viejos `L.<...>.<id>`, `R.<...>.<id>`, `<código>-<base36>` | `L00001` | `_route_rc_unit` |

### Métodos llamados por RPC desde las pantallas

Extraído de las llamadas `orm.call(modelo, método)` en `static/src/js/`. Todos son `@api.model` o métodos de registro sin `_` inicial.

**Código único RC / etiquetas**

| Método | Modelo | Llamado desde | Nota |
|---|---|---|---|
| `resolve_for_scan(barcode)` | `stock.rc.label.pending` | `barcode_ui_patch.js` | No consume nada. Usa `sudo()` y devuelve datos de la OC: abierto por exposición a cualquier usuario autenticado. |
| `mark_in_progress(barcode, picking_id)` | `stock.rc.label.pending` | `barcode_ui_patch.js` | Rechaza etiquetas `consumed`, `cancelled` o en otro picking. Sin bloqueo de fila. |
| `get_inprogress_for_picking(picking_id)` | `stock.rc.label.pending` | `barcode_ui_patch.js` | Rehidrata los chips tras F5 u otro equipo. |
| `release_in_progress(barcodes, picking_id=None)` | `stock.rc.label.pending` | `alistamiento_scan.js`, `barcode_ui_patch.js` | Libera escaneos sin validar ("Descartar y salir"). |
| `get_inprogress_por_material(material_ids)` | `stock.rc.label.pending` | `alistamiento_scan.js` | |
| `action_reprint_get_print_mode` | `stock.rc.label.pending` | `rc_reprint_lines_list.js` | Reimpresión REC-01. |
| `action_get_print_mode` / `action_get_print_mode_all` | `rc.label.generator.wizard(.line)`, `alist.label.generator.wizard(.line)` | `rc_label_lines_list.js`, `alist_label_lines_list.js` | Impresión en dos pasos: el servidor crea las etiquetas y devuelve datos planos; el cliente manda ZPL o abre PDF. |
| `resolve_inventory_scan(barcode)`, `action_ic_get_print_mode` | `stock.quant` | `inventory_count_list.js` | Inventario cíclico. |

**Recepción**

| Método | Modelo | Llamado desde |
|---|---|---|
| `action_open_reception_scan` | `purchase.order` | `recepcion_oc_list.js` y `_route_purchase_order` |
| `get_ids_recepcion_semana_actual`, `get_ids_recepcion_por_fecha(date_from, date_to)` | `purchase.order` | `recepcion_oc_list.js`, `recepcion_toolbar.js` |
| `rc_get_recepcion_historial(perfil_code)` | `purchase.order` | `recepcion_toolbar.js` |
| `rc_create_bill_silent` | `purchase.order` | `recepcion_oc_list.js` |
| `get_analytic_batch_data(move_line_ids)` | `stock.move.line` | `barcode_ui_patch.js` |
| `action_open_analytic_wizard_for_product(product_id, ot_filter, proyecto_filter)` | `stock.picking` (definido en `wizard/reception_analytic_wizard.py`) | `reception_analytic_patch.js` |
| `action_confirm` | `reception.analytic.wizard` | `reception_analytic_patch.js` |
| `mark_rc_scanned(barcode)`, `verify_rc_for_delivery(barcode)` | `stock.picking` (en `models/stock_lot.py`) | `reception_analytic_patch.js` |

**Alistamiento** (todos sobre `custom_requisiciones.material_electrico`, ver [ADR-02](adr.md#adr-02-custom_barcode_activos-extiende-custom_requisiciones-sin-editarlo))

| Método | Llamado desde | Nota |
|---|---|---|
| `get_alistamiento_scan_data(source, bodega_id, fase)` | `alistamiento_scan.js` | El cliente manda `bodega_id=false` (pendiente de rendimiento). |
| `resolve_rc_scan(barcode, context_material_ids)` | `alistamiento_scan.js` | |
| `preview_alistamiento(line_specs)` | `alistamiento_scan.js` | Solo muestra; no crea nada. |
| `confirm_alistamiento(line_specs)` | `alistamiento_scan.js` | Dos pases; `UserError` si no reserva exacto ([ADR-06](adr.md#adr-06-reserva-estricta-en-alistamiento-ali-05b)). |
| `action_set_source_location_alistamiento(material_id, location_id)` | `alistamiento_scan.js` | |
| `enviar_seleccion_a_comprar(line_ids)`, `devolver_seleccion_a_bodega(line_ids)` | `alistamiento_scan.js` | |
| `abrir_confirmar_enviar_a_separar`, `abrir_enviar_a_separar_comprar`, `abrir_enviar_separar_reabastecimiento` | `alistamiento_scan.js` | Abren wizards de `custom_requisiciones`. |
| `register_alist_rc_delivery(target_analytic_name, target_req_id, notes)` | `alistamiento_scan.js` | Método de `stock.reception.record`. |
| `get_all_canastillas`, `resolve_canastilla_scan`, `associate_to_ots` | `alistamiento_scan.js` | Métodos de `stock.canastilla`. |

**Entrega / Devolución** (sobre `custom_requisiciones.material_electrico`)

| Método | Llamado desde |
|---|---|
| `get_entrega_devolucion_data(tipo, fase, fecha_desde, fecha_hasta, ...)` | `entrega_devolucion.js` |
| `entrega_scan_unit(barcode)` | `entrega_devolucion.js` |
| `devolucion_scan_unit(barcode)` | `entrega_devolucion.js` |
| `entrega_dev_prepare(specs, signatures)` | `entrega_devolucion.js` |
| `entrega_dev_validate_pickings(picking_ids)` | `entrega_devolucion.js` |
| `entrega_dev_finish_backorder(picking_id, create_backorder)` | `entrega_devolucion.js` |
| `get_canastillas_para_entrega`, `mark_en_entrega` (`stock.canastilla`) | `entrega_devolucion.js` |

**Navegación, activos y tableros**

| Método | Modelo | Llamado desde |
|---|---|---|
| `get_perfiles_para_usuario(operacion)` | `recepcion.perfil` | `recepcion_perfil_tabs.js` |
| `execute_on_asset(asset)` | `barcode.operation` | `activo_barcode_operations.js` y `/activo_barcode/apply_operation` |
| `get_shelf_map_data` | `stock.canastilla` | `shelf_map.js` |
| `get_cronograma_data`, `agregar_ots`, `eliminar_ot`, `set_fecha`, `set_fecha_entrega_bulk`, `set_coi`, `set_coi_bulk`, `set_en_produccion`, `limpiar_celda` | `cronograma.ot` | `cronograma_ot.js` |
| `get_solicitudes_bodega_data`, `enviar_seleccion_a_alistamiento`, `enviar_seleccion_a_comprar`, `abrir_alistar_comprar`, `abrir_alistar_reabastecimiento` | `custom_requisiciones.material_electrico` | `solicitudes_bodega.js`: tablero retirado del menú en `7440f2e35`, pero el JS sigue cargado y los métodos siguen definidos. |

### Contrato entre módulos: flags de contexto

| Flag | Lo pone | Lo lee | Efecto |
|---|---|---|---|
| `bypass_separacion_validacion` | `custom_barcode_activos` (`stock_alistamiento.py:57`) | `custom_requisiciones/models/stock_picking.py` (`write()`) | Salta el guard de `separacion_confirmada` y la lógica de distribución de ese `write()`. |
| `skip_rc_auto_assign` | `confirm_alistamiento` (`stock_alistamiento.py:1711`) | `stock_move_rc.py:33` | Evita el auto-assign FIFO de lote RC al crear el move. |

## custom_solicitudes

### `asignacion.notification.service`

`AbstractModel` en `models/notification_service.py`. Diseño y consecuencias en [ADR-05](adr.md#adr-05-servicio-central-de-notificaciones-que-no-aborta-el-negocio). Todos los llamadores envuelven la llamada en `try/except` y solo loguean.

| Método | Canal | Llamado desde |
|---|---|---|
| `notificar_solicitud_creada(record)` | Discuss | `asignacion.request.create()` |
| `notificar_nci_creada(record)` | Discuss | `asignacion.request.create()` |
| `notificar_nci_priorizada(record)` | Discuss | `asignacion.request.write()`, al pasar `priorizado` a True |
| `notificar_fase_cambiada(record, fase_nueva, campo_fase)` | Discuss | `asignacion.request.write()` |
| `notificar_kit_incompleto(record, lineas_kit_incompleto)` | Discuss | `asignacion_request.py` (asignación de productos) |
| `notificar_productos_guardados(record)` | Discuss | `asignacion_producto_linea.py` |
| `notificar_oli_creada_desde_tic(origen, nueva)` | Discuss | `asig.oli.firma.wizard` |
| `notificar_devolucion_creada(record)` | Discuss | `asignacion.devolucion.create()`, `asignacion_producto_linea.py` |
| `notificar_devolucion_productos_agregados(record, lineas_nuevas)` | Discuss | `asignacion_producto_linea.py` |
| `notificar_devolucion_picking(picking)` | Discuss | `asignacion_producto_linea.py` (al crear el picking de devolución) |
| `notificar_devolucion_validada(record)` | Discuss | `asignacion.devolucion.write()`, `stock.picking._procesar_devolucion_bodega` |
| `notificar_taxi_creada(record)` | Correo (`message_notify`) | `custom.asig.taxis.create()` |
| `cron_solicitudes_pendientes()` | Canal de grupo | `data/cron_notifications.xml` (mañana, mediodía y tarde) |
| `cron_prestamos_por_vencer()` | Discuss | `data/cron_notifications.xml` (mañana, mediodía y tarde) |

!!! note "Riesgos ya documentados"
    Duplicar una solicitud de taxi vuelve a disparar `notificar_taxi_creada` y consume un número TAX nuevo ([custom_solicitudes → Aviso de taxi](modulos/custom_solicitudes.md#aviso-de-taxi-al-responsable)).

!!! warning "`notificar_solicitud_creada` no entrega el mensaje (lectura de código, sin probar en BD)"
    `_build_card(self, badge, doc_name_html, doc_sub, saludo, tabla_html, ...)` exige `doc_sub` sin valor por defecto (`notification_service.py:128`). La llamada de `notificar_solicitud_creada` (línea 478) tiene `doc_sub` comentado. Las otras 12 llamadas a `_build_card` sí lo pasan. El `TypeError` ocurre dentro del `try` por receptor de `_enviar()`, así que la solicitud se crea igual y solo queda un warning `❌ ... error:` en el log. Pendiente confirmarlo en `/var/log/odoo/odoo-server.log` creando una solicitud OLI.

### Métodos llamados desde JS

| Método | Modelo | Llamado desde |
|---|---|---|
| `action_confirmar_seleccion` | `asignacion.producto.seleccion` | `seleccion_kanban.js` |
| `action_omitir_marcadores` | `asignacion.marcador.wizard` y el de devolución | `marcador_wizard.js` |

### Integración con `stock.picking`

No es una API llamada por otros módulos, pero cualquier módulo que valide pickings pasa por ella. `custom_solicitudes` sobrescribe `stock.picking.button_validate`:

- **Antes del `super()`** exige firma en los pickings de asignación: `firma_asignacion_empleado` en el OUT y `firma_recibido_devolucion` en la devolución.
- **Después**, si el picking tiene `asignacion_id` y quedó `done`, actualiza las líneas de asignación.

Un picking sin `asignacion_id` ni `solicitudes_dev` no se ve afectado. Ver [Flujos → Asignación](flujos.md#1-asignacion-de-productos-al-empleado-oli-tic).

## custom_sig

Extensión del widget de ayuda sin tocar su código ([custom_sig → Wizards / vistas / JS](modulos/custom_sig.md#wizards-vistas-js-relevantes)):

| Registry | Contenido | Uso desde otro módulo |
|---|---|---|
| `sig_help_examples` | Ejemplos por `key` (`registro`, `tratamiento`, `correccion`, `plan_accion`) | Agregar una entrada y referenciarla con `<widget name="sig_help_modal" example="<key>"/>` |
| `sig_help_renderers` | Layouts por `kind` (`fields`, `cards`, `five_whys`) | Agregar un layout nuevo; si el `kind` no existe, cae a `fields` |

Documentación del autor: `custom_sig/docs/widget_help_modal.md`.

## Pendiente de documentar

- Qué hace cada `barcode.operation` disponible para `execute_on_asset`.
- Los métodos de `custom_requisiciones` que `custom_barcode_activos` sobrescribe con `super()` (por ejemplo `get_solicitudes_bodega_data`): el contrato del método original no se revisó.
