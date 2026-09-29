# ADR

Decisiones de arquitectura ya tomadas y visibles en el código o en el historial de `changes_stock`. Ninguna es una propuesta: cada una cita dónde se ve.

Formato: **Contexto** (qué lo empujó), **Decisión** (qué se hizo), **Consecuencia** (qué se gana y qué se paga). **Estado** dice si sigue vigente.

| # | Decisión | Módulo | Estado |
|---|---|---|---|
| [ADR-01](#adr-01-invariantes-del-dato-en-servidor-comandos-en-action_) | Invariantes del dato en servidor; comandos en `action_*` | Transversal | Vigente |
| [ADR-02](#adr-02-custom_barcode_activos-extiende-custom_requisiciones-sin-editarlo) | `custom_barcode_activos` extiende `custom_requisiciones` sin editarlo | `custom_barcode_activos` | Vigente |
| [ADR-03](#adr-03-catalogo-y-stock-propios-reemplazados-por-inventario-nativo) | Catálogo y stock propios reemplazados por inventario nativo | `custom_solicitudes` | Hecho en código; quedan restos |
| [ADR-04](#adr-04-custom_asignaciones-renombrado-a-custom_solicitudes) | `custom_asignaciones` renombrado a `custom_solicitudes` | `custom_solicitudes` | Hecho |
| [ADR-05](#adr-05-servicio-central-de-notificaciones-que-no-aborta-el-negocio) | Servicio central de notificaciones que no aborta el negocio | `custom_solicitudes` | Vigente |
| [ADR-06](#adr-06-reserva-estricta-en-alistamiento-ali-05b) | Reserva estricta en Alistamiento (ALI-05B) | `custom_barcode_activos` | Vigente, sin tests |
| [ADR-07](#adr-07-etiquetas-rc-impresas-antes-de-recibir) | Etiquetas RC impresas antes de recibir | `custom_barcode_activos` | Vigente |
| [ADR-08](#adr-08-la-letra-del-codigo-rc-sigue-al-tracking) | La letra del código RC sigue al tracking | `custom_barcode_activos` | Vigente |
| [ADR-09](#adr-09-impresion-zpl-por-zebra-browser-print) | Impresión ZPL por Zebra Browser Print | `custom_barcode_activos` | Vigente |
| [ADR-10](#adr-10-codigo-de-oc-con-prefijo-oc-sin-campo-propio) | Código de OC con prefijo `OC.` sin campo propio | `custom_compras` / `custom_reportes` / `custom_barcode_activos` | Vigente |
| [ADR-11](#adr-11-exigencias-por-fase-en-validadores-no-en-la-vista) | Exigencias por fase en validadores, no en la vista | `custom_sig` | Vigente, con huecos |
| [ADR-12](#adr-12-consecutivo-de-documento-sig-maximo-1-dentro-del-rango) | Consecutivo de documento SIG: máximo + 1 dentro del rango | `custom_documentos_sig` | Vigente |

## ADR-01: invariantes del dato en servidor, comandos en `action_*`

**Contexto.** La notificación de priorización NCI colgaba de `action_toggle_priorizado`, pero `priorizado` también era una casilla editable del formulario. Editar la casilla no pasaba por el método y no notificaba (`59aff2b53`, 2026-08-21).

**Decisión.** Lo que debe cumplirse venga de donde venga (formulario, tree editable, RPC, importación, Python) se protege en `create`/`write`/constraint. Solo los comandos explícitos de negocio (escanear, confirmar, validar, imprimir) viven en métodos de comando. Está escrita como regla del repositorio en `CLAUDE.md` y `.claude/rules/odoo-development.md`.

**Consecuencia.** Hoy `action_toggle_priorizado` solo escribe `priorizado=True`, y `asignacion.request.write()` dispara `notificar_nci_priorizada` (el comentario en el método lo explica). El mismo patrón aparece en:

- `despachos.despacho.create()`: copia Departamento/Ciudad del origen porque el cliente no envía campos readonly ([custom_despachos](modulos/custom_despachos.md#bugs-y-decisiones-relevantes));
- `documentos.historico.versiones.create()`: fuerza el código del documento ([custom_documentos_sig](modulos/custom_documentos_sig.md#bugs-y-decisiones-relevantes)).

El costo es revisar todas las rutas de escritura antes de decidir. Donde no se hizo, la regla no se cumple: el statusbar clicable de `custom_sig` deja retroceder y saltar fases ([custom_sig](modulos/custom_sig.md#bugs-y-decisiones-relevantes)).

## ADR-02: `custom_barcode_activos` extiende `custom_requisiciones` sin editarlo

**Contexto.** La bodega necesita cola, escaneo, separación y entrega sobre las líneas de requisición (`custom_requisiciones.material_electrico`). `custom_requisiciones` es de otro dominio y otros autores. `CLAUDE.md` del repositorio pide no ampliar alcance a otro dominio funcional salvo bloqueo o autorización.

**Decisión.** Toda la lógica de bodega sobre la requisición entra por `_inherit = 'custom_requisiciones.material_electrico'` en tres archivos de `custom_barcode_activos`: `models/stock_alistamiento.py`, `models/stock_entrega_scan.py` y `models/stock_devolucion_scan.py`. `digital18` tiene 0 commits en `custom_requisiciones` en `changes_stock`.

**Consecuencia.**

- `_domain_gestion_pendiente` y `_disponible_alistamiento` **copian** lógica de `custom_requisiciones/models/requisition.py` (D-012). Si una copia cambia, las dos pantallas divergen sin aviso.
- El guard de `custom_requisiciones/models/stock_picking.py` (`write()`) no se toca; Alistamiento lo atraviesa con el flag de contexto `bypass_separacion_validacion` (`stock_alistamiento.py:57`). Cualquier flujo nuevo que cree pickings de requisición fuera de la vía nativa necesita el mismo bypass.
- El wizard `custom_requisiciones.alistar_comprar_wizard` se define en `custom_barcode_activos` con el namespace del otro módulo.

Detalle: [custom_barcode_activos → Arquitectura](modulos/custom_barcode_activos.md#arquitectura-componentes-principales) y [Bugs y decisiones](modulos/custom_barcode_activos.md#bugs-y-decisiones-relevantes).

## ADR-03: catálogo y stock propios reemplazados por inventario nativo

**Contexto.** Las asignaciones tenían catálogo propio (`asignaciones.bd.productos`), stock propio (`asignaciones.stock.quant`) y kits propios (`asignaciones.kit.linea`), paralelos al inventario de Odoo.

**Decisión.** Usar `product.product`, `stock.quant`, `stock.picking` y `mrp.bom` nativos:

- `12ddb65d0` (2026-03-21, `digital7`): "relacion con inventario nativo". Agrega a `custom_inventario` los campos `solicitudes_asignacion`, `categoria_oli` y `disponible_prestamo` en el producto.
- `be97df790` (2026-03-26, `digital7`): borra `bd_productos_dashboard.py`, `stock.py`, `views_productos.xml`, `views_stock.xml` y casi todo lo legacy de `empleado_asignado.py` y `devolucion.py` (−3.071 líneas).

**Consecuencia.**

- Hoy no hay ninguna referencia a `asignaciones.bd.productos`, `asignaciones.stock.quant` ni `asignaciones.kit.linea` en `odoo/custom_addons` (búsqueda en `.py`, `.xml` y `.csv`).
- La entrega descuenta stock con un `stock.picking` OUT, y los kits se expanden con `mrp.bom._bom_find` en el wizard de aprobación (ver [Flujos → Asignación](flujos.md#1-asignacion-de-productos-al-empleado-oli-tic)).
- `custom_solicitudes` depende de `custom_inventario` para los campos de producto y para `stock.quant.qty_devolucion_danada`.
- **Restos:** `asignacion.producto.linea.location_id` sigue con la etiqueta "Ubicación (legacy)", y hay ramas comentadas como "líneas legacy" en `asignacion_request.py:1467` y `devolucion.py:682`.

!!! note "Ya corregido en Arquitectura y en la memoria del proyecto"
    Antes de esta página, [Arquitectura](arquitectura.md) y la memoria del proyecto describían esta migración como "en curso", con una lista de limpieza sobre archivos de `custom_asignaciones`. Esos archivos ya no existen (ver ADR-04), y las referencias al catálogo legacy tampoco. Ambas fuentes ya quedaron actualizadas; lo único que queda son los restos de la lista de arriba.

## ADR-04: `custom_asignaciones` renombrado a `custom_solicitudes`

**Contexto.** El módulo creció de asignaciones de producto a solicitudes de varios tipos (OLI, NCI, GMT, TIC, GAF, taxis, alimentación, domicilios).

**Decisión.** `19a19cd2a` (2026-04-23, `digital7`) renombra el módulo a `custom_solicitudes` y elimina `custom_asignaciones` ("BREAKING CHANGE" en el mensaje). El mismo commit reescribe el servicio de notificaciones (ADR-05).

**Consecuencia.** Los nombres técnicos de modelos conservan el prefijo `asignacion.*` (`asignacion.request`, `asignacion.producto.linea`…). En el disco local `odoo/custom_addons/custom_asignaciones/` solo quedan carpetas `__pycache__`, sin archivos trackeados en git.

## ADR-05: servicio central de notificaciones que no aborta el negocio

**Contexto.** Muchos eventos de solicitudes avisan a responsables: creación, cambio de fase, devoluciones, NCI, taxi. Un fallo de mensajería no debe revertir una aprobación ni una entrega.

**Decisión.** Un `AbstractModel`, `asignacion.notification.service` (`custom_solicitudes/models/notification_service.py`), concentra el armado y el envío:

- `_enviar()` publica en un `discuss.channel` de tipo `chat` entre emisor y receptor: es Discuss, no correo. Si emisor y receptor son el mismo usuario, el emisor pasa a `base.user_root`.
- Los destinatarios salen de la tarjeta `asignacion.responsable`, no de un grupo de seguridad.
- Cada llamada del negocio va envuelta en `try/except Exception` con `_logger.warning` (por ejemplo `asignacion.request.write()` y `stock.picking._procesar_devolucion_bodega`).
- El correo real (taxi) usa `message_notify()`.

**Consecuencia.** El negocio nunca se cae por una notificación, pero un aviso roto es invisible: solo queda un warning en `/var/log/odoo/odoo-server.log`. Los métodos públicos del servicio están en [API interna](api.md#custom_solicitudes).

## ADR-06: reserva estricta en Alistamiento (ALI-05B)

**Contexto.** `confirm_alistamiento` corría `action_confirm`/`action_assign` dentro de un `try/except` que solo logueaba. La UI decía "Alistamiento confirmado" aunque el OUT no hubiera reservado.

**Decisión.** `6b26f79fa` (2026-09-24): si algún move de **esta** confirmación no reservó exacto, se aborta todo con `UserError` (comentario ALI-05B en `stock_alistamiento.py:1893`). La confirmación va en dos pases desde `79a6d8706`: validar todo antes de crear nada, y luego crear. El move se crea con `skip_rc_auto_assign=True` (`stock_alistamiento.py:1711`), leído por `stock_move_rc.py:33` desde `a8a2acdd5`, para que el auto-assign FIFO no le gane a la reserva explícita.

**Consecuencia.**

- No quedan OUT "confirmados" sin reserva.
- El mismo commit borró `tests/test_confirm_alistamiento_recepcion.py` y `tests/test_ali05_separar_comprar.py` ("no se van a mantener en este repositorio"). ALI-05B y la compra del restante quedan protegidos solo por `UserError` en servidor y prueba manual.
- Entre `6b26f79fa` y `a8a2acdd5` el flag no tenía efecto. Otra ruta que cree moves con `origin` `REQ-<req>-ITEM-<item>` sin el flag vuelve a exponer la doble reserva.

Detalle: [custom_barcode_activos → capítulo 3](modulos/custom_barcode_activos.md#3-alistamiento-cola-separacioncompra-y-reserva-de-stock-03-sep-24-sep).

## ADR-07: etiquetas RC impresas antes de recibir

**Contexto.** Las etiquetas RC se generaban al vuelo al validar la recepción.

**Decisión.** `4e551d09d` (2026-08-28): se imprimen una vez, antes de recibir, y quedan en `stock.rc.label.pending` con código persistido y `UNIQUE(barcode_value)`. Al validar se consumen, primero las `in_progress` del picking y luego `pending` por id.

**Consecuencia.** El código físico existe antes que la unidad. Si faltan etiquetas al validar, la unidad queda con `barcode_value=False` y se avisa en el picking; no se inventa un código. En productos **sin** rastreo, validar sin escanear consume etiquetas `pending` por FIFO: el emparejamiento código↔unidad no está garantizado. Ver [custom_barcode_activos → Bugs y decisiones](modulos/custom_barcode_activos.md#bugs-y-decisiones-relevantes).

## ADR-08: la letra del código RC sigue al tracking

**Contexto.** Con las etiquetas propias de Alistamiento se evaluó darles un prefijo propio (`A`).

**Decisión.** La letra depende del tracking del producto al generar la etiqueta: `lot`→`L`, `serial`→`S`, `none`→`N`, con una secuencia por letra. El origen (`recepcion`, `alistamiento`, `inventario`) va en el campo `origen`. Se descartó el prefijo `A` (bitácora P-005, 2026-09-11). El mapa está centralizado en `rc_label_common.py`.

**Consecuencia.** Un solo regex (`RC_LABEL_RE`) reconoce todas las etiquetas en el escaneo global. Queda abierto que las etiquetas de Alistamiento no crean unidad ni historial, y por eso Devolución no las reconoce.

## ADR-09: impresión ZPL por Zebra Browser Print

**Contexto.** El servidor corre en AWS y no tiene ruta a la IP privada de la impresora Zebra de la bodega.

**Decisión.** `7a73ffce0` (2026-09-15): el servidor genera el ZPL (`get_zpl_chica`) y lo devuelve como datos; el navegador lo envía a la impresora con el SDK Browser Print vendorizado en `static/src/lib/browserprint/`. Solo el tamaño `chica` (32×15 mm) va por ZPL; los demás salen en PDF.

**Consecuencia.** Cada puesto de bodega necesita Browser Print instalado. Como la etiqueta se crea antes de enviarla, `8cec91587` agregó el chequeo de impresora (`hasBrowserPrintDevice`) para no gastar un código si no hay papel. Ver [custom_barcode_activos → Etiquetas CTS/RC](modulos/custom_barcode_activos.md#etiquetas-ctsrc).

## ADR-10: código de OC con prefijo `OC.` sin campo propio

**Contexto.** Bodega buscaba a mano la recepción de cada OC.

**Decisión.** El código de barras se arma en el QWeb como `'OC.%s' % o.name` y se pinta con la ruta nativa `/report/barcode/Code128/...`. No se agrega campo a `purchase.order`: `name` ya es único por la secuencia global. El router `_route_purchase_order` exige el prefijo `OC.` y busca sin `sudo()`.

**Consecuencia.** Nada que migrar ni mantener en BD. El código vive en el reporte que usa bodega (`custom_reportes`, "Orden de Compra CTS"), después de un primer intento en el reporte nativo que bodega no imprime. Ver [custom_compras → Bugs y decisiones](modulos/custom_compras.md#bugs-y-decisiones-relevantes) y [Flujos → OC impresa](flujos.md#3-oc-impresa-escaneo-recepcion-pendiente).

## ADR-11: exigencias por fase en validadores, no en la vista

**Contexto.** `6b57dd387` puso `required` por fase en la vista de la acción correctiva; eso impedía guardar borradores.

**Decisión.** `1760479f4` lo revierte el mismo día (2026-06-04). La exigencia vive en `_check_transition_*`, con tres capas: `@api.onchange('state')` en el formulario vivo, `write()` antes de guardar y `@api.constrains` después, para lo que depende de líneas hijas persistidas.

**Consecuencia.** Se pueden guardar borradores en cualquier fase. Los validadores solo cubren transiciones hacia adelante y de a una fase: retroceder, saltar fases y crear en una fase avanzada no se validan. Ver [custom_sig → Bugs y decisiones](modulos/custom_sig.md#bugs-y-decisiones-relevantes).

## ADR-12: consecutivo de documento SIG: máximo + 1 dentro del rango

**Contexto.** El código de documento se tecleaba a mano. `22296b4ec` midió 34 de 607 códigos fuera del patrón `XX-NNNN` y 7 duplicados.

**Decisión.** `_siguiente_codigo(formato, tipo)` propone máximo + 1 dentro del rango del formato (`formatos.dpto`), sin rellenar huecos. Busca con `sudo()`, porque las `ir.rule` por departamento harían calcular un máximo más bajo. Cuenta también el histórico de versiones.

**Consecuencia.** Sin duplicados al proponer, pero no hay constraint de unicidad que impida guardar un código repetido a mano. Ver [custom_documentos_sig → Bugs y decisiones](modulos/custom_documentos_sig.md#bugs-y-decisiones-relevantes).

## Candidatas sin evidencia suficiente

- **Paginación server-side en Entrega/Devolución.** Solo existe en `fase='admin'` de Entrega; la granularidad (por OT o por documento) sigue sin decidir ([custom_barcode_activos → Pendientes](modulos/custom_barcode_activos.md#pendientes-puntos-por-confirmar)).
- **Chatter de `custom_sig` solo con fases** (`3a0cda4aa`): la decisión existe, pero el commit no dice por qué.
