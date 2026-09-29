# Dominio Alistamiento / Separación

> **Ámbito original:** `models/stock_alistamiento.py`, `wizard/alist_label_generator_wizard.py` (+ vistas), `wizard/alistar_comprar_wizard_views.xml`, `static/src/js/alistamiento_scan.js` (+ xml). Ver [índice de reglas operativas](index.md).

> **Desactualizado en 2 puntos** (no reescrito todavía, a diferencia de [Código único RC](barcode-rc.md)): el gotcha #1 de más abajo ("fallo silencioso... `try/except`") ya no aplica — `confirm_alistamiento` ahora hace `raise UserError` sin atrapar si algo no reservó exacto (ALI-05B), revirtiendo toda la confirmación en vez de quedar en `draft` en silencio. Y `release_in_progress` ya tiene 2 llamadores reales (uno de ellos justo en `alistamiento_scan.js`, como respaldo cuando la línea ya no está en pantalla) — la sección "Escaneo" de abajo todavía dice que no hay forma de deshacerlo desde la UI.

## Alcance

```text
requisición
→ Fase 1
→ ubicación
→ etiquetas propias
→ escaneo
→ confirm_alistamiento
→ OUT / Separación (uno o varios, por ubicación)
→ faltante a Comprar (manual, no auto-split)
```

`Solicitudes de Bodega` no vuelve a ser origen funcional del MVP; puede estudiarse como precedente.

## Ubicación

`material.source_location_id` (`stock_alistamiento.py:124-127`, en `custom_requisiciones.material_electrico`
vía `_inherit`) = selección vigente para próximas etiquetas, NO histórico — explícito en el help del
campo y en el docstring de `action_set_source_location_alistamiento` (líneas 213-215): "NO toca
etiquetas ya generadas".

Cada etiqueta congela su propia copia al crearse, en `_create_pending_labels`
(`wizard/alist_label_generator_wizard.py`):

- serial: línea 313 (`ubic_exacta.id` por serial, vía `_ubicacion_exacta_lote`)
- lote: línea 327 (una ubicación resuelta compartida por el lote)
- sin tracking: línea 337 (`_ubicacion_efectiva(material)`)

`stock.rc.label.pending.source_location_id` es `readonly=True` (`stock_rc_label_pending.py:46`):
cambiar el selector del material después nunca toca etiquetas ya creadas.

**Multiubicación: confirmado e implementado**, no solo diseño. `confirm_alistamiento` agrupa por clave
que incluye `location.id` (`stock_alistamiento.py:1294-1295`), y el cliente arma un spec por
`(material_id, source_location_id)` en `_buildAlistSpecs()`
(`alistamiento_scan.js:2256-2304`, loop sobre `scannedByLocation`). `preview_alistamiento`
(`stock_alistamiento.py:1072-1131`) usa la misma clave. `move_id` (no el `move_id` del material) es lo
que distingue a qué OUT pertenece cada etiqueta (comentario, `stock_rc_label_pending.py:55-58`).

## Tracking

Cada etiqueta rastreada congela `tracking_lot_id` (incluido en cada `vals_list`,
`alist_label_generator_wizard.py:312,326,336`); bloquea antes si falta para producto rastreado
(líneas 243-249). Si la selección es raíz, se resuelve y congela la hoja exacta
(`_ubicacion_exacta_lote`, líneas 125-145).

`confirm_alistamiento` confirma con `lot_id` por ID real, nunca `search/create` por barcode — pero
**solo en la rama propia de Alistamiento**: valida existencia vía `Lot.browse(...).exists()`
(`stock_alistamiento.py:1219-1224`) y crea `stock.move.line` con `lot_id` directo (línea 1397).
La rama `es_recepcion=True` (misma función, otro branch) SÍ usa `_alist_get_or_create_lot` por nombre
(líneas 1366, 1374) — comentado a propósito como "SOLO para Recepción" (líneas 1134-1139), pero **nada
a nivel de código impide llamarlo desde el otro branch**: la separación es por convención
(`es_recepcion` booleano), no estructural.

Bloquea si stock/tracking ya no está disponible en la ubicación congelada, en vez de sustituir
(líneas 1206-1214, 1246-1258 — mensaje explícito: "No se reasigna automáticamente").

## Escaneo — CONTRADICCIÓN REAL con la regla que teníamos

**El doc anterior decía "nunca marcar in_progress antes de validar pertenencia". El código actual NO
cumple eso para las etiquetas propias de Alistamiento.**

Orden real en `resolve_rc_scan` (`stock_alistamiento.py:910-1069`, rama propia `purchase_line_id=False`,
líneas 927-1005):

1. Resolver código (958-962).
2. Validar uso — ya consumida/cancelada/in_progress → return sin tocar estado (969-970).
3. Validar que el material existe (971-973).
4. **Marcar `in_progress` + registrar sesión en el MISMO write** (979-983) — el doc los describía como
   dos pasos separados; en el código son atómicos.
5. Devolver info al cliente.

Recién DESPUÉS, en cliente (`processBarcode`, `alistamiento_scan.js:1685-1833`), se valida si la línea
sigue en `state.lines` — es decir, si sigue perteneciendo a la cola/contexto activo
(líneas 1766-1776). Si no está: notifica "La línea de esta etiqueta ya no está en Alistamiento" — y,
a diferencia de lo que decía la versión anterior de esta regla, hoy SÍ llama a `release_in_progress`
como respaldo (ver nota de corrección al inicio de la página).

