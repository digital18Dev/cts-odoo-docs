# Alistamiento

Preparación, separación y asignación de materiales. Vive dentro de [custom_barcode_activos](../modulos/custom_barcode_activos.md), no es un módulo aparte.

Commits recientes conocidos en este proceso: ventana default y reserva estricta ALI-05B (`6b26f79fa`), comprar restante no separado al validar — ALI-05 (`96a950a4a`), evitar doble reserva RC entre `confirm_alistamiento` y el auto-assign de `move_rc` (`a8a2acdd5`), columna Vigencia en la cola (`88af87c38`), botones Mantener/Comprar en vez de radios en ALI-05 (`6af770be9`).

**Flujo completo:** [custom_barcode_activos → Alistamiento](../modulos/custom_barcode_activos.md#alistamiento) (paso a paso dentro del módulo) y [Flujos → Requisición → Alistamiento / Compra → Recepción → Entrega / Devolución](../flujos.md#2-requisicion-alistamiento-compra-recepcion-entrega-devolucion) (cómo la demanda llega desde `custom_requisiciones` y por qué los contadores son acumulativos, no un estado por ciclo).
