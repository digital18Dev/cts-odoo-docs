# odoo-docker

Odoo 17 en Docker. Módulos propios en `odoo/custom_addons/`.

## Forma de trabajo

- Antes de modificar, inspeccionar árbol actual y commits relevantes. No asumir que un hallazgo histórico sigue vigente.
- Reproducir → encontrar causa raíz → proponer cambio mínimo → implementar → probar → revisar regresiones.
- Si un patrón puede repetirse, auditar todas las ocurrencias relevantes del mismo dominio.
- Si aparece un defecto de otro dominio funcional, documentarlo con evidencia y trasladarlo; no ampliar alcance salvo bloqueo directo o autorización.
- No mezclar un refactor grande con un cambio funcional grande.
- No dividir archivos solo por tamaño: extraer cuando exista responsabilidad independiente, API clara y pruebas posibles.
- Comentarios: una línea. Justifican el POR QUÉ (constraint oculto, invariante, workaround), no narran el QUÉ.

## Invariantes vs comandos de negocio

No mover lógica automáticamente entre `create`/`write`, constraints y `action_*`.

- Invariante del dato que debe cumplirse desde formulario, tree editable, RPC, importación o Python → proteger en servidor.
- Comando explícito de negocio (escanear, confirmar, validar, imprimir, cancelar, liberar) → puede vivir en método de comando.
- Antes de decidir, identificar todas las rutas que modifican el estado.
- Reglas críticas de negocio no deben depender únicamente del cliente web.

Precedente NCI: `action_toggle_priorizado` no notificaba porque `priorizado` era una casilla editable. Ver regla detallada en `.claude/rules/odoo-development.md`.

## Verificación

- HTTP 200 o `py_compile` no demuestran que el flujo funcione.
- Verificar en BD con `psql` antes de afirmar que el dato quedó correcto.
- Si la tarea requiere navegador y Claude no puede operarlo, dejar el caso UI exacto y verificar después en BD/logs.
- Tras tocar un archivo compartido, probar al menos una regresión del flujo vecino afectado.

## Entorno

Contenedores: `odoo_dev`, `db` (`postgres:14.0`), `pgadmin`, `mailpit` aparte.
BD: `neutralize_21_05`.
Rama: `changes_jorsh`.

Los logs NO salen por `docker logs odoo_dev` porque `odoo.conf` define `logfile`. Leer dentro:

```bash
docker exec odoo_dev sh -c "grep -i 'NOTIF' /var/log/odoo/odoo-server.log | tail -30"
```

`odoo shell` necesita flags. En `odoo.conf`, `addons-path` está con guion y el parser espera `addons_path`; esa línea es inerte. `db_*` están comentados.

```bash
docker exec -i odoo_dev odoo shell -d neutralize_21_05 -c /etc/odoo/odoo.conf \
  --addons-path=/odoo_folder/enterprise,/var/lib/odoo/custom_addons \
  --db_host=db --db_port=5432 --db_user=odoo --db_password=odoo --no-http
```

- Shell no hace auto-commit → `env.cr.commit()`.
- Para actuar como usuario: `rec.with_user(<uid>)`.
- Git Bash: prefijar `MSYS_NO_PATHCONV=1` a `docker exec` con rutas absolutas.
- `workers` debe quedar en `0`: con `workers > 0`, websocket sale por gevent en 8072 y el contenedor/proxy actual no lo enruta.
- Upgrade de módulo y reinicio de contenedores los corre el usuario.
- `odoo.conf` está trackeado y contiene credenciales: no incluirlo en commits de features.

## Dominios

En `custom_barcode_activos` separar:

- Código único RC / etiquetas
- Recepción
- Alistamiento / Separación
- Entrega / Devolución

Un archivo compartido no implica que todos los dominios deban modificarse en la misma tarea.

Las reglas específicas viven en `.claude/rules/`.
El backlog puntual de cada chat NO vive aquí.

## Memoria / Engram

No duplicar el protocolo de Engram aquí: ya llega por instrucciones del servidor MCP de Engram,
el `CLAUDE.md` global del usuario y el skill `engram:memory` (activo). No hay hook `UserPromptSubmit`
específico para Engram — los hooks reales de prompt están en `~/.claude/settings.json`.
