# `custom_solicitudes` — precedentes verificados

> **Ámbito original:** `odoo/custom_addons/custom_solicitudes/**`. Ver [índice de reglas operativas](index.md).

## Notificaciones

- `models/notification_service.py`
- modelo `asignacion.notification.service`
- fallo de mensajería no aborta negocio: `try/except Exception` + `_logger.warning`
- `_enviar()` usa `discuss.channel` tipo `chat` → Discuss, no correo
- correo real usa `message_notify()`
- emisor cambia a OdooBot si emisor == receptor
- destinatarios: tarjeta `asignacion.responsable` (`empleado_principal_id` + `empleado_id`), NO grupo
- `_sync_user_groups` escribe grupo desde tarjeta, no al revés
- `Datetime` UTC → `_fecha_col()` para evitar corrimiento de 5 horas
- `_build_tabla` usa `white-space:nowrap`

## `asignacion.responsable`

Los 9 registros de `data/categories.xml` van en `<data noupdate="1">`.

Por qué:

- sin eso se reescriben en cada upgrade;
- ese `write` dispara `@api.constrains`;
- una fila sucia puede romper el upgrade completo.

Precedente:

- exigir externos con `notificar_externo` encendido abortó upgrade con `ParseError ... categories.xml:23`.

El `continue` de `_check_externo` sigue siendo load-bearing: sin él, el `raise` de «solo Radio Taxi» evalúa otros tipos.
