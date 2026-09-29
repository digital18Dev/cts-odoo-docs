# custom_compras

3 commits de `digital18`, todos el 2026-08-04. Versión del manifest: `1.1`.

!!! note "Alcance de esta página"
    El módulo tiene 63 commits en su historia; 60 son de otros autores (`digital6`, `digital7` y commits locales de `root`) y no aparecen aquí. Los 3 commits de `digital18` solo tocan reportes de la orden de compra. El resto del módulo (evaluación y selección de proveedores, evaluación logística, log de fechas, devolución de ítems de requisición al borrar una OC) queda fuera de esta página.

## Visión general

Personalización de compras sobre `purchase`. Depende de `purchase`, `product`, `l10n_co_edi`, `base`, `custom_requisiciones`, `stock` y `account`.

Lo que se documenta aquí es un solo tema: imprimir en la orden de compra un código de barras que bodega pueda escanear para abrir la recepción pendiente.

## Qué problema resuelve

Para recibir mercancía contra una OC, el operario de bodega tenía que buscar a mano el picking de entrada. Con el código de barras impreso, escanea la OC desde el menú principal de `stock_barcode` y salta directo a su recepción pendiente.

## Arquitectura / componentes principales

La funcionalidad cruza tres módulos:

| Pieza | Módulo | Rol |
|---|---|---|
| `_route_purchase_order` | `custom_barcode_activos` (`controllers/main.py`) | Reconoce el prefijo `OC.`, busca la OC visible para el usuario y abre su recepción `incoming` pendiente. Si hay varias, muestra la lista. Documentado en [custom_barcode_activos](custom_barcode_activos.md). |
| `report_purchaseorder_document_oc_titulo` | `custom_compras` (`report/purchase_order_barcode.xml`) | Hoy solo fija el título del reporte nativo en español. |
| Header de "Orden de Compra CTS" | `custom_reportes` (`reportes/cts_external_layout.xml`) | Imprime el Code128 con valor `OC.<name>`. Ver [custom_reportes](custom_reportes.md). |

El valor del código se arma en el QWeb (`'OC.%s' % o.name`) y se pinta con la ruta nativa `/report/barcode/Code128/...`. No se agregó ningún campo a `purchase.order`.

## Procesos funcionales

1. Compras imprime la OC con el reporte **Orden de Compra CTS**.
2. En bodega, el operario escanea el código del encabezado desde el menú principal de `stock_barcode`.
3. El controlador abre la recepción pendiente de esa OC, o la lista si hay más de una.

## Evolución del módulo

Los tres commits son del mismo día:

1. **11:10** (`a182ac982`): se agrega el código al reporte **nativo** de la OC, heredando `purchase.report_purchaseorder_document`. El mismo commit agrega el router en `custom_barcode_activos`.
2. **17:12** (`8d67310ee`): el código no salía impreso en el documento que usa bodega. Se mueve al header de "Orden de Compra CTS" en `custom_reportes`.
3. **17:13** (`8fefd7926`): limpieza de dos archivos de reporte que ningún manifest cargaba.

??? abstract "Commits y archivos del capítulo (3 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `a182ac982` | 2026-08-04 | Code128 `OC.<name>` en el reporte nativo de OC (`report/purchase_order_barcode.xml`) + router en `custom_barcode_activos`. |
    | `8d67310ee` | 2026-08-04 | Fix: mueve el código al reporte que usa bodega (`custom_reportes`); el XML de `custom_compras` queda solo con el título en español. |
    | `8fefd7926` | 2026-08-04 | Elimina `report/custom_purchase_report.xml` y `report/custom_purchase_report_templates.xml` (223 líneas sin cargar). |

    **Archivos:** `__manifest__.py`, `report/purchase_order_barcode.xml`, `report/custom_purchase_report.xml` (eliminado), `report/custom_purchase_report_templates.xml` (eliminado), `custom_reportes/reportes/cts_external_layout.xml`

## Modelos principales

No aplica: los 3 commits no tocan modelos. El valor del código sale de `purchase.order.name`.

## Wizards / vistas / JS relevantes

Solo reportes QWeb:

- `report/purchase_order_barcode.xml`: hereda `purchase.report_purchaseorder_document` y reemplaza el bloque `div.mt-4` con los tres títulos (Solicitud de cotización / Orden de compra / Orden de compra cancelada) fijos en español.
- `custom_reportes/reportes/cts_external_layout.xml`: celda derecha del header con el `<img>` del Code128.

## Reglas de negocio

- El código impreso es `OC.<name>`. El router de `custom_barcode_activos` exige ese prefijo (sin distinguir mayúsculas).
- `name` de la OC es único por la secuencia global `purchase.order`, así que no hace falta un campo propio (comentario en el XML).

## Bugs y decisiones relevantes

??? warning "Funcionalidad publicada rota y corregida el mismo día"
    `a182ac982` heredó `purchase.report_purchaseorder_document`, el reporte nativo de la OC. Pero el imprimible que usa bodega es **Orden de Compra CTS** (`custom_reportes.plantilla_externa_cts_orden_compra_1`). Esa plantilla arma su propio encabezado sobre `web.html_container` y nunca pasa por el layout nativo, así que el código no salía en el papel que llega a bodega. El escaneo de OC quedó sin uso real unas seis horas, hasta `8d67310ee`, que movió el código al header de esa plantilla.

    Lección para el sucesor: antes de heredar un reporte, confirmar con el usuario cuál imprime de verdad. Esta OC tiene al menos dos (el nativo y "Orden de Compra CTS").

**Decisiones**

- **Tabla en vez de flexbox** (`a182ac982`). Con `display:flex`, wkhtmltopdf bajaba el código a otra línea debajo del título. En la plantilla CTS final no hizo falta: la fila ya usa `row align-items-center` de Bootstrap.
- **Sin paddings verticales en las celdas del header** (`8d67310ee`). Se quitaron los `padding-top`/`margin-top` de logo, título y código; el `align-items-center` de la fila es el que los alinea. Un comentario en el XML advierte que volver a agregarlos los desalinea.
- **El título del reporte nativo queda fijo en español** (`8d67310ee`). Efecto colateral del fix: el XML de `custom_compras` ya no pinta el código, pero sigue reemplazando el bloque de título. El nativo depende del idioma del proveedor (`o.partner_id.lang`), lo que hacía que unas OC salieran en inglés y otras en español. Si el core cambia esas condiciones de estado, hay que sincronizarlas a mano.

## Historial de commits

??? note "Ver los 3 commits en orden"

    | # | Commit | Fecha | Mensaje |
    |---|---|---|---|
    | 1 | `a182ac982` | 2026-08-04 | Escanear código de OC para saltar a recepción pendiente |
    | 2 | `8d67310ee` | 2026-08-04 | Imprimir el código de la OC en el reporte que usa bodega |
    | 3 | `8fefd7926` | 2026-08-04 | Eliminar reportes de compra sin usar |

`8d67310ee` también modifica `custom_reportes` y cuenta en su historial.

## Pendientes / puntos por confirmar

- [ ] Confirmar con compras que el título fijo en español del reporte nativo es deseado, o si ese reporte ya no se usa y la herencia sobra.
- [ ] `custom_compras` no declara `custom_reportes` en `depends`, ni al revés, aunque el código del reporte CTS existe para la funcionalidad de este módulo. Ver dependencias en [custom_reportes](custom_reportes.md#pendientes-puntos-por-confirmar).
