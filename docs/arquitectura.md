# Arquitectura Odoo

Panorama general. El detalle vive en las páginas enlazadas — esta página no lo duplica.

## Entorno

Contenedores `odoo_dev` (Odoo 17 + Enterprise) y `db` (`postgres:14.0`), más `pgadmin` y `mailpit` aparte. Único ambiente en uso real: `neutralize_21_05`. `workers = 0` (ver [ADR-09](adr.md#adr-09-impresion-zpl-por-zebra-browser-print) y la nota de logs en `CLAUDE.md` del repo).

## Módulos vs. procesos

`digital18` tocó 10 addons custom en `changes_stock` (ver [Módulos](modulos/index.md)). Tres de ellos no son módulos sino **procesos funcionales** dentro de `custom_barcode_activos` — Recepción, Alistamiento, Entrega/Devolución — más un cuarto dominio del mismo módulo, Código único RC/etiquetas, que no tiene página de proceso propia porque no cruza otros módulos. Detalle en [Guía de navegación](guia.md#modulos-vs-procesos).

## Catálogo e inventario

El catálogo y el stock ya son el `product.product` / `stock.quant` nativos de Odoo, no un catálogo propio. La migración que lo hizo está **completada**, no en curso — ver [ADR-03](adr.md#adr-03-catalogo-y-stock-propios-reemplazados-por-inventario-nativo) para la evidencia (commits, grep sin resultados) y los restos menores que quedan.

## Decisiones de arquitectura

Las 12 decisiones verificadas, con su contexto y su costo, están en [ADR](adr.md). Entre las más transversales:

- [ADR-01](adr.md#adr-01-invariantes-del-dato-en-servidor-comandos-en-action_) — invariantes del dato en servidor, comandos explícitos en `action_*`.
- [ADR-02](adr.md#adr-02-custom_barcode_activos-extiende-custom_requisiciones-sin-editarlo) — `custom_barcode_activos` nunca edita `custom_requisiciones`, solo lo extiende por `_inherit`.
- [ADR-04](adr.md#adr-04-custom_asignaciones-renombrado-a-custom_solicitudes) — `custom_asignaciones` (vacío hoy) se renombró a `custom_solicitudes`.

## Cómo cruzan los módulos

Los recorridos reales (asignación de productos, requisición → bodega → entrega, OC impresa → escaneo, activo fijo) están dibujados con diagramas en [Flujos funcionales](flujos.md), no aquí — para no mantener el mismo diagrama en dos páginas.
