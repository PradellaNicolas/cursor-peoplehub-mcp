# PATCH / DELETE — Time Report API

Mapeado desde la UI de PeopleHub (misma sesión que POST).

| Método | Ruta | Notas |
|--------|------|--------|
| PATCH | `/api/time-report` | Body JSON con `id` + mismos campos que el alta según tipo de fila |
| DELETE | `/api/time-report?id={uuid}` | `id` = `TimeReportRow.id` del listado semanal |

## PATCH — cuerpo parcial (verificado en vivo)

Solo se pueden enviar `id` más estos campos (mensaje de error del API si se manda otro):

- `total_horas` (minutos)
- `cat_otros_conceptos_id`
- `grupo_id`
- `cat_clientes_id`
- `descripcion`
- `rework_id`
- `ticket_cau`

No se puede cambiar `work_date`, `actividad_id`, `modo`, etc. vía PATCH.

Ejemplo mínimo (cambiar solo horas):

```json
{
  "id": "975bd579-f3d3-44d1-a5f1-72d25dac68c7",
  "total_horas": 465
}
```

Respuesta HTTP **200**.

## DELETE

`DELETE /api/time-report?id={id}` — respuesta exitosa sin body relevante (JSON vacío o 200).
