# Modelos

Índice de los modelos (`models.Model` y `models.AbstractModel`) de los 10 módulos documentados. Cada sección enlaza a la página del módulo, que tiene los campos clave y las reglas.

Criterio de la tabla:

- **Documentado**: el modelo aparece en la sección "Modelos principales" del módulo, con campos y reglas.
- **Solo código**: el modelo existe en `changes_stock` pero la página del módulo no lo cubre (lo tocaron otros autores). La descripción sale de su `_description`; no se revisaron sus reglas.

Los wizards (`TransientModel`) están en [Wizards](wizards.md).

## custom_barcode_activos

Detalle en [custom_barcode_activos → Modelos principales](modulos/custom_barcode_activos.md#modelos-principales).

| Modelo | Representa | Estado |
|---|---|---|
| `stock.rc.label.pending` | Etiqueta RC impresa (código `[LSN]\d{5,}`), antes y después de ligarse a una unidad. Estados `pending` → `in_progress` → `consumed`. | Documentado |
| `stock.lot.item` | Unidad física dentro de un lote/serial, con su requisición y su entrega. | Documentado |
| `stock.reception.record` | Unidad física de un producto sin rastreo. | Documentado |
| `stock.lot.item.history` / `stock.reception.record.history` | Historial de requisiciones por unidad (incluye `delivered` y `returned`). | Documentado |
| `stock.rc.anulado.log` | Numeración RC liberada por devolución a proveedor. | Documentado |
| `recepcion.perfil` | Pestaña "Fase N" de un menú de Gestión de Bodega, con su grupo y usuarios. | Documentado |
| `stock.canastilla` / `stock.canastilla.stage` / `stock.canastilla.relacion` | Canastilla de alistamiento y su relación con Proyecto/OT/Requisición. | Documentado (reglas sin revisar) |
| `ubicacion.bodega` / `product.ubicacion.line` | Estante/repisa/puesto de canastilla; ubicación de producto por bodega. | Documentado (reglas sin revisar) |
| `cronograma.ot` | Priorización de OT para el tablero de bodega. | Documentado (reglas sin revisar) |
| `barcode.operation` / `barcode.operations.mixin` | Operaciones por código de barras sobre activos fijos. El mixin es `AbstractModel`. | Documentado |

Extensiones de modelos de otros módulos (el detalle de qué agrega cada una está en la página del módulo):

| Modelo extendido | Módulo dueño |
|---|---|
| `custom_requisiciones.material_electrico` | `custom_requisiciones` (en `stock_alistamiento.py`, `stock_entrega_scan.py`, `stock_devolucion_scan.py`) |
| `custom.requisition` | `custom_requisiciones` |
| `historial.material.item` | `custom_requisiciones` |
| `custom.activos.fijos` | `custom_activos_fijos` |
| `stock.picking`, `stock.move`, `stock.move.line`, `stock.lot`, `stock.quant`, `stock.picking.type` | `stock` |
| `purchase.order`, `purchase.order.line` | `purchase` |
| `product.template`, `mrp.bom`, `project.task`, `ir.actions.report` | core |
| `celula.ape`, `celula.ldp` | `custom_proyectos` (en `cronograma_ot.py`) |

## custom_solicitudes

La página del módulo ya tiene su propia sección de [Modelos principales](modulos/custom_solicitudes.md#modelos-principales); esta tabla la amplía con el archivo de cada uno.

| Modelo | Representa | Archivo |
|---|---|---|
| `asignacion.request` | Solicitud OLI, NCI, GMT, TIC o GAF. Cada tipo tiene su campo de fase (`fase_asignacion` para OLI, `fases_nci` para NCI, etc.). `mail.thread`. | `models/asignacion_request.py` |
| `asignacion.producto.linea` | Línea de producto (`product.product`) o activo fijo de una solicitud o de la ficha del empleado. Lleva `cantidad_solicitada`, `cantidad_aprobada`, `cantidad_entregada`, `cantidad_devuelta_total`. | `models/asignacion_producto_linea.py` |
| `asignacion.producto.seleccion` | Productos seleccionables para una asignación o un kit (kanban de selección). | `models/asignacion_producto_linea.py` |
| `asignacion.picking.linea` | Documento de inventario relacionado con una solicitud. Se crea solo en `stock.picking.create()` cuando el picking trae `asignacion_id`. | `models/asignacion_picking_linea.py` |
| `asignacion.empleado.asignado` | Ficha del empleado: lo que tiene asignado, entregado y devuelto. | `models/empleado_asignado.py` |
| `asignacion.producto.historial` | Historial de movimientos (asignación/devolución) de productos y activos fijos. | `models/empleado_asignado.py` |
| `asignacion.epp.resumen` | Resumen de EPP por producto, empleado y ubicación. | `models/epp_resumen.py` |
| `asignacion.devolucion` / `asignacion.devolucion.linea` / `asignacion.devolucion.producto.seleccion` | Devolución manual de productos asignados (consecutivo `DEV<aa>-NNNN`). | `models/devolucion.py` |
| `asignacion.responsable` | Tarjeta de responsables por tipo de solicitud. Define a quién se notifica y por qué canal. | `models/responsable.py` |
| `asignacion.responsable.gh` | Responsables de Gestión Humana por categoría OLI. | `models/responsable.py` |
| `asignacion.notification.service` | Servicio central de notificaciones (`AbstractModel`). Ver [API interna](api.md#custom_solicitudes). | `models/notification_service.py` |
| `permiso.ficha.asignacion` | Permisos de ficha de empleado para Asignaciones. | `models/permiso_ficha_asignacion.py` |
| `asignaciones.dashboard` | Tablero de asignaciones. | `models/dashboard.py` |
| `custom.asig.taxis` / `custom.asig.tickettaxis` / `custom.asig.tickecabify` | Solicitud de taxi y sus tickets (Radio Taxi y Cabify). | `models/taxis_viaticos.py` |
| `custom.asig.alimentacion` / `custom.asig.alimentacion.colaborador` / `custom.asig.clasificacion.alimentacion` | Solicitud de alimentación, colaboradores y clasificación. | `models/alimentacion.py` |
| `custom.asig.domi` / `custom.asig.empresa.domicilios` | Solicitud de domicilio y empresas de domicilio. | `models/domicilios.py` |

Extensiones: `stock.picking` (`asignacion_id`, `es_devolucion_asignacion`, firmas de entrega y devolución, `solicitudes_dev`), `stock.move` (`asignacion_linea_id`, `estado_asignacion`, `estado_devolucion`), `custom.activos.fijos` (contadores de historial), `hr.employee`, `res.users`, `documents.document`.

Campos de producto que usa pero no define: `solicitudes_asignacion`, `categoria_oli` y `disponible_prestamo` en `product.template`/`product.product`, y `qty_devolucion_danada` en `stock.quant`. Viven en `custom_inventario` (`models/models.py`), fuera de los 10 módulos.

## custom_sig

Detalle en [custom_sig → Modelos principales](modulos/custom_sig.md#modelos-principales).

| Modelo | Representa | Estado |
|---|---|---|
| `sig.accion.correctiva` | No conformidad y su tratamiento completo, por fases Registro → Tratamiento → Revisión → Finalizado. `_rec_name = consecutivo`. | Documentado |
| `sig.correccion` | Corrección inmediata, línea hija con estado propio. | Documentado |
| `sig.plan.accion` | Plan de acción con evaluación de eficacia, línea hija con estado propio. | Documentado |
| `sig.norma` | Catálogo de normas / documentos internos (`code` sin unicidad). | Documentado |

## custom_documentos_sig

Detalle en [custom_documentos_sig → Modelos principales](modulos/custom_documentos_sig.md#modelos-principales).

| Modelo | Representa | Estado |
|---|---|---|
| `acta.reuniones` | Acta de reunión con firmas de aprobación. | Documentado |
| `aprobaciones.reuniones` / `aprobaciones.reuniones.externos` | Línea de firma interna (`hr.employee`) y externa (texto libre). | Documentado |
| `certificacion.ente` | Catálogo de entes certificadores. | Documentado |
| `certificaciones` | Certificación de la empresa. | Documentado (solo `ente_certificador_id`) |
| `formatos.dpto` | Rango numérico de un departamento de formato. | Documentado |
| `custom.documentos.sig` | Documento SIG con código y consecutivo. | Documentado |
| `documentos.historico.versiones` | Versión de un documento; hereda el código del padre. | Documentado |
| `medio.reunion`, `tipo.reunion`, `tipo.comite`, `objetivos.reunion`, `compromiso.reunion` | Catálogos y líneas del acta. | Solo código |
| `custom.documentos.sig.stage`, `plantillas.formatos.stage`, `certificaciones.stage` | Etapas de documentos, plantillas y certificaciones. | Solo código |
| `plantillas.formatos` | Plantillas de formatos. | Solo código |
| `permiso.departamento.sig` | Permisos de departamento para Documentos SIG. | Solo código |

Extensiones: `documents.folder`, `documents.document`, `res.users`.

## custom_activos_fijos

Detalle en [custom_activos_fijos → Modelos principales](modulos/custom_activos_fijos.md#modelos-principales).

| Modelo | Representa | Estado |
|---|---|---|
| `control.cambio.activo.fijo` | Una fila por cambio de un activo consumible (fecha, motivo, responsable, observación). | Documentado |
| `custom.activos.fijos` | Activo fijo. Lo extienden `custom_barcode_activos` y `custom_solicitudes`. | Solo `tipo_consumible` y `control_cambio_ids` documentados |
| `trazabilidad.activo.fijo` | Trazabilidad de responsable del activo. | Solo código |
| `disposicion.final.baja`, `estado.activo.fijo`, `marcacion.activo.fijo`, `clasificacion.activo.fijo` | Catálogos del activo. | Solo código |
| `equipos.de.medicion`, `herramientas.electricas`, `herramientas.neumaticas`, `herramientas.electrohidraulicas`, `equipos.computo`, `vehiculos`, `equipos.soldadura`, `muebles.enseres`, `equipos.neumaticos`, `equipos.etiquetado`, `equipos.fotograficos`, `maquinaria`, `herramientas.manuales`, `herramientas.maquinaria` | Fichas técnicas por tipo de activo (`models/fichas_tecnicas.py`). | Solo código |

## custom_empleados

Detalle en [custom_empleados → Modelos principales](modulos/custom_empleados.md#modelos-principales).

| Modelo | Representa | Estado |
|---|---|---|
| `hr.employee` (herencia) | ~30 campos propios de la v13 más `es_conductor_autorizado` (lee `fleet.personal.autorizado` de `custom_flota`). | Documentado |
| `hr.employee.familiar` | Familiares del empleado. | Documentado |

## custom_despachos

Detalle en [custom_despachos → Modelos principales](modulos/custom_despachos.md#modelos-principales).

| Modelo | Representa | Estado |
|---|---|---|
| `despachos.despacho` | Despacho. Una PQR es un registro del mismo modelo con `pqr_despacho_origen_id`. | Solo `state_id`, `city_id` y la relación PQR documentados |
| `despachos.despacho_linea_ot`, `despachos.despacho_relacion_general`, `despachos.despacho_embalaje_linea` | Líneas de OT, relación general y embalaje del despacho. | Solo código |
| `despachos.mp_embalaje`, `despachos.bd_embalaje`, `despachos.bd_embalaje_linea`, `despachos.producto_embalaje` | Catálogos de embalaje. | Solo código |
| `despachos.tipo_pago`, `despachos.tipo_transportadora`, `despachos.lugar_recogida`, `despachos.etapa`, `despachos.responsable`, `despachos.dia_recepcion`, `despachos.dia_recepcion_otro` | Catálogos del despacho. | Solo código |

## custom_compras

La página del módulo no documenta modelos: [custom_compras → Modelos principales](modulos/custom_compras.md#modelos-principales) dice "No aplica", porque los 3 commits de `digital18` solo tocan reportes.

| Modelo | Representa | Estado |
|---|---|---|
| `purchase.order.line` (herencia) | Agrega `requisition_item_id` (Many2one a `custom_requisiciones.material_electrico`) y lo propaga al `stock.move` en `_prepare_stock_moves`. Es el enlace OC → requisición que usa Recepción. | Solo código |
| `purchase.order` (herencia) | Extensión de la OC. | Solo código |
| `purchase.evaluation.proveedor`, `purchase.evaluation.logistica`, `purchase.evaluation.seleccion` y sus etapas | Evaluación y selección de proveedores. | Solo código |
| `purchase.date.log` | Reprogramaciones de fecha en líneas de OC. | Solo código |

## custom_clientes

Detalle en [custom_clientes → Modelos principales](modulos/custom_clientes.md#modelos-principales): el único cambio de `digital18` (`res.partner.correo_facturacion`) está comentado en el código.

| Modelo | Representa | Estado |
|---|---|---|
| `custom.partner.naturaleza`, `custom.partner.categoria` | Naturaleza y categoría del contacto. | Solo código |
| `res.partner`, `res.users`, `stock.picking`, `product.product`, `stock.warehouse`, `stock.move`, `account.move`, `account.move.line` (herencias) | Extensiones de otros autores. | Solo código |

## custom_reportes

No define modelos en uso: `models/models.py` está comentado. Ver [custom_reportes → Modelos principales](modulos/custom_reportes.md#modelos-principales).
