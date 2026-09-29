# custom_documentos_sig

6 commits de `digital18`, 2026-06-24 → 2026-08-21. Versión del manifest: `1.3.0`.

!!! note "Alcance de esta página"
    El módulo tiene 46 commits en su historia; 40 son de `digital6` y `digital7` y no aparecen en las tablas. La descripción de componentes cubre solo las piezas que tocaron estos 6 commits: actas de reunión, ente certificador, formatos por departamento y código/versión de documentos. Los demás modelos (plantillas, carpetas de Documents, permisos por departamento) quedan fuera.

## Visión general

Gestión de documentos del Sistema Integrado de Gestión (SIG) sobre el módulo nativo `documents` (Enterprise). Registra formatos, procedimientos, manuales y demás tipos documentales con su código, su histórico de versiones y su archivo en Documents. También lleva las actas de reunión con sus firmas de aprobación y las certificaciones de la empresa.

Depende de `base`, `mail`, `hr` y `documents`.

## Qué problema resuelve

Los 6 commits atacan tres problemas concretos:

- **Seguimiento de firmas en actas.** No había forma de ver qué actas le faltaba firmar a un empleado concreto. Ahora se agrupa y filtra por aprobador y por firma realmente pendiente.
- **Entes certificadores quemados en código.** Eran un `Selection`; agregar uno nuevo exigía un despliegue. Ahora son un catálogo administrable desde la interfaz.
- **Códigos de documento inconsistentes.** El código se tecleaba a mano en cada versión. El commit `22296b4ec` midió 34 de 607 códigos fuera del patrón `XX-NNNN` y 7 duplicados. Ahora el código se propone solo, por consecutivo dentro del rango del formato, y la versión lo hereda del documento.

## Arquitectura / componentes principales

| Pieza | Archivo | Rol |
|---|---|---|
| `acta.reuniones` | `models/acta_reunion.py` | Acta de reunión; campos de firma agregados para búsqueda y agrupación |
| `aprobaciones.reuniones` / `aprobaciones.reuniones.externos` | `models/acta_reunion.py` | Líneas de firma interna (`hr.employee`) y externa (texto libre) |
| `certificacion.ente` | `models/models.py` | Catálogo de entes certificadores, seed en `data/certificacion_ente_data.xml` |
| `formatos.dpto` | `models/models.py`, `views/formato_dpto.xml` | Rango numérico de cada departamento de formato (`rango`, `rango_dpto`) |
| `custom.documentos.sig` | `models/models.py`, `views/documentos_views.xml` | Documento SIG con `codigo_actual` y cálculo de consecutivo |
| `documentos.historico.versiones` | `models/models.py` | Versión del documento; hereda el código del padre |
| Migración 1.3.0 | `migrations/1.3.0/post-migrate.py` | Rellena `rango_dpto` desde `rango` |

El código de un documento une dos piezas: el prefijo lo da el tipo (`FR`, `PR`, `DG`...) y los 4 dígitos salen del rango del formato (`formatos.dpto`). Por eso el consecutivo depende de formato **y** tipo.

## Procesos funcionales

**Crear un documento nuevo**

1. El líder elige formato (`formato_dpto_id`) y tipo (`tipo_documento`).
2. `_onchange_sugerir_codigo` llena `codigo_actual` con el siguiente consecutivo de esa combinación. El campo sigue editable.
3. Si quedan menos de 10 números en el rango, sale un aviso. Si el rango se agotó, el campo queda vacío y el aviso pide escribir el código a mano.
4. Cada línea nueva del histórico de versiones trae el código del documento y no se puede cambiar desde el formulario.

**Revisar firmas pendientes de actas**

En la búsqueda de actas: filtro "Firma pendiente", agrupación por "Estado de firmas", por "Empleado (Aprobador)" y por "Aprobador con firma pendiente". Esta última es la que responde "qué actas me faltan firmar a mí".

## Evolución del módulo

### 1. Flujo de aprobación de actas (24-jun → 11-ago)

El primer commit agregó dos campos stored a `acta.reuniones`: `aprobador_ids` (M2M a `hr.employee`) para agrupar el acta bajo cada firmante interno, y `estado_firmas` para filtrar por avance. El commit incluye un reformateo con black de todo `acta_reunion.py`, por eso el diff es de ~450 líneas aunque el cambio funcional es pequeño.

