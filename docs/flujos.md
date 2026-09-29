# Flujos funcionales

Recorridos que **cruzan** módulos. Lo que pasa dentro de un solo módulo está en su página; aquí solo se enlaza.

Cada paso cita el método que lo ejecuta en `changes_stock`. Donde no hay evidencia suficiente para un tramo, se marca como pendiente.

## 1. Asignación de productos al empleado (OLI / TIC)

**Módulos:** `custom_solicitudes` + inventario nativo (`stock`, `mrp`) + `custom_inventario` (campos de producto).

<div class="diagram" data-diagram-src="../flujos-1-asignacion.diagram.html"><a href="../flujos-1-asignacion.diagram.html">Abrir diagrama: asignación de productos al empleado</a></div>

1. **Solicitud.** Se crea un `asignacion.request` con líneas `asignacion.producto.linea` sobre `product.product`. El catálogo son los productos con `solicitudes_asignacion=True`, campo que define `custom_inventario`.
2. **Aprobación.** `action_aprobar_oli` (solo tipos `oli` y `tic`) abre `asignacion.aprobacion.wizard`. Si algún producto aprobado tiene `mrp.bom`, primero sale `asignacion.marcador.wizard` con todos los componentes; los no elegidos quedan con `no_asignado=True` y su motivo.
3. **OUT.** `_crear_pickings_out` busca un OUT en borrador de la misma solicitud y almacén, o lo crea (`location_dest_id` = Clientes). Crea un `stock.move` por producto, o uno por componente si es kit, con `asignacion_linea_id` apuntando a la línea. La solicitud pasa a `fase2_aprobado`, o a `fase3_aprobado_observaciones`. La ficha del empleado se vincula desde este momento.
4. **Entrega.** `stock.picking.button_validate` (herencia en `custom_solicitudes/models/stock_picking_asignacion.py`) exige `firma_asignacion_empleado` en OUT de asignación. Con el picking en `done`, `_procesar_asignacion_post_validate` suma a `cantidad_entregada` sin pasar de `cantidad_aprobada`. Si el botón devuelve un wizard (backorder), no procesa todavía.
5. **Cierre.** La solicitud pasa a `fase4_finalizado` cuando todas las líneas activas están aprobadas y entregadas, y ningún OUT `done` queda sin firma. Si la OLI nació de una TIC, propaga cantidades a la TIC origen (`_propagar_cantidades_a_tic`).
6. **Devolución.** Desde la ficha del empleado, `action_crear_devolucion_desde_lineas` crea un picking con el tipo de devolución del OUT de la bodega y `es_devolucion_asignacion=True`. Los kits van por `asignacion.kit.devolucion.wizard`. Al validar (exige `firma_recibido_devolucion`), `_procesar_devolucion_post_validate` suma a `cantidad_devuelta_total` sin pasar de lo entregado. Lo que vuelve en estado dañado, perdido o fin de vida útil pasa a `stock.quant.qty_devolucion_danada`, campo de `custom_inventario`.

Existe además una **devolución manual en bodega**: una recepción en la bodega de asignaciones (parámetro `custom_solicitudes.warehouse_oli_id`, por defecto `24`) marcada `solicitudes_dev` crea al validarse un `asignacion.devolucion` `DEV<aa>-NNNN` (`_procesar_devolucion_bodega`).

!!! note "Activos fijos en la misma solicitud"
    Las líneas de activo fijo (`custom.activos.fijos`, de `custom_activos_fijos`) no generan `stock.move`. El wizard de aprobación les fija `cantidad_aprobada=1`, y `action_asignar_productos` las procesa aparte ("Procesar solo activos fijos y líneas legacy (productos se manejan via picking OUT)", `asignacion_request.py:1467`). `custom_solicitudes` extiende `custom.activos.fijos` solo para contar asignaciones y devoluciones desde `asignacion.producto.historial`.

