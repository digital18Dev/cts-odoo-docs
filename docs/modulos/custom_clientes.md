# custom_clientes

3 commits de `digital18`, 2026-06-30 y 2026-07-03. Versión del manifest: `0.1`.

!!! note "Alcance de esta página"
    `git log` del módulo muestra 25 commits; 22 son de otros autores (`digital6`, `digital7`, `root`) y no se describen aquí: clasificación de naturaleza/categoría del cliente, validaciones de identificación, extensiones de `res.users` y `stock.picking`. Existe además un cuarto commit de `digital18` con el mismo contenido que uno de los tres (ver [Bugs y decisiones](#bugs-y-decisiones-relevantes)).

## Visión general

Personalización de contactos (`res.partner`) para clientes y proveedores. Depende de `base`, `contacts`, `account_accountant` y `stock`.

Los commits de `digital18` agregan un campo de correo de facturación y, tres días después, lo desactivan. **Hoy el campo no existe**: modelo, constraint y vista están comentados en `changes_stock`.

## Qué problema resuelve

`9afa7faf0` agregó un correo de facturación opcional, separado del correo principal del contacto. El mensaje del commit no dice quién lo pidió ni para qué proceso.

## Arquitectura / componentes principales

| Pieza | Archivo | Estado actual |
|---|---|---|
| `res.partner.correo_facturacion` (Char) | `models/custom_campos.py` | Comentado |
| `_check_correo_facturacion_distinto` (`@api.constrains`) | `models/custom_campos.py` | Comentado |
| Campo en el formulario, después de `website`, widget `email` | `views/views.xml` | Comentado |

## Procesos funcionales

No aplica: el campo está desactivado.

## Evolución del módulo

??? abstract "Commits y archivos del capítulo (3 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `9afa7faf0` | 2026-06-30 | Agrega `correo_facturacion` en `res.partner`, en el grupo de contacto del formulario, con constraint. |
    | `5e332de6c` | 2026-07-03 | Comenta el campo en el modelo y el `xpath` de la vista. |
    | `d244497ff` | 2026-07-03 | Comenta el constraint, que seguía activo y referenciaba el campo ya comentado. |

    **Archivos:** `models/custom_campos.py`, `views/views.xml`

## Modelos principales

Ningún cambio vigente. Mientras existió, el campo fue `correo_facturacion = fields.Char(string="Correo electrónico de facturación")` en `res.partner`.

## Wizards / vistas / JS relevantes

Ninguno vigente. El `xpath` que ubicaba el campo junto a `website` está comentado en `views/views.xml`.

## Reglas de negocio

Ninguna vigente. La regla que existió: si `correo_facturacion` y `email` estaban llenos, no podían ser iguales (comparación con `strip().lower()`).

??? note "No era unicidad entre clientes"
    El título de `9afa7faf0` dice "validación de unicidad", pero el constraint solo comparaba los dos correos **del mismo contacto**. No impedía que dos clientes tuvieran el mismo correo de facturación.

## Bugs y decisiones relevantes

!!! warning "Reversión sin causa raíz documentada — preguntar en la entrevista de handoff"
    El campo se agregó el 30 de junio y se desactivó el 3 de julio. Los dos commits de desactivación tienen el mismo mensaje ("se comenta el campo de correo de facturacion") y ninguno explica el motivo en el mensaje.

    La única pista está en el código: sobre el campo comentado quedó la línea `#pendiente por actualizar el módulo en producción para agregar este campo a la bd`. Eso sugiere que el campo llegó al código antes de que producción tuviera la columna, y se desactivó para no romper la carga. No dice quién decide la actualización ni cuándo.

    La segunda pasada del mismo día confirma que la primera quedó incompleta: `5e332de6c` comentó el campo y la vista, pero dejó vivo el `@api.constrains('correo_facturacion', 'email')`. Odoo 17 solo registra un warning al cargar ("@constrains parameter ... is not a field name"), pero el constraint seguía disparándose al cambiar `email` y leía `partner.correo_facturacion`, que ya no existía: guardar el correo de un contacto habría fallado con `AttributeError`. `d244497ff` lo corrigió.

    Preguntar al autor: por qué se desactivó, si producción ya se actualizó y si el campo debe volver.

**Commit duplicado.** Existe un cuarto commit, `ab51aae72`, con el mismo mensaje, autor, fecha y diff que `d244497ff`, pero con otro padre: el merge del PR #349 (`f036a6935`). La segunda pasada se commiteó dos veces, una en la rama y otra encima del merge. Ambos están en `changes_stock` y no cambian nada entre sí. `git log` simple del módulo oculta uno de los dos; `git log --full-history` muestra los cuatro.

## Historial de commits

??? note "Ver los 3 commits en orden"

    | # | Commit | Fecha | Mensaje |
    |---|---|---|---|
    | 1 | `9afa7faf0` | 2026-06-30 | Agregar correo de facturación en cliente con validación de unicidad |
    | 2 | `5e332de6c` | 2026-07-03 | Se comenta el campo de correo de facturación (modelo + vista) |
    | 3 | `d244497ff` | 2026-07-03 | Se comenta el campo de correo de facturación (constraint) |

Duplicado de #3: `ab51aae72` (mismo diff, padre `f036a6935`).

## Pendientes / puntos por confirmar

- [ ] Confirmar con el autor el motivo de la reversión y si producción ya tiene la columna.
- [ ] Si el campo vuelve: descomentar modelo, constraint y vista juntos; actualizar el módulo en producción en el mismo despliegue.
- [ ] Si vuelve, decidir si la regla debe ser también unicidad entre contactos, como sugería el título original, y validar formato con `fullmatch` (regla de correos en `.claude/rules/odoo-development.md`).
- [ ] Si no vuelve, borrar el código comentado.