Casi dos meses después apareció el hueco: combinar "Empleado (Aprobador)" con "Firma pendiente" devolvía actas donde ese empleado ya había firmado pero otro no. Se agregó `aprobadores_pendientes_ids`, que solo contiene a los aprobadores internos sin firma.

??? abstract "Commits y archivos del capítulo (2 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `de7835234` | 2026-06-24 | Agrega `aprobador_ids` y `estado_firmas`; filtro y agrupaciones en la búsqueda. Incluye reformateo black. |
    | `83b408b48` | 2026-08-11 | Agrega `aprobadores_pendientes_ids` para buscar firma pendiente por aprobador sin falsos positivos. |

    **Archivos:** `models/acta_reunion.py`, `views/acta_de_reuniones.xml`

!!! warning "Iteración sin cerrar"
    El mensaje de `83b408b48` dice: "Pendiente: revisar el resultado de esta primera iteración con el usuario tras probar en el entorno (agrupación por empleado, filtro combinado empleado + firma pendiente)". No hay commit posterior que lo cierre.

### 2. Ente certificador: de Selection a Many2one (25-jun)

`certificaciones.ente_certificador` era un `Selection` con valores fijos. Se reemplazó por `ente_certificador_id`, Many2one al modelo nuevo `certificacion.ente` (`name`, `sequence`, `active`). Se sembraron 9 entes con xml_id estable, se agregó menú en Personalizaciones y permisos con el patrón de 4 grupos del módulo. Versión 1.1.0 → 1.2.0.

??? abstract "Commits y archivos del capítulo (1 commit)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `83a7eab67` | 2026-06-25 | Modelo `certificacion.ente`, seed de 9 entes, menú, permisos y vistas migradas al Many2one. |

    **Archivos:** `__manifest__.py`, `data/certificacion_ente_data.xml`, `models/models.py`, `security/ir.model.access.csv`, `views/action_documents.xml`, `views/certificaciones_views.xml`, `views/menus.xml`

??? warning "Migración de datos manual, sin script"
    El commit borra el campo `Selection` y no trae script de migración. Según el mensaje, los datos existentes se pasaron por exportar/importar y se probó en `neutralize_23_05` sin registros vacíos. En cualquier otra base que suba de 1.1.0 a 1.2.0, Odoo borra la columna vieja al actualizar y las certificaciones quedan sin ente. Antes de actualizar otra base hay que repetir la exportación e importación a mano.

### 3. Numeración y versión de documentos (21-ago)

Tres commits el mismo día, en orden:

