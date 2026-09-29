# custom_activos_fijos

2 commits de `digital18`, 2026-08-06 y 2026-08-11. Versión del manifest: `1.2`.

!!! note "Alcance de esta página"
    El módulo tiene 38 commits; 35 son de `digital7` y 1 de `digital6`. Esta página cubre solo la página Control de cambios que agregó `digital18`. El resto del módulo (estados, responsables, trazabilidad, fichas técnicas, catálogos) queda fuera.

## Visión general

Gestión de activos fijos (`custom.activos.fijos`). Depende de `base`, `hr`, `crm__customizado` y `contacts`. `custom_barcode_activos` depende de este módulo para los códigos de barras de activos.

Lo que agregó `digital18`: un campo **Consumible** en el activo y, cuando vale SI, una pestaña **Control de cambios** con una fila por cambio (fecha, motivo, responsable, observación).

## Qué problema resuelve

Los activos consumibles necesitan un registro de cambios propio, separado de la trazabilidad de responsable que ya existía (`trazabilidad.activo.fijo`). El mensaje de `214964bdd` no dice qué tipo de cambio se registra ni quién lo pidió.

## Arquitectura / componentes principales

| Pieza | Archivo | Rol |
|---|---|---|
| `custom.activos.fijos.tipo_consumible` | `models/activo_fijo.py` | `Selection` SI/NO con tracking; decide si se muestra la pestaña |
| `custom.activos.fijos.control_cambio_ids` | `models/activo_fijo.py` | One2many a `control.cambio.activo.fijo` |
| `control.cambio.activo.fijo` | `models/activo_fijo.py` | Una fila por cambio; hereda `mail.thread` y `mail.activity.mixin` |
| Pestaña "Control de cambios" y `view_form_control_cambio` | `views/activo_fijo_form.xml` | Lista no editable en línea + formulario propio |
| 4 líneas de ACL | `security/ir.model.access.csv` | Mismo patrón de 4 grupos que el resto del módulo |

## Procesos funcionales

1. En el activo, marcar **Consumible = SI** (primer grupo de datos generales).
2. Aparece la pestaña **Control de cambios**.
3. Agregar una fila: se abre el formulario `view_form_control_cambio` con Fecha de cambio, Motivo, Responsable y Observación, todos obligatorios.

## Evolución del módulo

??? abstract "Commits y archivos del capítulo (2 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `214964bdd` | 2026-08-06 | Agrega `tipo_consumible`, el modelo `control.cambio.activo.fijo` (fecha, cambio, motivo, responsable, observación), la pestaña y los permisos. |
    | `c5469fc7d` | 2026-08-11 | Fix: saca "Cambio" de tabla y formulario y le quita el `required`; "Fecha" pasa a requerida como "Fecha de cambio". Renombra a "Control de cambios" y sube `tipo_consumible` al primer grupo. |

    **Archivos:** `models/activo_fijo.py`, `security/ir.model.access.csv`, `views/activo_fijo_form.xml`

## Modelos principales

**`control.cambio.activo.fijo`**

| Campo | Tipo | Obligatorio | En la vista |
|---|---|---|---|
| `activo_fijo_id` | Many2one `custom.activos.fijos` | No | Implícito (One2many) |
| `fecha` | Date, "Fecha de cambio" | Sí | Sí |
| `cambio` | Text | No | Comentado |
| `motivo` | Text | Sí | Sí |
| `responsable_id` | Many2one `hr.employee` | Sí | Sí |
| `observacion` | Text | Sí | Sí |

Sin `_rec_name` desde `c5469fc7d` y sin campo `name`, así que el nombre que muestra Odoo para una fila es el genérico del modelo y el id.

## Wizards / vistas / JS relevantes

- Pestaña `Control de cambios` en el formulario del activo, `invisible="tipo_consumible != 'si'"`. El tree es `editable="false"`: cada fila se abre en `view_form_control_cambio` vía `form_view_ref`.
- `cambio` quedó como comentario XML en tree y formulario.

## Reglas de negocio

Solo los `required` del modelo. No hay constraints ni lógica en `create`/`write`.

La pestaña se oculta con `tipo_consumible != 'si'`, pero las filas no se borran. Si un activo pasa de SI a NO, su historial de cambios sigue en BD, solo que no se ve.

## Bugs y decisiones relevantes

| Tema | Causa raíz | Commit |
|---|---|---|
| "Cambio" obligatorio sin dónde diligenciarse | Según el mensaje del fix, el campo era `required=True` en el modelo pero ya no tenía dónde llenarse en tabla ni formulario, así que no se podía guardar ninguna fila. Se liberó el `required` y se hizo obligatoria la fecha. | `c5469fc7d` |

Era un bloqueo real de uso, no un ajuste visual. Una precisión sobre la evidencia: en el historial, `214964bdd` deja "Cambio" visible y requerido, y `c5469fc7d` lo oculta y le quita el `required` en el mismo diff. El estado roto (oculto y requerido a la vez) no quedó en ningún commit. Probablemente existió en el working tree o en la base de prueba entre ambos commits.

## Historial de commits

??? note "Ver los 2 commits en orden"

    | # | Commit | Fecha | Mensaje |
    |---|---|---|---|
    | 1 | `214964bdd` | 2026-08-06 | Agregar página Control de cambio para activos consumibles |
    | 2 | `c5469fc7d` | 2026-08-11 | Corregir control de cambios de activos consumibles |

## Pendientes / puntos por confirmar

- [ ] `fecha` pasó a `required` sin default ni migración. Si alguna fila creada entre el 6 y el 11 de agosto quedó sin fecha, Odoo no puede poner el `NOT NULL` en la columna al actualizar (solo lo avisa en el log). Revisar con `psql` si hay filas con `fecha` nula.
- [ ] Decidir si `cambio` se borra del modelo o vuelve a la vista. Hoy es una columna que nadie llena.
- [ ] `activo_fijo_id` no es obligatorio y usa el `ondelete` por defecto (`set null`): al borrar un activo, sus filas de control de cambios quedan huérfanas en BD.
- [ ] El modelo hereda `mail.thread` pero el formulario no tiene chatter; confirmar si se quiere historial de mensajes o sobra la herencia.
