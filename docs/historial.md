# Historial técnico

127 commits de `digital18@industriascts.com.co` en `changes_stock`, 2026-05-27 → 2026-09-29. Orden cronológico ascendente.

Agrupado por tema (no en crudo) en la página de cada módulo: ver [Módulos](modulos/index.md) para el resumen con conteos reales y el link a la sección "Historial de commits" de cada uno.

| # | Commit | Fecha | Mensaje |
|---|---|---|---|
| 1 | `b7243624f` | 2026-05-27 | Inicio modulo custom sig |
| 2 | `f478b1bd2` | 2026-05-29 | feat(sig): crear modelos de acciones correctivas, correcciones y planes de acción |
| 3 | `3f6c5a6f5` | 2026-05-29 | feat(sig): crear vistas y menús para los modelos del sistema |
| 4 | `33e42fff4` | 2026-05-29 | feat(sig): configurar seguridad, permisos y datos iniciales del módulo |
| 5 | `545a07ecb` | 2026-05-29 | docs(sig): agregar documentación del módulo SIG |
| 6 | `670c581f7` | 2026-05-29 | refactor(sig): eliminar archivos genéricos heredados |
| 7 | `ffb7a325d` | 2026-06-01 | feat(sig): implementar vista de formulario para sig.correccion |
| 8 | `334cf08da` | 2026-06-01 | feat(sig): completar validaciones de transicion y constraint de fecha_deteccion |
| 9 | `8286b3341` | 2026-06-01 | docs(sig): actualizar documentacion del statusbar clickable |
| 10 | `911280214` | 2026-06-01 | feat(sig): implementar vista de formulario para sig.plan_accion |
| 11 | `60eabb07f` | 2026-06-02 | feat(sig): implementar validaciones de transicion y mejoras de vista en sig.correccion |
| 12 | `9875a1629` | 2026-06-02 | feat(sig): implementar validaciones de transicion y mejoras de vista en sig.plan.accion |
| 13 | `00fca8a7d` | 2026-06-02 | fix(sig): corregir validacion de transicion a revision y alinear colores del kanban |
| 14 | `7a225e466` | 2026-06-02 | refactor(sig): reemplazar statusbar por dropdown y avance automatico de estado |
| 15 | `506ee1c9d` | 2026-06-02 | fix(sig): corregir perdida de campos y errores fantasma en cambio de fase |
| 16 | `909f753b7` | 2026-06-03 | fix(sig): evitar perdida de lineas hijas al cambiar de fase y endurecer validaciones de transicion |
| 17 | `69da4abe2` | 2026-06-03 | feat(sig): estructurar fase Revision en dos columnas y exigir campos para finalizar |
| 18 | `a12050ca2` | 2026-06-03 | fix(sig): corregir desync UI/BD al pasar a Revision validando hijos en el onchange |
| 19 | `68493fb45` | 2026-06-04 | feat(sig): mostrar resumen de solo lectura en la fase Finalizado |
| 20 | `6a676743d` | 2026-06-04 | feat(sig): permitir fechas pasadas y futuras en AC, correcciones y planes |
| 21 | `cc0969ab8` | 2026-06-04 | chore: ignorar artefactos de tooling en .atl/ |
| 22 | `2074f108e` | 2026-06-04 | refactor(sig): reorganizar layout del formulario de corrección |
| 23 | `29ffbaf39` | 2026-06-04 | feat(sig): reordenar el notebook para abrir en la fase actual |
| 24 | `6b57dd387` | 2026-06-04 | feat(sig): exigir campos obligatorios por fase en la UI |
| 25 | `1760479f4` | 2026-06-04 | revert(sig): quitar required obligatorio por fase de la UI |
| 26 | `fb6f28377` | 2026-06-05 | refactor(sig): renombrar grupos de seguridad y agregar roles restringidos |
| 27 | `8810d8660` | 2026-06-05 | feat(sig): habilitar tracking de chatter en campos de los tres modelos |
| 28 | `a9d5e590f` | 2026-06-05 | feat(sig): agregar widget de ayuda sig_help_modal con ejemplos por fase |
| 29 | `e1a94d6a8` | 2026-06-05 | refactor(sig): reordenar campos del grupo Registro en dos columnas |
| 30 | `430616e13` | 2026-06-05 | docs(sig): eliminar documentacion obsoleta del modulo |
| 31 | `6f531dde3` | 2026-06-09 | refactor(sig): migrar campo norma de Selection a Many2many con catalogo sig.norma |
| 32 | `1f043ee4a` | 2026-06-09 | refactor(sig): rediseñar widget de ayuda con estilo Bootstrap 5 |
| 33 | `02cab6d9b` | 2026-06-09 | refactor(sig): reordenar notebook en secuencia natural de fases |
| 34 | `8148b87d2` | 2026-06-09 | chore: ignorar archivos de aider |
| 35 | `09d262411` | 2026-06-09 | chore(sig): cambiar noupdate a 0 en grupos de seguridad |
| 36 | `e35f14bf9` | 2026-06-09 | feat(sig): propagar tracking de hijos al chatter del padre |
| 37 | `82c207cb5` | 2026-06-10 | test(sig): cubrir propagación de tracking de hijos al padre |
| 38 | `87ed0e185` | 2026-06-10 | fix(sig): evitar apertura de registro en many2one con no_open |
| 39 | `f56d73e82` | 2026-06-10 | refactor(sig): aplanar notebook y forzar readonly por campo en accion correctiva |
| 40 | `fe92f175e` | 2026-06-10 | feat(sig): restringir edicion de control de calidad a admin y auditar firmas |
| 41 | `cd7741e11` | 2026-06-10 | feat(sig): agregar gestion de normas/procedimientos |
| 42 | `707d434a3` | 2026-06-11 | fix(sig): corregir ortografía y tildes en labels y mensajes |
| 43 | `36b386471` | 2026-06-11 | feat(sig): agregar ícono del módulo al app switcher |
| 44 | `68097d4b2` | 2026-06-11 | style(sig): ajustar color de labels en modal de ayuda |
| 45 | `ef2f567b7` | 2026-06-11 | refactor(sig): eliminar cron jobs y notificaciones por email |
| 46 | `2a51c1798` | 2026-06-11 | docs(sig): add Sphinx-style docstrings to model methods |
| 47 | `45d7a7390` | 2026-06-11 | chore(sig): remove dead controllers dir, unused imports and commented markup |
| 48 | `c6f5ca010` | 2026-06-12 | feat(custom_empleados): migrar campos personalizados hr.employee de v13 a v17 |
| 49 | `70a6591ec` | 2026-06-16 | feat(custom_empleados): agregar campo Conductor Autorizado en ficha de empleado |
| 50 | `7df0bbe94` | 2026-06-16 | feat(custom_sig): eliminar exigencia de NC Anterior en accion correctiva |
| 51 | `b15afefb8` | 2026-06-16 | fix(custom_sig): coherencia de eficacia en plan de accion |
| 52 | `31db3aa4f` | 2026-06-16 | feat(custom_sig): reordenar pagina Correccion y Analisis y mostrar los 5 porques completos |
| 53 | `3a0cda4aa` | 2026-06-17 | feat(custom_sig): rastrear en el chatter solo los cambios de fase |
| 54 | `a38311b0e` | 2026-06-17 | feat(custom_sig): agregar helpers de ejemplo en correccion y plan de accion |
| 55 | `defc8d1e5` | 2026-06-23 | feat(custom_sig): consolidar alertas de paso a Revision en una sola |
| 56 | `11f72cad8` | 2026-06-23 | feat(custom_sig): no notificar por correo la firma del lider |
| 57 | `de7835234` | 2026-06-24 | feat(documentos-sig): agrupar actas por empleado aprobador y estado de firmas |
| 58 | `83a7eab67` | 2026-06-25 | feat(documentos-sig): convertir ente certificador de Selection a Many2one |
| 59 | `1dad152c4` | 2026-06-26 | fix(custom_despachos): heredar departamento y ciudad del origen en PQR |
| 60 | `88d568866` | 2026-06-26 | feat(custom_sig): restringir visibilidad de AC por area via record rules |
| 61 | `9afa7faf0` | 2026-06-30 | feat(custom_clientes): agregar correo de facturación en cliente con validación de unicidad |
| 62 | `a3c0b8ed1` | 2026-07-03 | Modificaciones para pull request a req (nombres de grupo en custom_empleados, limpieza de gitignore/modelfile, reubicación de doc del widget) |
| 63 | `5e332de6c` | 2026-07-03 | Fix(custom_clientes) se comenta el campo de correo de facturacion |
| 64 | `d244497ff` | 2026-07-03 | Fix(custom_clientes) se comenta el campo de correo de facturacion |
| 65 | `ab51aae72` | 2026-07-03 | Fix(custom_clientes) se comenta el campo de correo de facturacion (duplicado de #64, otro padre) |
| 66 | `a182ac982` | 2026-08-04 | feat(barcode): escanear código de OC para saltar a recepción pendiente |
| 67 | `67f781b24` | 2026-08-04 | feat(barcode): columnas Comprado/Recepcionado y agrupación por Producto en escaneo |
| 68 | `8efc4d1ef` | 2026-08-04 | fix(barcode): resolver ambigüedad de OT en wizard analítico según filtros activos |
| 69 | `74e86b11f` | 2026-08-04 | refactor(barcode): mover menús de bodega de Requisiciones a Inventario |
| 70 | `d5ad2b300` | 2026-08-04 | feat(barcode): agregar menú Recepción en Inventario reutilizando el lector |
| 71 | `8d67310ee` | 2026-08-04 | fix(compras): imprimir el código de la OC en el reporte que usa bodega |
| 72 | `4dbdf92f9` | 2026-08-04 | fix(barcode): no expulsar del filtro el grupo desplegado durante la captura |
| 73 | `bf26e15ae` | 2026-08-04 | refactor(barcode): unificar la etiqueta de producto entre fila, sección y dropdown |
| 74 | `7d42b1e5d` | 2026-08-04 | fix(barcode): resolver la línea exacta al escanear con filtro OT/Proyecto activo |
| 75 | `8fefd7926` | 2026-08-04 | chore(compras): eliminar reportes de compra sin usar |
| 76 | `29f319a7c` | 2026-08-05 | feat(custom_solicitudes): notificar por correo al responsable al crear solicitud de taxi |
| 77 | `f61a4c4e5` | 2026-08-06 | feat(custom_solicitudes): add primary recipient and To/Cc taxi notifications |
| 78 | `45bde07af` | 2026-08-06 | feat(custom_solicitudes): simplificar correo de taxi sin cabecera |
| 79 | `11f2bc8e1` | 2026-08-06 | fix(custom_solicitudes): tarjeta responsable muestra principal, no empleados |
| 80 | `214964bdd` | 2026-08-06 | feat(custom_activos_fijos): agregar página Control de cambio para activos consumibles |
| 81 | `5053f4930` | 2026-08-11 | fix(custom_solicitudes): corregir tarjeta kanban de responsables y simplificar correo de taxi |
| 82 | `c5469fc7d` | 2026-08-11 | fix(custom_activos_fijos): corregir control de cambios de activos consumibles |
| 83 | `83b408b48` | 2026-08-11 | feat(documentos-sig): añadir búsqueda de empleado y firma pendiente por aprobador en actas |
| 84 | `68436b66e` | 2026-08-12 | feat(solicitudes): restringir Priorizar NCI a grupo dedicado |
| 85 | `69032247b` | 2026-08-18 | feat(barcode): agregar selector de tamano/diseno a etiquetas CTS y RC |
| 86 | `4dea7e809` | 2026-08-20 | fix(barcode): forzar tamano/modo chica+con_ot en impresion RC al validar |
| 87 | `dcd52734f` | 2026-08-20 | feat(custom_solicitudes): permitir correo externo en Cc de notificación de taxi |
| 88 | `6b7a7291f` | 2026-08-20 | feat(custom_solicitudes): notificar por Discuss creación y priorización de NCI |
| 89 | `09050fe94` | 2026-08-20 | fix(custom_solicitudes): limitar correo externo de responsable a Radio Taxi |
| 90 | `59aff2b53` | 2026-08-21 | feat(custom_solicitudes): BUG notificar por Discuss priorización de NCI, se ajusta para ejecutarse desde el write |
| 91 | `3bdef5880` | 2026-08-21 | feat(custom_documentos_sig): ordenar formatos por rango numérico |
| 92 | `22296b4ec` | 2026-08-21 | feat(custom_documentos_sig): autocompletar consecutivo en codigo_actual |
| 93 | `b52a33b4c` | 2026-08-21 | feat(custom_documentos_sig): la version hereda el codigo del documento |
| 94 | `4e551d09d` | 2026-08-28 | feat(barcode): generar etiquetas RC antes de recibir y estandarizar lista de Recepción |
| 95 | `3ae2c8d2a` | 2026-08-31 | fix(barcode): reconectar wizard de tamano en Etiqueta CTS de producto |
| 96 | `3367002a3` | 2026-08-31 | feat(barcode): agregar boton para elegir diseno de Etiquetas RC en Recepcion |
| 97 | `2aa0416e0` | 2026-08-31 | refactor(barcode): eliminar boton obsoleto de Etiquetas RC en Recepcion |
| 98 | `5b397bf90` | 2026-09-02 | feat(barcode): agregar boton Imp Etiq 17x17 en Recepcion |
| 99 | `12875bfd0` | 2026-09-03 | Fix(barcode): sin esto separacion_confirmada queda False para siempre y el write() de custom_requisiciones bloquea cualquier cambio futuro en el picking |
| 100 | `438703aa0` | 2026-09-11 | feat(barcode): agrega wizard de etiqueta de línea para Alistamiento |
| 101 | `7440f2e35` | 2026-09-11 | feat(barcode): cola derivada de Alistamiento y retiro de Solicitudes de Bodega |
| 102 | `bb8001012` | 2026-09-15 | fix(barcode): resolver OT real cuando una linea de compra es compartida por varias requisiciones |
| 103 | `7a73ffce0` | 2026-09-15 | feat(barcode): impresion ZPL directa a Zebra via Browser Print (POC Ruta B) |
| 104 | `c8f31bae9` | 2026-09-15 | feat(barcode): entrega en vivo por escaneo de numeracion unica |
| 105 | `e119c935d` | 2026-09-15 | fix(barcode): foco de Rastreo solo en serial y doble conteo al capturar lote |
| 106 | `5cf436141` | 2026-09-15 | refactor(barcode): renombrar pestañas de perfil de Alistamiento |
| 107 | `2a3df282a` | 2026-09-15 | fix(barcode): reusar CtsChipsCell en Serial/Lote de Alistamiento y ajustar fila al nativo |
| 108 | `68368f4ea` | 2026-09-15 | feat(barcode): reconocer RC en Entrega, automatizar validación de requisición y acotar carga por fecha |
| 109 | `dca126d6d` | 2026-09-19 | feat(barcode): etiquetas RC propias de Alistamiento con ubicacion y lote/serial real |
| 110 | `79a6d8706` | 2026-09-19 | feat(barcode): ubicacion de separacion por linea y confirm_alistamiento con trazabilidad exacta por move |
| 111 | `71bf4e1ed` | 2026-09-19 | feat(barcode): reconocer etiquetas RC de Alistamiento en Entrega y mostrar trazabilidad de requisicion |
| 112 | `22bd1fef5` | 2026-09-19 | feat(barcode): Recepcion por semana actual, estado Parcial y aviso al salir con escaneos sin validar |
| 113 | `e06eaa0f2` | 2026-09-21 | feat(barcode): reimpresion de etiquetas RC existentes desde Recepcion (REC-01) |
| 114 | `2b20b8545` | 2026-09-21 | fix(barcode): filtro Fecha limite por date_planned por linea en Recepcion |
| 115 | `96a950a4a` | 2026-09-21 | feat(barcode): comprar restante no separado al validar Alistamiento (ALI-05) |
| 116 | `477ef4035` | 2026-09-21 | feat(barcode): ventana por defecto de 3 dias habiles en cola pendiente de Alistamiento |
| 117 | `8cec91587` | 2026-09-24 | feat(barcode): contador de reimpresion RC (REC-01) y chequeo de impresora antes de consumir etiqueta |
| 118 | `968799687` | 2026-09-24 | perf(barcode): hidratar Proyecto/OT/Requisicion en batch en vez de por linea |
| 119 | `6b26f79fa` | 2026-09-24 | feat(barcode): Alistamiento — ventana default, ALI-05B reserva estricta y cola de escaneo mas liviana |
| 120 | `a8a2acdd5` | 2026-09-24 | fix(barcode): evitar doble reserva RC entre confirm_alistamiento y el auto-assign de move_rc |
| 121 | `a217da06d` | 2026-09-24 | perf(barcode): Recepcion — lista de OC mas liviana y calendario compartido |
| 122 | `8a967a540` | 2026-09-24 | fix(barcode): Entrega Admin — paginacion server-side (bug real: fase vacia cargaba todo sin tope) |
| 123 | `a495121a4` | 2026-09-28 | perf(barcode): extender paginacion server-side de Entrega a todas las fases (no solo Admin) |
| 124 | `9d756afbc` | 2026-09-29 | feat(barcode): liberar etiquetas RC si el ZPL no llega a imprimir |
| 125 | `88af87c38` | 2026-09-29 | feat(barcode): columna Vigencia (vigente/vencida) en cola de Alistamiento |
| 126 | `667d31da9` | 2026-09-29 | fix(barcode): bloquear generar etiquetas cuando ya no queda pendiente |
| 127 | `6af770be9` | 2026-09-29 | refactor(barcode): botones Mantener/Comprar en vez de radios en ALI-05 |
