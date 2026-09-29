# custom_empleados

3 commits de `digital18`, 2026-06-12 → 2026-07-03. Versión del manifest: `1.0`.

Módulo creado por `digital18`: los 3 commits son toda su historia.

## Visión general

Extiende la ficha de empleado (`hr.employee`) con los campos personalizados que existían en la versión 13 de Odoo, más un submodelo de familiares y un indicador de conductor autorizado que viene de flota. Depende de `hr`, `base_address_extended` (por `res.city`) y `custom_flota`.

## Qué problema resuelve

Al migrar a Odoo 17 se perdieron los campos propios de empleado de la v13: datos de ciudadanía, emergencia, educación, dotación y seguridad social. Este módulo los reconstruye sobre la pestaña Información Privada.

## Arquitectura / componentes principales

| Pieza | Archivo | Rol |
|---|---|---|
| `hr.employee` (herencia) | `models/hr_employee.py` | ~30 campos propios + `es_conductor_autorizado` |
| `hr.employee.familiar` | `models/hr_employee_familiar.py` | Familiares del empleado (One2many `familiar_ids`) |
| Vista heredada de `hr.view_employee_form` | `views/hr_employee_view_inherit.xml` | Ubica los campos por grupo y reorganiza en 2 columnas con `xpath` `move`/`attributes` |
| Categoría + 4 grupos jerárquicos | `security/empleados_groups.xml` | Solo lectura → sin crear/borrar → usuario → administrador (`implied_ids`) |
| ACL de `hr.employee.familiar` | `security/ir.model.access.csv` | Una línea por grupo |

## Procesos funcionales

No aplica más allá de diligenciar la ficha: el módulo agrega campos, no flujos.

## Evolución del módulo

??? abstract "Commits y archivos del capítulo (3 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `c6f5ca010` | 2026-06-12 | Crea el módulo: campos de `hr.employee`, modelo `hr.employee.familiar`, grupos, ACL y vista. |
    | `70a6591ec` | 2026-06-16 | Agrega el campo computado Conductor Autorizado; suma `custom_flota` a `depends`; reordena el formulario (Seguridad Social después de Dotación). |
    | `a3c0b8ed1` | 2026-07-03 | Renombra la categoría y los 4 grupos. |

    **Archivos:** `__init__.py`, `__manifest__.py`, `models/__init__.py`, `models/hr_employee.py`, `models/hr_employee_familiar.py`, `security/empleados_groups.xml`, `security/ir.model.access.csv`, `views/hr_employee_view_inherit.xml`

??? note "`a3c0b8ed1` es un commit de cierre de PR"
    Su mensaje también menciona `.gitignore`, `Modelfile` y la reubicación de un documento de widget a `custom_sig`. Nada de eso pertenece a este módulo. Aquí solo cambió `security/empleados_groups.xml`: categoría "Gestión Familiar Empleado (Custom)" → "Custom empleados", y grupos "Familiar Empleado (...)" → "Usuario de Empleado Custom (...)" / "Administrador de Empleado Custom". Los xml_id no cambiaron.

## Modelos principales

**`hr.employee` (herencia)**

| Grupo del formulario | Campos |
|---|---|
| Contacto | `estrato`, `medio_transporte`, `categoria_licencia`, `fecha_vencimiento_licencia` |
| Ciudadanía | `tipo_documento`, `lugar_expedicion` (`res.city`), `fecha_expedicion`, `grupo_sanguineo`, `discapacitado`, `tipo_discapacidad` |
| Emergencia | `parentesco` |
| Educación | `tarjeta_profesional` |
| Dotación | `talla_camisa`, `talla_pantalon`, `talla_calzado` |
| Seguridad social | `eps`, `caja_compsensacion`, `fondo_pensiones`, `cesantias`, `fondo_pension_estado`, `clase_riesgo`, `fecha_ultimo_emo`, `fecha_reinduccion`, `brigadista`, `comite_brigada`, `es_conductor_autorizado` |
| Información adicional | `familiar_ids` |

Casi todos son `Selection` con valores fijos (EPS, cajas, fondos, tallas). Agregar una EPS o una caja nueva exige cambiar código. `caja_compsensacion` lleva un error de tipeo en el nombre técnico; cambiarlo ahora exige migración.

**`hr.employee.familiar`**: `employee_id` (required, `ondelete='cascade'`), `nombre`, `genero`, `edad`, `rango_edades`. `rango_edades` es un `Selection` manual, no se calcula desde `edad`.

## Wizards / vistas / JS relevantes

Solo `views/hr_employee_view_inherit.xml`. Usa widget `selection_badge` en la mayoría de los `Selection`, la sintaxis v17 `invisible="discapacitado != 'si'"` / `required="discapacitado == 'si'"` para Tipo de Discapacidad, y un tree editable para familiares. `es_conductor_autorizado` va readonly después de Comité de Brigada.

## Reglas de negocio

| Regla | Dónde | Efecto |
|---|---|---|
| Edad del familiar entre 1 y 120 | `hr.employee.familiar._check_edad` | `ValidationError` si `edad <= 0` o `> 120`. |
| Nombre del familiar no vacío | `hr.employee.familiar._check_nombre` | Rechaza un nombre de solo espacios. |
| Tipo de discapacidad obligatorio si hay discapacidad | Vista (`required="discapacitado == 'si'"`) | Solo en el cliente web; el modelo no lo exige. |
| Conductor autorizado | `_compute_es_conductor_autorizado` | True si hay un `fleet.personal.autorizado` con ese `employee_id`. Ese modelo tiene `active`, así que `search_count` solo cuenta registros activos. |

## Bugs y decisiones relevantes

- **`sudo()` en el compute de conductor** (`70a6591ec`). Evita `AccessError` a usuarios de RRHH que no tienen acceso a flota. El compute no es stored y lee con `search_count`, así que el valor siempre refleja el estado actual de flota.
- **`custom_flota` en `depends`** (`70a6591ec`). Garantiza que `fleet.personal.autorizado` esté en el registro antes de calcular.

No hubo bugs corregidos en el periodo.

## Historial de commits

??? note "Ver los 3 commits en orden"

    | # | Commit | Fecha | Mensaje |
    |---|---|---|---|
    | 1 | `c6f5ca010` | 2026-06-12 | Migrar campos personalizados `hr.employee` de v13 a v17 |
    | 2 | `70a6591ec` | 2026-06-16 | Agregar campo Conductor Autorizado en ficha de empleado |
    | 3 | `a3c0b8ed1` | 2026-07-03 | Modificaciones para pull request (en este módulo: nombres de grupos) |

## Pendientes / puntos por confirmar

- [ ] Los datos de la v13: el commit migra los **campos**, no los valores. No se encontró script de migración de datos; confirmar cómo se cargaron (o si se cargaron) los valores de los empleados existentes.
- [ ] Permisos de familiares: solo `base.user_admin` queda en el grupo administrador por defecto, y `familiar_ids` va en la ficha sin atributo `groups`. Verificar en la interfaz qué ve un usuario de RRHH sin ningún grupo "Empleado Custom" al abrir un empleado.
- [ ] Confirmar con RRHH si las listas fijas (EPS, cajas, fondos) deben pasar a catálogos editables, como se hizo con el ente certificador en [custom_documentos_sig](custom_documentos_sig.md).
- [ ] La descripción del manifest habla de "estado del empleado y medio de transporte"; no refleja el contenido real.
