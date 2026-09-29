# custom_solicitudes

10 commits de `digital18`, 2026-08-05 → 2026-08-21.

!!! note "Alcance de esta página"
    El módulo es mucho más grande que estos 10 commits (OLI, NCI, GMT, TIC, GAF, taxis, alimentación, domicilios, devoluciones). Visión general, Arquitectura, Modelos, Wizards y Reglas de negocio cubren el módulo tal como está hoy en `changes_stock`, leído directo del código. "Evolución del módulo" cubre solo lo que tocó `digital18`.

## Visión general

`asignacion.request` es el hub de todas las solicitudes: OLI, NCI, GMT, TIC y GAF (asignación de productos/activos) más taxi, alimentación y domicilios. Cada tipo tiene su propio campo de fase (`fase_asignacion` para OLI, `fases_nci` para NCI, etc.).

La tarjeta `asignacion.responsable` decide, por tipo de solicitud, a quién avisar y por qué canal. El envío pasa siempre por el servicio central `asignacion.notification.service` (Discuss o correo, según el evento).

Depende de `custom_inventario` para los campos de producto (`solicitudes_asignacion`, `categoria_oli`, `disponible_prestamo`) y de `stock`/`mrp` nativos para pickings y kits — no tiene catálogo ni stock propio ([ADR-03](../adr.md#adr-03-catalogo-y-stock-propios-reemplazados-por-inventario-nativo)). Se llamó `custom_asignaciones` hasta el 23 de abril de 2026 ([ADR-04](../adr.md#adr-04-custom_asignaciones-renombrado-a-custom_solicitudes)).

## Qué problema resuelve

- **Un solo lugar para pedir productos, activos o servicios.** OLI (préstamo interno), NCI (compra nueva), GMT/TIC/GAF y taxi/alimentación/domicilios comparten modelo, aprobación y notificación en vez de un formulario por tipo.
- **Saber qué tiene cada empleado.** `asignacion.empleado.asignado` lleva solicitado → aprobado → entregado → devuelto → actual, con firma en la entrega y en la devolución.
- **Avisar sin frenar el negocio.** Si notificar falla, la solicitud se crea o se entrega igual; el fallo queda en el log, no en el flujo ([ADR-05](../adr.md#adr-05-servicio-central-de-notificaciones-que-no-aborta-el-negocio)).

## Arquitectura / componentes principales

| Pieza | Archivo | Rol |
|---|---|---|
| `asignacion.request` | `models/asignacion_request.py` | Solicitud y su máquina de fases por tipo |
| `asignacion.producto.linea` | `models/asignacion_producto_linea.py` | Línea de producto o activo fijo, con cantidades solicitada/aprobada/entregada/devuelta |
| `asignacion.responsable` | `models/responsable.py` | Tarjeta de a quién avisar, por tipo de solicitud y canal |
| `asignacion.notification.service` | `models/notification_service.py` | `AbstractModel`, único punto de envío. Ver [API interna](../api.md#custom_solicitudes) |
| `stock_picking_asignacion.py` | hereda `stock.picking` | Exige firma en `button_validate` y actualiza cantidades al validar |
| `taxis_viaticos.py` | — | Solicitud de taxi/viáticos, el único canal que envía correo real |

## Procesos funcionales

El recorrido completo de una solicitud OLI/TIC (aprobación → picking OUT → entrega firmada → devolución) está dibujado en [Flujos → Asignación de productos al empleado](../flujos.md#1-asignacion-de-productos-al-empleado-oli-tic), con el detalle de por qué NCI **no** sigue ese mismo camino. Lo que sigue aquí es lo que tocaron estos 10 commits.

## Evolución del módulo

### Aviso de taxi al responsable

El 5 de agosto nació `notification_service.py`: crear una solicitud en `taxis_viaticos.py` dispara un correo al responsable. Un día después el correo separó destinatario principal de Copia, y luego perdió la cabecera para no verse como plantilla (-62 líneas). El 11 de agosto se simplificó otra vez, en el mismo commit que ajustó la tarjeta kanban. El 20 de agosto se abrió la puerta a un correo externo en Copia y, más tarde ese mismo día, se cerró a solo Radio Taxi.

??? abstract "Commits y archivos del capítulo (6 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `29f319a7c` | 2026-08-05 | Crea `notification_service.py`; el correo se dispara desde `create()` de taxis_viaticos. |
    | `f61a4c4e5` | 2026-08-06 | Separa destinatario principal de Copia (To/Cc). |
    | `45bde07af` | 2026-08-06 | Quita la cabecera del correo, -62 líneas netas. |
    | `5053f4930` | 2026-08-11 | Simplifica el envío de nuevo y arregla la tarjeta kanban en el mismo commit. |
    | `dcd52734f` | 2026-08-20 | Habilita correo externo en Copia. |
    | `09050fe94` | 2026-08-20 | El mismo día, restringe ese correo externo a Radio Taxi únicamente. |

    **Archivos:** `models/notification_service.py`, `models/taxis_viaticos.py`, `models/responsable.py`, `views/views_empleados.xml`

### Tarjeta de responsables en el kanban

La tarjeta que resume responsables mostraba empleados sueltos en vez del responsable principal. Se corrigió el 6 de agosto y de nuevo, junto con el correo de taxi, el 11 de agosto.

??? abstract "Commits y archivos del capítulo (2 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `11f2bc8e1` | 2026-08-06 | La tarjeta muestra al responsable principal, no a empleados sueltos. |
    | `5053f4930` | 2026-08-11 | Segundo ajuste de la tarjeta, junto con la simplificación del correo de taxi. |

    **Archivos:** `views/views_empleados.xml`, `views/taxis_views.xml`

### Priorización de NCI por Discuss

Priorizar una NCI se restringió primero a un grupo dedicado — antes cualquier usuario con acceso a la vista podía hacerlo. El 20 de agosto se sumó aviso por Discuss al crear o priorizar una NCI, pero el aviso de priorización quedó invisible: la lógica corría antes de guardar y no sobrevivía. Se corrigió al día siguiente moviéndola al `write()` — el mismo patrón que [ADR-01](../adr.md#adr-01-invariantes-del-dato-en-servidor-comandos-en-action_) describe para todo el repositorio.

??? abstract "Commits y archivos del capítulo (3 commits)"

    | Commit | Fecha | Qué hizo |
    |---|---|---|
    | `68436b66e` | 2026-08-12 | Restringe el botón Priorizar NCI a un grupo de seguridad dedicado. |
    | `6b7a7291f` | 2026-08-20 | Notifica por Discuss la creación y priorización de una NCI. |
    | `59aff2b53` | 2026-08-21 | Bug: el aviso de priorización no se veía; se mueve la llamada al `write()`. |

    **Archivos:** `models/asignacion_request.py`, `models/notification_service.py`, `security/groups.xml`, `views/views.xml`

## Modelos principales

| Modelo | Representa |
|---|---|
| `asignacion.request` | Solicitud OLI, NCI, GMT, TIC o GAF. `mail.thread`. |
| `asignacion.producto.linea` | Línea de producto (`product.product`) o activo fijo, con las 4 cantidades del ciclo de vida. |
| `asignacion.producto.seleccion` | Productos seleccionables para una asignación o un kit. |
| `asignacion.picking.linea` | Documento de inventario relacionado con una solicitud. |
| `asignacion.empleado.asignado` | Ficha del empleado: asignado, entregado, devuelto. |
| `asignacion.producto.historial` | Historial de movimientos de productos y activos fijos. |
| `asignacion.epp.resumen` | Resumen de EPP por producto, empleado y ubicación. |
| `asignacion.devolucion` (+ `.linea`, `.producto.seleccion`) | Devolución manual de productos asignados. |
| `asignacion.responsable` (+ `.gh`) | Tarjeta de responsables, y responsables de Gestión Humana por categoría OLI. |
| `asignacion.notification.service` | Servicio central de notificaciones (`AbstractModel`). |
| `custom.asig.taxis` (+ `.tickettaxis`, `.tickecabify`) | Solicitud de taxi y sus tickets. |
| `custom.asig.alimentacion` (+ `.colaborador`, `.clasificacion`) | Solicitud de alimentación. |
| `custom.asig.domi` (+ `.empresa.domicilios`) | Solicitud de domicilio. |

Extensiones: `stock.picking`, `stock.move`, `custom.activos.fijos`, `hr.employee`, `res.users`, `documents.document`. Campos de producto que usa pero no define (`solicitudes_asignacion`, `categoria_oli`, `disponible_prestamo`, `qty_devolucion_danada`) viven en `custom_inventario`. Detalle completo en [Modelos → custom_solicitudes](../modelos.md#custom_solicitudes).

## Wizards / vistas / JS relevantes

Wizards de aprobación (`asignacion.aprobacion.wizard`, `asignacion.marcador.wizard`, `asig.oli.firma.wizard`…) y de devolución (`devolucion.marcador.wizard`, `asignacion.kit.devolucion.wizard`…) — tabla completa con el método que abre cada uno en [Wizards → custom_solicitudes](../wizards.md#custom_solicitudes).

JS: `seleccion_kanban.js` (selección de productos, confirma con `action_confirmar_seleccion`), `marcador_wizard.js` (listas de los wizards de marcadores). Vista: `views/stock_picking_asignacion.xml` agrega las firmas que exige `button_validate`. Detalle en [Vistas → custom_solicitudes](../vistas.md).

## Reglas de negocio

- `cantidad_entregada` nunca pasa de `cantidad_aprobada`; `cantidad_devuelta_total` nunca pasa de lo entregado (`_procesar_asignacion_post_validate` / `_procesar_devolucion_post_validate`).
- `stock.picking.button_validate` exige `firma_asignacion_empleado` (OUT de asignación) o `firma_recibido_devolucion` (devolución) antes del `super()`.
- Las notificaciones nunca abortan una operación de negocio: van en `try/except Exception` con solo un `_logger.warning` ([ADR-05](../adr.md#adr-05-servicio-central-de-notificaciones-que-no-aborta-el-negocio)).
- NCI **no** pasa por el flujo de picking de OLI/TIC: `action_aprobar_oli` rechaza cualquier tipo que no sea `oli`/`tic`, y `asignacion_request.py` no referencia `purchase.order`. Sus fases OC y Recepción se mueven a mano.
- Las líneas de activo fijo no generan `stock.move`: se procesan aparte con `cantidad_aprobada=1` fijo.

## Bugs y decisiones relevantes

!!! warning "Riesgo conocido — sin corregir"
    Duplicar (`copy()`) una solicitud de taxi vuelve a disparar `notificar_taxi_creada` y consume un número de secuencia TAX nuevo. `create()` en `taxis_viaticos.py:163-164` todavía usa la firma `@api.model` de Odoo ≤16, mientras los otros dos `create()` del mismo archivo (líneas 213 y 282) ya migraron a `@api.model_create_multi`. Un `create()` en lote sobre este modelo **no** revienta con `TypeError` — Odoo 17 envuelve `@api.model` con `model_create_single` (`odoo/api.py`), que itera la lista y llama a `create()` una vez por dict, dejando solo un warning "is not overriding the create method in batch" en el log. Sigue siendo la firma vieja y genera ruido en el log, pero no rompe la creación en lote. Detectado el 2026-08-05 revisando logs de `neutralize_21_05`, no corregido en estos 10 commits.

!!! warning "`notificar_solicitud_creada` no entrega el mensaje (lectura de código, sin probar en BD)"
    `_build_card(self, badge, doc_name_html, doc_sub, saludo, tabla_html, ...)` exige `doc_sub` sin valor por defecto (`notification_service.py:128`). La llamada de `notificar_solicitud_creada` (línea 478) tiene `doc_sub` comentado. Las otras 12 llamadas a `_build_card` sí lo pasan. El `TypeError` cae dentro del `try` por destinatario de `_enviar()`, así que la solicitud se crea igual y solo queda un warning en el log. No es de estos 10 commits, pero afecta el mismo servicio que `59aff2b53` tocó. Pendiente confirmar en `/var/log/odoo/odoo-server.log` creando una solicitud OLI.

## Historial de commits

| # | Commit | Fecha | Mensaje |
|---|---|---|---|
| 1 | `29f319a7c` | 2026-08-05 | Notificar por correo al responsable al crear solicitud de taxi |
| 2 | `f61a4c4e5` | 2026-08-06 | Add primary recipient and To/Cc taxi notifications |
| 3 | `45bde07af` | 2026-08-06 | Simplificar correo de taxi sin cabecera |
| 4 | `11f2bc8e1` | 2026-08-06 | Tarjeta responsable muestra principal, no empleados |
| 5 | `5053f4930` | 2026-08-11 | Corregir tarjeta kanban de responsables y simplificar correo de taxi |
| 6 | `68436b66e` | 2026-08-12 | Restringir Priorizar NCI a grupo dedicado |
| 7 | `dcd52734f` | 2026-08-20 | Permitir correo externo en Cc de notificación de taxi |
| 8 | `6b7a7291f` | 2026-08-20 | Notificar por Discuss creación y priorización de NCI |
| 9 | `09050fe94` | 2026-08-20 | Limitar correo externo de responsable a Radio Taxi |
| 10 | `59aff2b53` | 2026-08-21 | BUG notificar por Discuss priorización de NCI, se ajusta para ejecutarse desde el write |

## Pendientes / puntos por confirmar

- [ ] Confirmar en `/var/log/odoo/odoo-server.log` el `TypeError` de `notificar_solicitud_creada` creando una solicitud OLI real.
- [ ] `asignacion.seleccion.cat.wizard` solo tiene vista (`aprobacion_wizard_views.xml`); ningún método Python lo abre por nombre. Confirmar su punto de entrada real o si quedó huérfano.
- [ ] GMT, GAF (`_crear_documento_gaf`) y el flujo SST de EPP (`action_finalizar_sst`) no tienen flujo documentado — ver [Flujos → pendiente de documentar](../flujos.md#1-asignacion-de-productos-al-empleado-oli-tic).
- [ ] Migrar `taxis_viaticos.py.create()` (línea 163) a `@api.model_create_multi`, igual que los otros dos `create()` del mismo archivo.
