# Vistas

Dos partes: las trampas de Odoo 17 que ya costaron un fallo real en este proyecto, y un índice de vistas y JS notables por módulo.

## Trampas de Odoo 17 verificadas

Fuente: `.claude/rules/odoo-development.md` del repositorio `odoo-docker`. Cada regla trae su evidencia en el código core de Odoo 17 y un precedente del proyecto. No se agregó nada que no esté en ese archivo.

### x2many: `create` / `delete` dinámicos

**Incorrecto: atributo suelto en `<field>`.** `<field name="x" create="...">` se ignora.

- `x2many_field.js:284-295` (`extractProps`) toma `add-label`, `options`, `widget` y `string`. `create`/`delete` sueltos quedan en attrs y nadie los lee.

**Correcto: `options` con dominio.**

```xml
<field name="x"
       options="{'create': [('mi_flag','=',True)],
                 'delete': [('mi_flag','=',True)]}"/>
```

- `crudOptions = options`.
- `relational_utils.js:127` evalúa con `new Domain(action).contains(evalContext)`.
- `domain.js:257` revienta con `InvalidDomainError` si se pasa un nombre pelado en vez de un dominio en lista.
- Precedentes en core: `mrp/views/mrp_production_views.xml:364` y `:419`.

**En `<tree>` / `<kanban>`, `create`/`delete` son booleanos estáticos.**

- `utils.js:163` llama a `archParseBoolean`.
- `utils.js:48`: cualquier cadena que no empiece por `false` ni termine en `0` puede evaluarse como verdadera.

!!! note "Precedente inerte en `custom_solicitudes`"
    `views/views.xml:1207` tenía `delete="fase_devolucion != 'validado'"` en un `<tree>`. Esa expresión no se evalúa de forma dinámica. No hacía daño porque el `<field>` ya estaba readonly en validado.

**`parent.` en expresiones de la línea.**

- `record.js:51-55` monta el getter de `parent`.
- `static_list.js:96` lo propaga.

Si una regla depende de `parent.flag`, el campo del padre debe estar en la vista. Sin él puede llegar `undefined` y bloquear en silencio.

### Datos XML y `noupdate`

Precedente `asignacion.responsable` (`custom_solicitudes`):

- 9 registros en `data/categories.xml`.
- Sin `noupdate="1"` se reescribían en cada upgrade.
- Ese `write` disparaba los constraints, y una fila sucia podía abortar el upgrade completo.
- Fallo real: `ParseError ... categories.xml:23`.
- Un `post-migrate` **no** puede reparar ese caso, porque `load_data` corre antes.

!!! warning "Regla"
    Antes de añadir constraints sobre registros de data XML, revisar si el upgrade los reescribe.

### Borrar un campo stored borra su columna

- `ir_model.py:968`: `unlink()` llama a `_drop_column()`.
- `migration.py:215` exige `installed < version <= current`, con `<` estricto.
- El único punto donde coexisten la tabla nueva y las columnas viejas es `post-migrate`.
- En `odoo/modules/loading.py`, `load_data` corre antes que `post-migrate` (precedente verificado: 229 vs 234).
- Hay `cr.commit()` en la ruta de migración verificada, así que lo que escribe `post-migrate` puede sobrevivir a un fallo posterior.

Precedente real: `externo_nombre` / `externo_email` (`asignacion.responsable`) se perdieron en dev por subir sin migración.

!!! warning "Regla"
    - Si hay dato persistente, la migración va en el **mismo** commit que elimina o mueve el campo.
    - Subir la versión del manifest.
    - No confiar en un script cuya versión ya está instalada.