!!! warning "NCI no sigue este flujo"
    La NCI tiene su propio campo de fases (`fases_nci`: Solicitud, Cotización, Aprobación, OC, Programación de pagos, Seguimiento, Recepción, Entrega, Legalización, Rechazado). `action_aprobar_oli` rechaza cualquier tipo distinto de `oli`/`tic`, y en `asignacion_request.py` no hay referencias a `purchase.order`. Las fases OC y Recepción de la NCI se mueven a mano, sin enlace de código con Compras ni con el inventario. Lo que sí está documentado de la NCI es su notificación: [custom_solicitudes → Priorización de NCI por Discuss](modulos/custom_solicitudes.md#priorizacion-de-nci-por-discuss).

**Pendiente de documentar:** GMT y GAF (GAF guarda soportes en Documents, `_crear_documento_gaf`) y el flujo SST de EPP (`action_finalizar_sst`, `asignacion.sst.wizard`).

## 2. Requisición → Alistamiento / Compra → Recepción → Entrega / Devolución

**Módulos:** `custom_requisiciones` (dueño de `material_electrico`) + `custom_barcode_activos` (bodega) + `custom_compras` (enlace de la línea de OC) + `purchase` / `stock`.

<div class="diagram" data-diagram-src="../flujos-2-requisicion.diagram.html"><a href="../flujos-2-requisicion.diagram.html">Abrir diagrama: de la requisición a la entrega</a></div>

1. **Demanda.** Una línea de requisición (`custom_requisiciones.material_electrico`) aprobada con demanda pendiente entra sola en la cola de Alistamiento. No hay botón de envío: la cola sale de `_domain_gestion_pendiente` y `_demanda_gestion`, que `custom_barcode_activos` define por `_inherit` sobre el modelo de `custom_requisiciones`. Ver [custom_barcode_activos → Alistamiento](modulos/custom_barcode_activos.md#alistamiento).
2. **Separar con stock.** `confirm_alistamiento` valida todo (ubicación, lote/serial, disponible libre) y luego crea o reutiliza un OUT en borrador por (bodega, requisición/origen, ubicación). Reserva exacta o `UserError` (ALI-05B). Marca `separado_en_fisico=True`, que refleja `separado` en la requisición.
3. **Comprar lo que falta.** `_solicitar_compra_desde_alistamiento` pasa la línea a `estado='solicitud_compra'`, acumula `cantidad_enviada_a_comprar` y crea una actividad para los responsables de compra. La OC se genera en `custom_requisiciones` con `action_enviar_a_compra`: agrupa por (proveedor, bodega), crea la línea de OC con `requisition_item_id` y escribe `purchase_line_id` en el ítem.
4. **Enlace OC → requisición.** `custom_compras` define `purchase.order.line.requisition_item_id` y lo copia a cada `stock.move` de recepción en `_prepare_stock_moves`. Borrar una línea de OC devuelve el ítem a solicitud de compra (`purchase.order.line.unlink` en `custom_compras/models/models.py`).
5. **Recepción.** Se imprimen etiquetas RC desde la OC y se escanean en la recepción. Al validar, cada unidad recibida queda como `stock.lot.item` o `stock.reception.record` ligada a su requisición. La OT se resuelve contra la analítica real de la línea de compra (caso OC26-03739). Ver [custom_barcode_activos → Recepción](modulos/custom_barcode_activos.md#recepcion).
6. **Rama Recepción de Alistamiento.** Lo recibido vuelve a la cola con `source='recepcion'`: `recepcionado − separado − entregado − cantidad_enviada_a_separar`. Esos OUT sí tienen `requisition_id`, así que les aplica el guard de `custom_requisiciones/models/stock_picking.py` (`write()`); Alistamiento lo atraviesa con `bypass_separacion_validacion`.
7. **Entrega.** `entrega_scan_unit` resuelve la unidad y la reserva al move (`reserved_move_id`). Antes de validar, `_ensure_requisicion_validada` corre el candado de `custom_requisiciones` (Separar/Validar Requisición: `action_separar_requisicion`, `action_validar_requisicion`). Al validar, `_mark_lot_items_delivered` marca las unidades. Ver [custom_barcode_activos → Entrega/Devolución](modulos/custom_barcode_activos.md#entregadevolucion).
8. **Devolución.** `devolucion_scan_unit` agrega la unidad entregada a un IN en borrador por requisición; `_process_rc_returns` la restaura al validar.

!!! warning "Riesgos del cruce (detalle en la página del módulo)"
    - La cola y el disponible de Alistamiento copian lógica de `custom_requisiciones/models/requisition.py` (D-012). Si una copia cambia, las pantallas divergen sin aviso.
    - Todo flujo nuevo que cree pickings de requisición fuera de la vía nativa necesita el mismo bypass de `separacion_confirmada`.
    - Las etiquetas propias de Alistamiento se reconocen en Entrega pero **no** en Devolución.

    Ver [custom_barcode_activos → Bugs y decisiones relevantes](modulos/custom_barcode_activos.md#bugs-y-decisiones-relevantes).

**Pendiente de documentar:** el ciclo de aprobación de la requisición en `custom_requisiciones` (estados `borrador` → `por_aprobar` → `aprobado`, wizards de aprobación). El módulo no tiene página propia porque `digital18` no tiene commits en él.

## 3. OC impresa → escaneo → recepción pendiente

**Módulos:** `custom_reportes` (imprime) + `custom_barcode_activos` (lee). `custom_compras` no participa: el reporte nativo de OC que modifica no lleva el código de barras (`custom_compras/report/purchase_order_barcode.xml`).

<div class="diagram" data-diagram-src="../flujos-3-oc-recepcion.diagram.html"><a href="../flujos-3-oc-recepcion.diagram.html">Abrir diagrama: OC impresa → recepción pendiente</a></div>

1. Compras imprime la OC con **Orden de Compra CTS** (`custom_reportes`, `reportes/cts_external_layout.xml`). El header lleva un Code128 con `OC.<name>`. No hay campo nuevo en `purchase.order`: el valor se arma en el QWeb.
2. En bodega, el código se escanea desde el menú principal de `stock_barcode`, desde el menú Recepción de Inventario (`inventario_barcode_menu.js`) o desde la lista de OC de Recepción (`recepcion_oc_list.js`). Los tres llaman a `/stock_barcode/scan_from_main_menu`.
3. `_route_purchase_order` reconoce el prefijo `OC.` sin distinguir mayúsculas, normaliza separadores mal mapeados por el teclado de la tablet y busca la OC **sin** `sudo()`, respetando reglas de acceso y compañía.
4. `purchase.order.action_open_reception_scan` abre la recepción pendiente, o la lista si hay más de una. El clic en una fila de la lista de Recepción usa el mismo método.

Detalle y el fallo del primer intento (el código se puso en el reporte que bodega no usa): [custom_compras → Bugs y decisiones relevantes](modulos/custom_compras.md#bugs-y-decisiones-relevantes).

!!! warning "Dependencias no declaradas"
    `custom_compras` y `custom_reportes` no se declaran entre sí en `depends`, y `custom_reportes` tampoco declara `purchase`. Ver [custom_reportes → Pendientes](modulos/custom_reportes.md#pendientes-puntos-por-confirmar).

## 4. Activo fijo: escaneo y operaciones

**Módulos:** `custom_activos_fijos` (dueño de `custom.activos.fijos`) + `custom_barcode_activos` (escaneo) + `custom_solicitudes` (asignación e historial).

1. `_route_asset` es el primer router de `/stock_barcode/scan_from_main_menu`. Busca con `sudo()` por `barcode`, `consecutivo_activos`, `codigo` o `serial` entre los activos con `barcode_enabled`, suma el contador de escaneos y abre `wizard.activo.scan.options`.
2. Las operaciones sobre el activo se ejecutan con `barcode.operation.execute_on_asset`, desde `/activo_barcode/apply_operation` o por RPC directo (`activo_barcode_operations.js`).
3. La asignación del activo a un empleado va por el flujo 1 (líneas con `es_activo_fijo`). `asignacion.activo.confirmacion.wizard` confirma cuando el activo ya tiene otro responsable.

!!! warning "Abierto"
    `/activo_barcode/apply_operation` no controla grupo ni compañía; eso incluye dar de baja un activo. Ver [custom_barcode_activos → Bugs y decisiones relevantes](modulos/custom_barcode_activos.md#bugs-y-decisiones-relevantes).

**Pendiente de documentar:** qué operaciones existen en `barcode.operation` y qué hace cada una. La página del módulo no las lista.

## Otros cruces identificados, sin flujo documentado

| Cruce | Evidencia | Estado |
|---|---|---|
| `custom_empleados` → `custom_flota` | `es_conductor_autorizado` lee `fleet.personal.autorizado` con `sudo()`. | Documentado en [custom_empleados](modulos/custom_empleados.md#reglas-de-negocio). Es una lectura, no un flujo. |
| `custom_despachos` → `custom_requisiciones`, `custom_proyectos` | Declarados en `depends` del manifest. | Pendiente: la página del módulo cubre solo el fix de PQR. |
| `custom_barcode_activos` → `custom_proyectos` | `cronograma.ot` extiende `celula.ape` y `celula.ldp`. | Pendiente: `cronograma.ot` no se revisó en detalle. |
