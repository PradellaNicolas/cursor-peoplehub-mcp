# Asistencia — Mi calendario

Pantalla: `https://peoplehub.accusystechnology.com/asistencia?tab=calendario`

No es Time Report (`/api/time-report`).

## Lectura

| Método | Path | Uso |
|--------|------|-----|
| GET | `/api/attendance/me` | Semana actual (default del front) |
| GET | `/api/attendance/me?from=YYYY-MM-DD&to=YYYY-MM-DD` | Rango (p. ej. mes) |

Tool MCP: **`peoplehub_list_calendar`**.

Respuesta sanitizada: días (`date`, `state`, oficina sí/no, sede, piso), patrón semanal, cuota min/max. No incluye `user_id`, patentes ni UUIDs de reserva.

## Escritura (fuera de alcance del MCP)

El front usa `PUT /api/attendance/pattern` y `POST`/`PATCH`/`DELETE /api/attendance/bookings`. El MCP no las expone.
