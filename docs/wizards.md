# Wizards

Índice de los wizards (`models.TransientModel`) de los 10 módulos. Los que tienen sección en la página del módulo enlazan a ella; el resto se describe desde el código de `changes_stock`.

Módulos **sin** wizards: `custom_sig`, `custom_documentos_sig`, `custom_compras`, `custom_reportes`, `custom_empleados`, `custom_activos_fijos` y `custom_despachos` (búsqueda de `TransientModel` en cada módulo, sin resultados).

## custom_barcode_activos

Detalle en [custom_barcode_activos → Wizards / vistas / JS relevantes](modulos/custom_barcode_activos.md#wizards-vistas-js-relevantes).

**Etiquetas RC y de producto**

| Wizard | Qué hace | Dominio |
|---|---|---|
| `rc.label.generator.wizard` (+ `.line`) | Genera etiquetas RC de una OC antes de recibir. `qty_to_generate` limitado a `qty_pendiente`. | Código RC / Recepción |
| `alist.label.generator.wizard` (+ `.line`) | Etiquetas propias de Alistamiento por línea de requisición, con ubicación y lote/serial congelados. | Código RC / Alistamiento |
| `inventory.count.wizard` (+ `.line`) | Inventario cíclico: cuenta y etiqueta unidades que ya están en bodega. | Código RC |
| `stock.picking.rc.label.mode.wizard` | Diseño de Etiquetas RC agrupadas desde el picking. | Código RC |
| `product.barcode.label.size.wizard` | Tamaño de la Etiqueta CTS de producto. | Código RC |
| `custom.barcode.label.layout` | Impresión de códigos de barras. No descrito en la página del módulo. | Etiquetas |
| `custom.qr.label.layout` | Impresión de QR GS1. No descrito en la página del módulo. | Etiquetas |

**Recepción, Alistamiento y Entrega**

| Wizard | Qué hace | Dominio |
|---|---|---|
| `reception.analytic.wizard` (+ `.line`) | Reparte la cantidad recibida entre OT cuando el producto tiene varias pendientes. Lo abre el patch JS de Recepción (`action_open_analytic_wizard_for_product`). | Recepción |
| `custom_requisiciones.alistar_comprar_wizard` | Reparte lo aprobado entre alistar y comprar; `cantidad_alistar + cantidad_comprar` debe ser igual a `aprobado`. Definido en `stock_alistamiento.py` con el namespace de `custom_requisiciones`. | Alistamiento |
| `wizard.rc.delivery` (+ `.line`) | Selección de unidades RC para un move de entrega (ruta de formulario, no la pantalla de escaneo). | Entrega |

**Consultas del escaneo global** (las abre `/stock_barcode/scan_from_main_menu`, ver [API interna](api.md#custom_barcode_activos))

| Wizard | Qué hace |
|---|---|
| `wizard.activo.scan.options` | Opciones al escanear un activo fijo. |
| `wizard.activo.operations` (+ `.line`) | Operaciones sobre el activo. No descrito en la página del módulo. |
| `wizard.canastilla.scan` (+ `.line`) | Información y reubicación de una canastilla escaneada. |
| `wizard.lot.rc.scan` (+ `.stock.line`) | Trazabilidad de un lote RC escaneado. |
| `wizard.producto.scan.options` (+ `.stock.line`) | Consulta de stock de un producto escaneado. |

**Otros**

| Wizard | Qué hace |
|---|---|
| `ubicacion.bodega.generator` | Generador de ubicaciones de canastilla. Definido en `models/ubicacion_bodega.py`. No descrito en la página del módulo. |

!!! note "Wizard retirado con vista todavía cargada"
    "Alistar por Reabastecimiento" se retiró en `7440f2e35`. `wizard/alistar_reabastecimiento_wizard_views.xml` sigue en el `data` del manifest, pero hoy solo contiene un comentario que explica el retiro.

## custom_solicitudes

Detalle breve en [custom_solicitudes → Wizards / vistas / JS](modulos/custom_solicitudes.md#wizards-vistas-js-relevantes). Esta tabla sale de `custom_solicitudes/wizards/`; la columna "Se abre desde" indica el método que crea el wizard.

**Aprobación de OLI/TIC** (`wizards/aprobacion_wizard.py`)

| Wizard | Qué hace | Se abre desde |
|---|---|---|
| `asignacion.aprobacion.wizard` (+ `asignacion.aprobacion.linea.wizard`) | Fija `cantidad_aprobada` por línea y crea o reutiliza el `stock.picking` OUT en borrador por almacén (`_crear_pickings_out`). Pasa la solicitud a Fase 2 (o Fase 3 con observaciones). | `asignacion.request.action_aprobar_oli` |
| `asignacion.marcador.wizard` (+ `.linea`) | Muestra todos los componentes de los kits (`mrp.bom`) de las líneas aprobadas para elegir cuáles se entregan. Los no elegidos quedan con `no_asignado` y motivo. | `action_confirmar_aprobacion` cuando hay kits |
| `asignacion.cambiar.estado.wizard` | Cambia el estado Nuevo/Usado de los productos seleccionados en el wizard de aprobación o de marcadores. | Wizard de aprobación o de marcadores |
| `asig.oli.firma.wizard` | Firma y confirmación para crear una solicitud OLI hija desde una TIC. Avisa si los productos ya están en otras OLI vinculadas. | `action_confirmar_aprobacion` con contexto `es_solicitar_oli` y tipo `tic` |
| `asignacion.activo.confirmacion.wizard` (+ `.linea`) | Confirma la reasignación de activos fijos que ya tienen responsable. | `asignacion.request.action_asignar_productos` |
| `asignacion.confirmar.ceros.wizard` | Confirma cantidades en cero antes de asignar. | `action_asignar_productos` |
| `asignacion.confirmar.origen.finalizado.wizard` | Confirma cuando la solicitud origen ya está finalizada. | `action_asignar_productos` |
| `asignacion.seleccion.cat.wizard` | Selección de productos por categoría. | Solo se encontró su vista en `aprobacion_wizard_views.xml`; ningún método Python lo crea por nombre. Punto de entrada pendiente de confirmar. |

**Devolución** (`wizards/devolucion_wizard.py`)

| Wizard | Qué hace |
|---|---|
| `devolucion.marcador.wizard` (+ `.linea`) | Selección de marcadores para devolución. |
| `devolucion.responsable.confirmacion.wizard` (+ `.linea`) | Confirma una devolución de activos cuyo responsable actual es otro empleado. Lo abre `asignacion.devolucion.action_validar_devolucion`. |
| `asignacion.kit.devolucion.wizard` (+ `.linea`) | Elige componentes de un kit para devolver; crea el `stock.picking` de devolución (`es_devolucion_asignacion=True`) por kit. |

**Otros**

| Wizard | Qué hace | Archivo |
|---|---|---|
| `asignacion.rechazo.wizard` | Rechazo de una solicitud con motivo. Lo abre `action_abrir_wizard_rechazo`. | `wizards/rechazo_wizard.py` |
| `asignacion.sst.wizard` (+ `.linea`), `asignacion.sst.empleados.wizard` | Asignación de EPP por SST y selección de empleados. | `wizards/sst_wizard.py` |
| `asignacion.empleado.report.wizard` | Exportar la ficha del empleado. | `wizards/exportar_ficha_wizard.py` |
| `asignacion.preview.gaf.wizard` | Previsualiza soportes GAF (OC, factura, remisión) guardados en Documents. | `wizards/preview_gaf_wizard.py` |

## custom_clientes

| Wizard | Qué hace | Estado |
|---|---|---|
| `res.partner.migrate.aprobado`, `.cliente`, `.proveedor`, `.naturaleza`, `.categoria` | Migración de campos de `res.partner`. Viven en `migrations/` y se importan desde `__init__.py`, así que se registran en cada carga del módulo. | Solo código; de otros autores, fuera del alcance de [custom_clientes](modulos/custom_clientes.md) |
