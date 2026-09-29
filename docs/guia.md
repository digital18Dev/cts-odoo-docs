# Guía de navegación

Este sitio documenta el trabajo de `digital18@industriascts.com.co` sobre `odoo-docker` (rama `changes_stock`) para la entrega de cargo. No es documentación de Odoo en general: cada página cita el commit, el archivo o la línea de código real que respalda lo que dice. Donde no hay evidencia suficiente, la página lo dice ("pendiente de documentar") en vez de inventar.

## Módulos vs. procesos

Distinción que se mantiene en todo el sitio:

- **Módulo** = un addon de `odoo/custom_addons/` (`custom_barcode_activos`, `custom_sig`, etc.). Ver [Módulos](modulos/index.md).
- **Proceso** = un flujo funcional (Recepción, Alistamiento, Entrega/Devolución). Los tres viven **dentro** de `custom_barcode_activos`, no son módulos aparte. Las páginas de [Procesos](procesos/recepcion.md) son solo el punto de entrada; el contenido real está en la sección del módulo y en [Flujos funcionales](flujos.md).

## Cómo leer una página de módulo

Las 10 páginas de [Módulos](modulos/index.md) siguen la misma estructura: Visión general, Qué problema resuelve, Arquitectura, Procesos funcionales, Evolución del módulo (los commits agrupados por tema, no en crudo), Modelos, Wizards/Vistas/JS, Reglas de negocio, Bugs y decisiones, Historial de commits, Pendientes. Si una sección no tiene evidencia para ese módulo, queda dicho ahí mismo en vez de rellenarse.

## Páginas de referencia (cruzan módulos)

- [Modelos](modelos.md) / [Wizards](wizards.md) / [Vistas](vistas.md) — índice técnico por tipo de artefacto, con link a la sección del módulo dueño. Vistas incluye además las trampas de Odoo 17 ya verificadas en este proyecto.
- [Flujos funcionales](flujos.md) — los recorridos que cruzan varios módulos (asignación, requisición→bodega, OC→escaneo, activos fijos).
- [ADR](adr.md) — decisiones de arquitectura ya tomadas, con contexto, decisión y consecuencia.
- [API interna](api.md) — métodos y rutas que otro módulo, el JS o un cron llaman por diseño.
- [Historial técnico](historial.md) — dónde está el listado crudo de los 122 commits.

## Arquitectura

Para el panorama general (entorno, taxonomía, enlaces a las 12 decisiones de arquitectura) ver [Arquitectura Odoo](arquitectura.md).
