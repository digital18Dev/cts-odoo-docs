# Documentación Odoo

Portal técnico y funcional de Odoo y sus procesos relacionados.

Este sitio deja constancia del trabajo realizado sobre `odoo-docker` (rama `changes_stock`) para facilitar la entrega del cargo: qué módulos se tocaron, qué procesos cambiaron y por qué.

## Resumen

| | |
|---|---|
| Módulos custom con cambios | 10 |
| Procesos documentados | 3 (Recepción, Alistamiento, Entrega) |
| Commits analizados | 122 |
| Rango de fechas | 2026-05-27 → 2026-09-24 |

## Explorar por procesos

- [Recepción](procesos/recepcion.md) — recepción de mercadería, registro de OC y control de ingresos.
- [Alistamiento](procesos/alistamiento.md) — preparación, separación y asignación de materiales.
- [Entrega](procesos/entrega.md) — entrega, devoluciones y control de pickings.

## Explorar por módulos

Ver el [resumen de módulos](modulos/index.md) para la lista completa con el número de commits de cada uno.

## Accesos rápidos

- [Modelos](modelos.md) — índice de todos los modelos custom, por módulo.
- [Wizards](wizards.md) — índice de wizards, por módulo.
- [Vistas](vistas.md) — trampas de Odoo 17 ya verificadas en este proyecto + JS notable por módulo.
- [Flujos funcionales](flujos.md) — los recorridos que cruzan varios módulos.
- [ADR](adr.md) — decisiones de arquitectura, con contexto y consecuencia.
- [API interna](api.md) — métodos y rutas que otro módulo o el JS llaman por diseño.

## Empezar

¿Primera vez aquí? Ve a la [guía de navegación](guia.md).
