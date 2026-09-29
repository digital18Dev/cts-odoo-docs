# custom_despachos

1 commit de `digital18`, 2026-06-26 (en `changes_stock`). Versión del manifest: `1.0`.

!!! note "Alcance de esta página"
    El módulo tiene 46 commits; 45 son de `digital6` y `digital7`, incluida toda la funcionalidad de PQR (abril de 2026). Esta página documenta solo el fix de `digital18`. Hay un segundo commit de `digital18`, `d860a5e79` (restricción de edición por fase), que vive en `changes_jorsh` y **no** está en `changes_stock`; ver [Pendientes](#pendientes-puntos-por-confirmar).

## Visión general

Gestión de despachos (`despachos.despacho`). Depende de `base`, `project`, `custom_proyectos`, `custom_requisiciones` y `mail`.

Una PQR es un registro del mismo modelo `despachos.despacho` con `pqr_despacho_origen_id` apuntando al despacho que la origina. Se crea desde el botón PQR del despacho (`action_open_pqr`), que abre las vistas `view_despacho_pqr_tree` / `view_despacho_form_pqr` con defaults del origen. Su nombre sale de la secuencia `despachos.pqr`: `PQR<aa>-<seq>`, con sufijo `/<n>` a partir de la segunda PQR del mismo despacho.

## Qué problema resuelve

Al crear una PQR desde un despacho, Departamento y Ciudad no se llenaban con los del despacho origen. Cuando llegaban a mostrarse, se perdían al guardar.

## Arquitectura / componentes principales

Cuatro puntos tocados en `models/models.py` y uno en `views/views_despachos.xml`:

| Pieza | Cambio |
|---|---|
| `_onchange_pqr_despacho_origen` | Copia `state_id`/`city_id` del origen para la vista previa, si la PQR no los trae. |
| `_onchange_state_id` | Solo limpia la ciudad si no pertenece al departamento elegido. |
| `create()` | Copia `state_id`/`city_id` desde `pqr_despacho_origen_id` en el servidor, si no vienen en `vals`. |
| `view_despacho_form_pqr` | `state_id` y `city_id` siguen readonly y ahora con `options="{'no_open': True}"`. |

## Procesos funcionales

1. Desde un despacho, abrir PQR y crear una nueva.
2. El formulario muestra Departamento y Ciudad del despacho origen (solo lectura, sin enlace al registro).
3. Al guardar, el servidor vuelve a copiarlos desde el origen, así que persisten aunque el cliente no los envíe.

## Evolución del módulo

No aplica: módulo con un solo commit de este autor en `changes_stock`, ver [Historial de commits](#historial-de-commits).

## Modelos principales

`despachos.despacho`: `state_id` (`res.country.state`, "Departamento") y `city_id` (`res.city`, "Ciudad"), ambos con tracking; `pqr_despacho_origen_id` (Many2one al mismo modelo, `ondelete='cascade'`) y su inverso `pqr_ids`.

## Wizards / vistas / JS relevantes

Solo el cambio de `options` en `views/views_despachos.xml` descrito arriba.

## Reglas de negocio

- Una PQR hereda Departamento y Ciudad de su despacho origen. Se aplica en servidor (`create()`), así que también cubre importación y RPC.
- Solo se copian si `vals` no trae valor: un departamento o ciudad explícito en la creación gana sobre el del origen.
- Cambiar Departamento borra la Ciudad solo si esa ciudad es de otro departamento.

## Bugs y decisiones relevantes

| Tema | Causa raíz | Commit |
|---|---|---|
| La PQR no guardaba Departamento/Ciudad del origen | Dos causas juntas. (1) `_onchange_state_id` ponía `city_id = False` siempre que cambiaba el departamento, así que al copiar ambos del origen la cascada de onchange borraba la ciudad recién copiada. (2) Los dos campos son readonly en la vista PQR y el cliente web no envía campos readonly al guardar, así que aunque se vieran nunca llegaban al servidor. | `1dad152c4` |

La corrección ataca las dos causas por separado: el onchange ya no borra una ciudad válida, y `create()` copia los valores en servidor sin depender del cliente. Es la ruta correcta para una regla del dato: no queda atada al formulario.

??? note "Probado con un caso real"
    El commit deja evidencia explícita de prueba: en `neutralize_23_05`, la PQR creada desde `DSP26-0203` heredó Santander / Bucaramanga y los valores persistieron tras guardar. Pocos commits del periodo documentan la prueba así.

## Historial de commits

??? note "Ver el commit"

    | # | Commit | Fecha | Mensaje |
    |---|---|---|---|
    | 1 | `1dad152c4` | 2026-06-26 | Heredar departamento y ciudad del origen en PQR |

## Pendientes / puntos por confirmar

- [ ] `d860a5e79` (2026-08-31, `digital18`), restringir edición por fase y bloquear Detenido/Cancelado si ya se entregó, está en `changes_jorsh` y `origin/changes_jorsh`, no en `changes_stock`. Decidir si se integra a esta rama. Según la memoria del proyecto, el plan asociado tenía riesgos abiertos (recursión de la firma PAE en `write()`, efecto sobre `group_presupuesto_despacho`, despliegue si `despachos.responsable` no está poblada).
- [ ] La herencia solo corre al **crear** la PQR. Si después se corrige Departamento/Ciudad del despacho origen, las PQR ya creadas no se actualizan. Confirmar con el usuario si eso es lo esperado.
- [ ] `create()` de `despachos.despacho` sigue con la firma `@api.model` de un solo `vals`. No falla en lote: Odoo 17 la envuelve con `model_create_single` (`odoo/api.py`), crea uno por uno y deja el warning "is not overriding the create method in batch" en el log. Migrar a `@api.model_create_multi` cuando se toque este método.