Casos del mismo patrón en las páginas de módulo: [custom_documentos_sig](modulos/custom_documentos_sig.md#2-ente-certificador-de-selection-a-many2one-25-jun) (ente certificador sin script de migración) y [custom_clientes](modulos/custom_clientes.md#bugs-y-decisiones-relevantes) (campo comentado antes de tener columna en producción).

### Correos en campos `Char`

- `EMAIL_RE.match` no ancla el final y puede aceptar entradas indebidas: usar `fullmatch`.
- `email_normalize` complementa pero no reemplaza la validación: puede devolver `False` para entradas con coma y también puede transformar entradas ambiguas.

Si el campo representa un solo correo:

- no aceptar lista separada por comas;
- normalizar antes de aplicar unicidad, cuando corresponda.

### Efectos secundarios: invariante o comando

No es una trampa de vista, pero nace de una: la notificación de priorización NCI colgaba de `action_toggle_priorizado`, y `priorizado` era una casilla editable en el formulario. Editar la casilla saltaba el método y no notificaba.

- Invariante del dato → servidor (`create` / `write` / constraint, según corresponda).
- Acción explícita de negocio → método de comando.

Antes de colgar un efecto de un `action_*`, revisar en las vistas:

- `readonly` condicional;
- `statusbar` clicable;
- tree editable;
- RPC e importación.

Otro caso del mismo patrón: el statusbar clicable de [custom_sig](modulos/custom_sig.md#bugs-y-decisiones-relevantes), que permite retroceder o saltar fases sin pasar por la validación de `write()`.

## Vistas y JS notables por módulo

| Módulo | Pieza | Tipo | Nota | Detalle |
|---|---|---|---|---|
| `custom_barcode_activos` | `patches/barcode_ui_patch.js` | Patch OWL de `stock_barcode` | Agrupación por OT/proyecto/producto, escaneo RC en vivo, gate de Rastreo. Reimplementa `BarcodeModel.validate()` sin `super()`. | [Wizards / vistas / JS](modulos/custom_barcode_activos.md#wizards-vistas-js-relevantes) |
| `custom_barcode_activos` | `patches/reception_analytic_patch.js` | Patch OWL | Distribución analítica y validación RC en pickings de salida. | [Wizards / vistas / JS](modulos/custom_barcode_activos.md#wizards-vistas-js-relevantes) |
| `custom_barcode_activos` | `recepcion_oc_list.js`, `recepcion_toolbar.js` | Lista OWL | Lista de OC de Recepción, píldoras de filtro, impresión y reimpresión. | [Recepción](modulos/custom_barcode_activos.md#recepcion) |
| `custom_barcode_activos` | `alistamiento_scan.js` | Client action | Pantalla de Alistamiento: fases, ubicación, escaneo, preview y confirmación. | [Alistamiento](modulos/custom_barcode_activos.md#alistamiento) |
| `custom_barcode_activos` | `entrega_devolucion.js` | Client action | Pantalla única de Entrega y Devolución. | [Entrega/Devolución](modulos/custom_barcode_activos.md#entregadevolucion) |
| `custom_barcode_activos` | `recepcion_perfil_tabs.js`, `recepcion_perfil_state.js` | Componente OWL | Pestañas "Fase N" según `recepcion.perfil`. | [Wizards / vistas / JS](modulos/custom_barcode_activos.md#wizards-vistas-js-relevantes) |
| `custom_barcode_activos` | `cts_date_range_calendar.js` | Componente OWL | Calendario de rango compartido por Recepción, Alistamiento y Entrega. | [Wizards / vistas / JS](modulos/custom_barcode_activos.md#wizards-vistas-js-relevantes) |
| `custom_barcode_activos` | `rc_label_lines_list.js`, `alist_label_lines_list.js`, `rc_reprint_lines_list.js`, `browserprint_utils.js` | JS de impresión | El servidor crea y devuelve datos planos; el cliente manda ZPL a la Zebra o abre el PDF. | [Etiquetas CTS/RC](modulos/custom_barcode_activos.md#etiquetas-ctsrc) |
| `custom_barcode_activos` | `solicitudes_bodega.js` | Client action | Tablero retirado en `7440f2e35`: el menú se quitó, pero el JS sigue en `web.assets_backend` y la acción `action_solicitudes_bodega` se conserva (comentario en `views/menus.xml`). | [Alistamiento](modulos/custom_barcode_activos.md#alistamiento) |
| `custom_solicitudes` | `seleccion_kanban.js` | Vistas registradas (`seleccion_kanban`, `seleccion_list`, `seleccion_list_general`) | Selección de productos sobre `asignacion.producto.seleccion`; confirma con `action_confirmar_seleccion`. | Solo código |
| `custom_solicitudes` | `marcador_wizard.js` | Vistas registradas (`marcador_wizard_list`, `marcador_devolucion_wizard_list`) | Listas de los wizards de marcadores; botón que llama `action_omitir_marcadores`. | Solo código |
| `custom_solicitudes` | `views/stock_picking_asignacion.xml` | Herencia de `stock.view_picking_form` | Firmas `firma_asignacion_empleado` y `firma_recibido_devolucion`, exigidas por `button_validate`. | Solo código |
| `custom_sig` | Formulario de `sig.accion.correctiva` | Form | Statusbar **clicable**; campos de Registro `readonly="state != 'registro'"` con `force_save`. | [Wizards / vistas / JS](modulos/custom_sig.md#wizards-vistas-js-relevantes) |
| `custom_sig` | `help_modal.js`, `help_examples.js` | Widget OWL `sig_help_modal` | Modal de ejemplos con registries abiertos (`sig_help_examples`, `sig_help_renderers`). | [Wizards / vistas / JS](modulos/custom_sig.md#wizards-vistas-js-relevantes) |
| `custom_documentos_sig` | `views/acta_de_reuniones.xml`, `views/formato_dpto.xml`, `views/documentos_views.xml` | Search / list / form | Filtro de firma pendiente por aprobador; `default_order="rango_dpto"`; código de versión readonly. | [Wizards / vistas / JS](modulos/custom_documentos_sig.md#wizards-vistas-js-relevantes) |
| `custom_compras` | `report/purchase_order_barcode.xml` | Reporte QWeb | Hereda el reporte nativo de OC; hoy solo fija el título en español. | [Wizards / vistas / JS](modulos/custom_compras.md#wizards-vistas-js-relevantes) |
| `custom_reportes` | `reportes/cts_external_layout.xml` | Reporte QWeb | "Orden de Compra CTS", con el Code128 `OC.<name>` en el header. | [Wizards / vistas / JS](modulos/custom_reportes.md#wizards-vistas-js-relevantes) |
| `custom_empleados` | `views/hr_employee_view_inherit.xml` | Herencia de `hr.view_employee_form` | `required="discapacitado == 'si'"` solo en la vista; tree editable de familiares. | [Wizards / vistas / JS](modulos/custom_empleados.md#wizards-vistas-js-relevantes) |
| `custom_activos_fijos` | Pestaña "Control de cambios" | Form | `invisible="tipo_consumible != 'si'"`; tree `editable="false"` con `form_view_ref`. | [Wizards / vistas / JS](modulos/custom_activos_fijos.md#wizards-vistas-js-relevantes) |
| `custom_despachos` | `view_despacho_form_pqr` | Form | `state_id`/`city_id` readonly: el cliente no los envía al guardar, por eso `create()` los copia en servidor. | [Bugs y decisiones](modulos/custom_despachos.md#bugs-y-decisiones-relevantes) |
| `custom_clientes` | `views/views.xml` | Herencia de `res.partner` | El `xpath` de `correo_facturacion` está comentado. | [Wizards / vistas / JS](modulos/custom_clientes.md#wizards-vistas-js-relevantes) |
