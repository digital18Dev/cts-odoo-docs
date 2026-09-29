# Recepción

Recepción de mercadería, registro de OC y control de ingresos. Vive dentro de [custom_barcode_activos](../modulos/custom_barcode_activos.md), no es un módulo aparte.

Commits recientes conocidos en este proceso: lista de OC más liviana y calendario compartido (`a217da06d`), filtro de fecha límite por línea (`2b20b8545`), reimpresión de etiquetas RC (`e06eaa0f2`), estado Parcial y aviso al salir con escaneos sin validar (`22bd1fef5`), bloquear generar etiquetas cuando ya no queda pendiente (`667d31da9`).

**Flujo completo:** [custom_barcode_activos → Recepción](../modulos/custom_barcode_activos.md#recepcion) (paso a paso dentro del módulo) y [Flujos → Requisición → Alistamiento / Compra → Recepción → Entrega / Devolución](../flujos.md#2-requisicion-alistamiento-compra-recepcion-entrega-devolucion) (dónde entra y sale del resto del sistema). También cruza con [Flujos → OC impresa → escaneo → recepción pendiente](../flujos.md#3-oc-impresa-escaneo-recepcion-pendiente).