1. **Rango numérico.** `formatos.dpto.rango` ordena por prefijo (APE, APM, BPM), no por número, y Odoo 17 no permite ordenar una columna por otro campo. Se agregó `rango_dpto` (`NNNN-NNNN` con ceros a la izquierda, así el orden alfabético coincide con el numérico) y una vista de búsqueda, que el modelo no tenía.
2. **Consecutivo automático.** `_siguiente_codigo(formato, tipo)` calcula máximo + 1 dentro del rango del formato. `codigo_actual` del documento dejó de ser readonly.
3. **La versión hereda el código.** La línea del histórico toma el código del documento en `create()` y queda readonly en el formulario. De paso se corrigió un bug de `create()` que revertía correcciones manuales (ver [Bugs y decisiones](#bugs-y-decisiones-relevantes)).

??? abstract "Commits y archivos del capítulo (3 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `3bdef5880` | 2026-08-21 | Agrega `rango_dpto`, vista de búsqueda de formatos y migración 1.3.0. |
    | `22296b4ec` | 2026-08-21 | Autocompleta `codigo_actual` con el siguiente consecutivo de (formato, tipo). |
    | `b52a33b4c` | 2026-08-21 | La versión hereda el código del documento; corrige el clobber de `create()`. |

    **Archivos:** `__manifest__.py`, `data/formatos_dpto_data.xml`, `migrations/1.3.0/post-migrate.py`, `models/models.py`, `views/formato_dpto.xml`, `views/documentos_views.xml`

## Modelos principales

| Modelo | Campos tocados en el periodo | Nota |
|---|---|---|
| `acta.reuniones` | `aprobador_ids`, `aprobadores_pendientes_ids`, `estado_firmas` | Los tres son compute stored. `estado_firmas`: `sin_aprobadores` / `pendiente` / `parcial` / `completas`, con `group_expand` para mostrar todas las columnas. |
| `certificacion.ente` | `name`, `sequence`, `active` | Nuevo. `_order = 'sequence, name'`. |
| `certificaciones` | `ente_certificador_id` | Reemplaza al `Selection` `ente_certificador`. |
| `formatos.dpto` | `rango_dpto` | `_order` sigue siendo `rango`; el orden numérico es solo de la vista lista. |
| `custom.documentos.sig` | `codigo_actual` (ahora editable), `_siguiente_codigo`, `_onchange_sugerir_codigo` | |
| `documentos.historico.versiones` | `codigo_actual` (required, heredado), `create()` | |

## Wizards / vistas / JS relevantes

No hay wizards ni JS en estos commits. Vistas:

- `views/acta_de_reuniones.xml`: búsqueda de actas con los campos de aprobador, filtro "Firma pendiente" (`estado_firmas in ('pendiente', 'parcial')`) y tres agrupaciones.
- `views/formato_dpto.xml`: lista con `default_order="rango_dpto"`; búsqueda nueva con filtros por millar (`rango_dpto =like '0%'`...), "Sin rango numérico", "Sin departamento", "Sin departamento padre" y agrupaciones.
- `views/documentos_views.xml`: `codigo_actual` del documento editable; el One2many del histórico pasa `default_codigo_actual` por contexto; en el formulario de la versión, `codigo_actual` es readonly.
- `views/certificaciones_views.xml`: form/tree/kanban usan `ente_certificador_id` con `no_create`.

## Reglas de negocio

| Regla | Dónde | Efecto |
|---|---|---|
| Firma pendiente por aprobador | `_compute_aprobadores_pendientes_ids` | Solo líneas internas sin `firma_aprobacion`. Los externos no tienen `hr.employee` y no entran. |
| Estado de firmas | `_compute_estado_firmas` | Cuenta líneas internas y externas por separado y compara firmadas contra total. |
| Formato de `rango_dpto` | `_check_rango_dpto` (`@api.constrains`) | Exactamente `NNNN-NNNN`, inicio múltiplo de 100, bloque de 100 y sin repetir en otro formato. Vacío permitido. |
| Consecutivo por (formato, tipo) | `_siguiente_codigo` | El mismo número se reusa entre tipos (DIB 2000-2099 tiene DG-2000, FR-2000, IN-2000 y PR-2000). Mira documentos **e** histórico, y descarta números fuera del rango del formato. Busca con `sudo()`. |
| Sugerencia solo en registros nuevos | `_onchange_sugerir_codigo` | No renumera un documento guardado: las etiquetas de sus archivos en Documents salen del código. Tampoco pisa un código escrito a mano que no tenga la forma `XX-NNNN`. |
| La versión hereda el código | `documentos.historico.versiones.create()` | Si el padre tiene código, se fuerza en `vals`. Cubre formulario, importación y API. |
| El padre solo toma código de la versión si está vacío | `documentos.historico.versiones.create()` | Evita revertir correcciones manuales. |

Política de huecos: máximo + 1, sin rellenar huecos. Según `22296b4ec`, las 20 secuencias con huecos los tienen por numeración deliberada por subcategoría (p. ej. DMC/FR: 3600, 3621, 3661, 3681), no por borrados. La simulación sobre las 94 secuencias existentes dio 0 colisiones y 0 rangos agotados.

## Bugs y decisiones relevantes

**Bug corregido**

| Tema | Causa raíz | Commit |
|---|---|---|
| El documento heredaba el código de una versión vieja | `create()` del histórico copiaba al padre el código de la versión de mayor número, pero `version` arranca en 0: una línea nueva no era la máxima y el padre recibía el código de una línea anterior. Con `codigo_actual` del documento ya editable, eso revertía correcciones manuales. Ahora solo copia si el padre está vacío. | `b52a33b4c` |

El commit identificó dos documentos con el código del padre distinto al de su versión máxima: id 949 (`MT-1502` contra `DG-1501`) e id 547 (`FR 2403` contra `FR-2403`).

**Decisiones**

- **`sudo()` en el cálculo del consecutivo** (`22296b4ec`). Las `ir.rule` filtran documentos por departamento del responsable. Sin `sudo()`, un líder que no ve otras áreas calcula un máximo más bajo y genera duplicados.
- **El histórico cuenta para el máximo** (`22296b4ec`). Dos códigos válidos solo viven en el histórico (`PR-2502` en DLE, `PR-3100` en DPM).
- **Filtrar por rango** (`22296b4ec`). El id 511 tiene `PR-3901` con formato DLE 2500-2599; sin el filtro, el siguiente PR de DLE saldría `PR-3902`.
- **No usar `related` stored para el código de la versión** (`b52a33b4c`). Aplastaría los 51 documentos cuyo histórico tiene códigos distintos entre versiones, que es la progresión legítima de marcador Beta a código real.
- **Forzar el código en `create()` y no solo en la vista** (`b52a33b4c`). Un campo readonly puede no viajar desde el cliente web y romper el `required=True` del modelo.
- **`default_order` en la vista, no `_order` del modelo** (`3bdef5880`). Cambiar `_order` habría reordenado los desplegables de formato en los 607 documentos.
- **`rango` no se recalcula** (`3bdef5880`). Los prefijos DIB, DLE, DGF, DMC, NOM y GAP no existen en `hr_department`; recalcularlo habría borrado 33 etiquetas en uso. Queda editable, con sugerencia por onchange.

??? warning "Migración 1.3.0 parcial a propósito"
    `post-migrate.py` solo escribe `rango_dpto`, nunca `rango`: las subcarpetas de Documents se resuelven por `documents.folder.name = rango` y reescribirlo partiría las carpetas. Migra 40 de 41 registros. El id 41 (DPM: 600-609, sin documentos) queda nulo porque tiene rango de 3 dígitos con tramo de 10; hay que corregirlo a mano. El commit también reporta 7 carpetas huérfanas en Documents por ediciones previas de `rango`, que no se tocaron.

??? note "El seed de formatos solo aplica en instalaciones nuevas"
    `data/formatos_dpto_data.xml` va con `noupdate="1"`. Los 39 `rango_dpto` que agregó `3bdef5880` al XML no se escriben en una base existente al actualizar; ahí los llena la migración.

## Historial de commits

??? note "Ver los 6 commits en orden"

    | # | Commit | Fecha | Mensaje |
    |---|---|---|---|
    | 1 | `de7835234` | 2026-06-24 | Agrupar actas por empleado aprobador y estado de firmas |
    | 2 | `83a7eab67` | 2026-06-25 | Convertir ente certificador de Selection a Many2one |
    | 3 | `83b408b48` | 2026-08-11 | Búsqueda de empleado y firma pendiente por aprobador en actas |
    | 4 | `3bdef5880` | 2026-08-21 | Ordenar formatos por rango numérico |
    | 5 | `22296b4ec` | 2026-08-21 | Autocompletar consecutivo en `codigo_actual` |
    | 6 | `b52a33b4c` | 2026-08-21 | La versión hereda el código del documento |

## Pendientes / puntos por confirmar

- [ ] Validar con el usuario la búsqueda de firma pendiente por aprobador (pendiente declarado en `83b408b48`).
- [ ] Antes de actualizar cualquier base distinta de `neutralize_23_05` a 1.2.0: exportar e importar el ente certificador, o escribir la migración que falta.
- [ ] Corregir a mano el `rango_dpto` del formato id 41 (DPM 600-609).
- [ ] Decidir qué hacer con las 7 carpetas huérfanas de Documents.
- [ ] `documentos.historico.versiones.write()` sigue copiando `codigo_actual` de la versión al documento cuando se edita por RPC o importación. El formulario ya no deja editarlo, pero esa ruta queda abierta.
- [ ] `documentos.historico.versiones.create()` sigue con la firma `@api.model` de un solo `vals`. Funciona en lote porque Odoo 17 la envuelve con `model_create_single` (crea uno por uno y deja un warning en el log); migrar a `@api.model_create_multi` cuando se toque.
- [ ] Unicidad del código: el consecutivo evita duplicados al proponer, pero no hay constraint que impida guardar un código repetido tecleado a mano.