Para unidades RC que no son etiqueta propia (`stock.lot.item`/`stock.reception.record`), la pertenencia
(match de OT, diálogo de selector) sí se valida 100% en cliente antes de persistir nada
(`alistamiento_scan.js:1792-1832`) — ahí el orden correcto sí se cumple. El defecto (marcar `in_progress`
antes de validar pertenencia) es específico de las etiquetas propias pre-impresas de Alistamiento.

La columna Serial muestra `tracking_lot_id.name` cuando existe, con fallback a `barcode_value`/lotCode
para etiquetas legacy sin ese dato (`_registerUnit`, `alistamiento_scan.js:1943-1966`; template
`alistamiento_scan.xml:670-681`).

## Confirmación / OUT — secuencia real (difiere de la lista anterior)

`confirm_alistamiento` (`stock_alistamiento.py:1153-1473`) real, no la lista genérica de 8 pasos:

1. **Pase 1** (1174-1258): resuelve material/wh/ubicación/tracking por spec, valida que la ubicación
   pertenezca al árbol de la bodega, valida payload de lote/serie — "validar payload" y "validar
   tracking" van mezclados en un solo pase; disponibilidad se valida después/entrelazada
   (1235-1244 sin tracking, 1250-1258 con tracking), no como paso previo aislado.
2. **Pase 2** (1272-1449) por spec resuelto: agrupar por ubicación y crear/reutilizar OUT son EL MISMO
   paso (1294-1333, clave por bodega/origen o req + `location`).
3. Crear `stock.move` (1343-1355) y luego `stock.move.line`(s) por unidad (1358-1398).
4. Marcar `delivery_scanned` en `stock.reception.record` — **paso no listado antes** (1401-1405).
5. Consumir etiquetas: `in_progress` → `consumed`, fija `move_id` (1415-1422).
6. Actualizar material (`cantidad_enviada_a_separar`, `enviado_a_separar`, `move_id`,
   `estado_alistamiento`) (1424-1437).
7. Asignar canastilla a la OT — **paso no listado antes** (1440-1448).
8. **Pase final, fuera del loop por spec**, sobre cada OUT tocado: `action_confirm()` +
   `action_assign()` + `separado_en_fisico=True` — ver corrección al inicio de la página: este paso
   ya NO traga la excepción con `try/except`, ahora aborta con `UserError` si algo no reservó exacto.

## Serial con cantidad 0

Sin evidencia en código: no hay comentario, workaround ni test que referencie este escenario en todo
el módulo. Tratar como protocolo de diagnóstico ante síntoma reportado, NO como bug confirmado o
guardado existente. Si vuelve a aparecer, reconstruir con los campos ya listados
(`stock.move.product_uom_qty`, `.quantity`, `stock.move.line.quantity`, `lot_id`, `action_assign`,
`confirm_alistamiento`).

## Separar + Comprar — PARCIALMENTE IMPLEMENTADO

Existe `AlistarComprarWizard` (`stock_alistamiento.py:1885-1930`,
`custom_requisiciones.alistar_comprar_wizard`), pero **`cantidad_alistar`/`cantidad_comprar` son floats
que el usuario escribe a mano**, con constraint de que sumen exacto al aprobado (1894-1903). No hay
ningún cálculo de "separable real desde stock disponible" — el split "demanda 10 / separable 4 /
faltante 6" que describía el doc es diseño intencional, no código existente. `action_procesar`
(1905-1930) no crea OUT para la porción "alistar": solo marca `estado_alistamiento='pendiente'` para
que siga el flujo normal de escaneo.

`estado_alistamiento` (`stock_alistamiento.py:102-106`, Selection
`pendiente`/`alistado`/`devuelto`) es explícitamente informativo — "NO influye en el proceso de
separación" (comentario línea 100-101). `cantidad_enviada_a_separar` vive en
`custom_requisiciones/models/requisition.py:851`, no en este módulo.

## Gotchas confirmados (no triviales)

1. ~~**Fallo silencioso en auto-confirmar/reservar OUT**~~ — corregido, ver nota al inicio de la página
   (ALI-05B reemplazó el `try/except` por `raise UserError`).
2. **Huérfanos `in_progress` por el defecto de orden de escaneo** (ver sección Escaneo) — sin barrido
   automático; hoy sí existe `release_in_progress` como respaldo puntual, pero no un barrido periódico.
3. **`_out_pendientes_por_bodega`/badges filtran por `separado_en_fisico=True`**: una separación que
   falla en el pase final (ahora con `UserError`, antes en silencio) NO aparece en la alerta de
   "pendiente por validar" — queda oculta al operario, aunque ahora al menos el usuario ve el error al
   momento de confirmar.
4. **`_alist_get_or_create_lot` no tiene barrera estructural** entre rama Recepción y rama Alistamiento
   propia (ver Tracking) — solo convención.

## Fase 2

Puede haber uno o varios documentos de Separación por línea. No asumir 1:1.

## Reabastecimiento

Ocultar del MVP solo después de verificar dependencias. No borrar código sin necesidad.

## Refactorización

Clasificar: obtención de líneas; disponibilidad; ubicación; tracking; resolución RC; lifecycle;
agrupación; preview; confirmación; OUT; compra; payload/UI. No dividir por tamaño.
