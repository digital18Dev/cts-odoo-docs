# custom_reportes

1 commit de `digital18`, 2026-08-04. Versión del manifest: `0.1`.

!!! note "Alcance de esta página"
    El módulo tiene 12 commits; 11 son de otros autores (`digital6`, `digital7`, `root`), entre 2025-01 y 2025-12. El único commit de `digital18` es compartido con `custom_compras` y se narra completo en [custom_compras](custom_compras.md#bugs-y-decisiones-relevantes).

## Visión general

A pesar del nombre del archivo (`cts_external_layout.xml`), el módulo no es un layout genérico compartido entre reportes. Contiene **un** reporte: **Orden de Compra CTS** (`action_report_purchase_order_B`, modelo `purchase.order`, qweb-pdf), con plantilla `plantilla_externa_cts_orden_compra_1`. Es el imprimible de OC que usa bodega.

La plantilla arma su propio encabezado (logo, título "Orden de Compra" y código de barras) sobre `web.html_container`, sin pasar por el layout de la compañía. Renderiza cada OC en el idioma del proveedor (`o.with_context(lang=o.partner_id.lang)`).

El resto del módulo es el andamiaje del generador de Odoo: controlador, modelo y vistas comentados, `demo/demo.xml` sobre un modelo `custom_reportes.custom_reportes` que no existe.

## Qué problema resuelve

No aplica como página propia: el problema (escanear la OC impresa para abrir su recepción) se describe en [custom_compras](custom_compras.md#que-problema-resuelve).

## Arquitectura / componentes principales

| Pieza | Archivo | Rol |
|---|---|---|
| Reporte "Orden de Compra CTS" | `reportes/cts_external_layout.xml` | Plantilla + `ir.actions.report` ligado a `purchase.order` |
| Estilos | `static/src/scss/custom_report.scss` | Cargado en `web.report_assets_common` |
| `external_layout_cts_c` | `reportes/external_layout_cts.xml` | Plantilla de layout que **no** está en el `data` del manifest; no se carga |

## Procesos funcionales

No aplica: módulo de un solo commit, ver [custom_compras](custom_compras.md#procesos-funcionales).

## Evolución del módulo

`8d67310ee` movió aquí el código de barras de la OC, que el mismo día se había puesto por error en el reporte nativo. En el header de "Orden de Compra CTS":

- la celda derecha, antes vacía, ahora pinta un Code128 con valor `OC.<name>`;
- se quitaron los `padding-top`/`margin-top` de las tres celdas para que `align-items-center` alinee logo, título y código.

Causa raíz y decisiones: [custom_compras → Bugs y decisiones relevantes](custom_compras.md#bugs-y-decisiones-relevantes).

## Modelos principales

No aplica: el módulo no define modelos en uso (`models/models.py` está comentado).

## Wizards / vistas / JS relevantes

Solo el reporte QWeb descrito arriba. Sin wizards ni JS.

## Reglas de negocio

No aplica.

## Bugs y decisiones relevantes

Ver [custom_compras](custom_compras.md#bugs-y-decisiones-relevantes). Allí está el caso completo: el código se agregó primero al reporte equivocado y se corrigió en este módulo.

## Historial de commits

??? note "Ver el commit"

    | # | Commit | Fecha | Mensaje |
    |---|---|---|---|
    | 1 | `8d67310ee` | 2026-08-04 | Imprimir el código de la OC en el reporte que usa bodega (compartido con `custom_compras`) |

## Pendientes / puntos por confirmar

!!! warning "Dependencias no declaradas"
    El manifest declara solo `depends: ['base']`, pero `cts_external_layout.xml` usa `ref="purchase.model_purchase_order"` y carga el logo desde `/custom_compras/static/src/img/Logo.png`. Funciona porque en esta base `purchase` y `custom_compras` están instalados. En una instalación limpia el orden de carga no está garantizado. Es anterior a `8d67310ee`, no lo introdujo ese commit.

- [ ] Agregar `purchase` (y `custom_compras`, por el logo) a `depends`, o mover el logo a este módulo.
- [ ] Decidir si `reportes/external_layout_cts.xml` se borra o se carga; hoy es código muerto.
- [ ] Reemplazar `name`/`summary`/`description` del manifest, que siguen con el texto del generador.
