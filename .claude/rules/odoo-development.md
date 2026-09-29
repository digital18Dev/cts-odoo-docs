---
paths:
  - "odoo/custom_addons/**/*.py"
  - "odoo/custom_addons/**/*.xml"
  - "odoo/custom_addons/**/*.js"
  - "odoo/custom_addons/**/*.scss"
  - "odoo/custom_addons/**/__manifest__.py"
---

# Odoo 17 — reglas con evidencia verificada

## Revisión de patrón

Cambio sigue patrón repetido → auditar TODAS las ocurrencias relevantes del mismo dominio.

- **Antes:** buscar patrón en módulo completo.
- **Durante:** restricción real descubierta puede invalidar decisión ya tomada.
- **Después:** barrer demás ocurrencias y reportar resultado aunque salga limpio.

Si el defecto pertenece a otro dominio funcional, documentarlo y trasladarlo. No corregir incidentalmente salvo bloqueo directo o autorización.

## Efectos secundarios: invariante vs comando

Precedente real: notificación de priorización NCI colgaba de `action_toggle_priorizado`, pero `priorizado` era una casilla editable; editar el campo saltaba el método y no notificaba.

Regla:
- invariante del dato → servidor (`create`/`write`/constraint según corresponda);
- acción explícita de negocio → método de comando.

Antes de colgar un efecto de `action_*`, revisar vistas por:
- `readonly` condicional;
- `statusbar` clickable;
- tree editable;
- RPC/importación.

## Borrar un campo stored borra su columna

Evidencia:
- `ir_model.py:968` → `unlink()` llama `_drop_column()`.
- `migration.py:215` exige `installed < version <= current` con `<` estricto.
- Único punto donde coexisten tabla nueva y columnas viejas: `post-migrate`.
- En `odoo/modules/loading.py`, `load_data` corre antes que post-migrate (precedente verificado: 229 vs 234).
- Hay `cr.commit()` en la ruta de migración verificada, por lo que lo escrito por post-migrate puede sobrevivir a un fallo posterior.

Precedente real: `externo_nombre` / `externo_email` se perdieron en dev por subir sin migración.

Regla:
- si hay dato persistente, migración en el MISMO commit que elimina/mueve el campo;
- subir versión del manifest;
- no confiar en script cuya versión ya está instalada.

## x2many: create/delete dinámicos

### Incorrecto: atributo suelto en `<field>`

`<field name="x" create="...">` se ignora.

Evidencia:
- `x2many_field.js:284-295` (`extractProps`) toma `add-label`, `options`, `widget`, `string`; `create`/`delete` sueltos quedan en attrs y nadie los lee.

### Correcto: `options` con dominio

```xml
<field name="x"
       options="{'create': [('mi_flag','=',True)],
                 'delete': [('mi_flag','=',True)]}"/>
```

Evidencia:
- `crudOptions = options`;
- `relational_utils.js:127` → `new Domain(action).contains(evalContext)`;
- `domain.js:257` revienta con `InvalidDomainError` si se pasa un nombre pelado en vez de dominio lista;
- precedentes core: `mrp/views/mrp_production_views.xml:364` y `:419`.

### `<tree>` / `<kanban>`

`create`/`delete` ahí son booleanos estáticos.

Evidencia:
- `utils.js:163` llama `archParseBoolean`;
- `utils.js:48`: cualquier cadena que no empiece por `false` ni termine en `0` puede evaluarse truthy.

Precedente inerte:
- `views/views.xml:1207` tenía `delete="fase_devolucion != 'validado'"`; esa expresión no se evalúa dinámicamente.
- No hacía daño porque el `<field>` ya estaba readonly en validado.

### `parent.`

Evidencia:
- `record.js:51-55` monta getter de parent;
- `static_list.js:96` lo propaga.

Si una regla depende de `parent.flag`, el campo del padre debe estar presente en la vista; sin él puede llegar `undefined` y bloquear silenciosamente.

## Datos XML / `noupdate`

Precedente `asignacion.responsable`:
- 9 registros en `data/categories.xml`.
- Sin `noupdate="1"` se reescribían en cada upgrade.
- El `write` disparaba constraints y una fila sucia podía abortar el upgrade completo.
- Fallo real: `ParseError ... categories.xml:23`.
- Un `post-migrate` NO puede reparar ese caso porque `load_data` corre antes.

Regla: antes de añadir constraints sobre registros de data XML, revisar si el upgrade los reescribe.

## Correos en `Char`

`EMAIL_RE.match` no ancla final y puede aceptar cosas indebidas; usar `fullmatch`.

`email_normalize` complementa pero no reemplaza la validación:
- puede devolver `False` para entradas con coma;
- también puede transformar entradas ambiguas.

Si el campo representa un solo correo:
- no aceptar lista por comas;
- normalizar antes de aplicar unicidad cuando corresponda.
