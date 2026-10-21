---
name: pampa-timereport-diario
description: >-
  Time Report diario Pampa (PeopleHub): revisar si hay 8 h cargadas hoy, alertar
  faltante y ayudar a imputar en el AST de célula del usuario (1 o 2 AST). Sin TFS.
  Usar cuando pidan horas hoy, time report, faltan horas, revisar timereport,
  cargar horas Pampa, recordatorio time report.
---

# Time Report diario — Pampa (PeopleHub)

Flujo para **equipo Pampa**: sin TFS. Cada persona tiene **1 AST de célula** (a lo sumo 2). MCP: namespace **peoplehub** (o el configurado en `mcp.json`). Descubrir schema con `GetDynamicTools` antes de cada tool.

## Perfil del usuario

**Ruta por defecto:** `%USERPROFILE%\.pampa-timereport.yaml`

Si el archivo no existe o está incompleto (`actividad_id` del principal en 0), ejecutar **onboarding** antes de Fase B:

1. AST de célula (`ast_principal.actividad_id` o número AST).
2. ¿Segundo AST? (`ast_secundario`, `reparto_dos_ast`: `todo_principal` | `mitad_mitad` | `preguntar_siempre`).
3. `reminder_time`, `timezone`, `concepto_oficina_id` (19 Horas Calendario), `concepto_remoto_id` (85 Hs Trabajo Remoto), `grupo_id`. Inferir IDs con `peoplehub_list_conceptos` / `peoplehub_list_week` si hace falta.
4. Guardar YAML en la ruta por defecto (o la que indique el usuario).

Campos esperados en el YAML: ver `plantilla-perfil.yaml` en el paquete Pampa.

| Parámetro opcional | Default |
|--------------------|---------|
| `target_minutes` | `480` |
| `count_only_actividad_id` | `true` |
| `ok_message_when_full` | `true` |

---

## Fase A — Chequeo (solo lectura)

**Disparo:** “revisar mis horas”, “time report hoy”, “horas de hoy”, o recordatorio según `reminder_time` del perfil.

Orden:

1. Cargar perfil (o onboarding si falta).
2. `peoplehub_session` → si inválido o `list_week` con `[AUTH_REQUIRED]`: `peoplehub_login` (abre **Edge de perfil PeopleHub**, no el cotidiano). Primera vez SSO/MFA en esa ventana; siguientes un clic. **No** sumar hasta OK. No pedir cerrar el Edge habitual.
3. **Hoy:** fecha `YYYY-MM-DD` en `timezone` del perfil (default `America/Argentina/Buenos_Aires`).
4. `peoplehub_list_week` con `reference_date` = hoy.
5. Filtrar filas con `work_date` = hoy; sumar `minutos` (si `count_only_actividad_id`: solo filas con `actividad_id`).
6. `faltante_min = max(0, target_minutes - total_min)`.

Mensajes:

| Condición | Acción |
|-----------|--------|
| `total_min >= target_minutes` | Si `ok_message_when_full`: “OK — 8 h cargadas hoy.” Si no, fin sin mensaje. |
| `0 < total_min < target_minutes` | **Solo alerta:** “Faltan X h Y min.” **Sin** `log_hours`. |
| `total_min == 0` | Alerta + invitar Fase B en chat (AST principal del perfil). |

**No** usar TFS ni Requirements en este skill.

Opcional (no reemplaza las 8 h): si el usuario pregunta por **asistencia / calendario / oficina**, usar `peoplehub_list_calendar` (`GET /api/attendance/me`). Es “Mi calendario”, distinto de `peoplehub_list_week` (declaración). Un día sin reserva de oficina no implica que falten horas de Time Report.

---

## Fase B — Completar horas (interactiva)

Solo en **Agent mode**, tras Fase A con faltante o petición explícita de cargar.

**Regla:** `peoplehub_log_hours` con **`confirm: true`** solo después de **preview** y **sí explícito** del usuario en el turno actual.

1. Recalcular `faltante_min`. Si 0 → no cargar.
2. **Concepto según Mi calendario:** `peoplehub_list_calendar` con `from`/`to` = fecha a imputar.
   - Día con `office: true` → `concepto_oficina_id` (**Horas Calendario**, default 19).
   - Día hábil sin oficina (`office: false`, `blocked_reason` distinto de feriado / fin de semana) → `concepto_remoto_id` (**Hs Trabajo Remoto**, default 85).
   - `blocked_reason` feriado o fin de semana → **no** imputar 8 h de oficina/remoto; avisar. Solo extras si el usuario lo pide.
   - Si el calendario falla: preview con ambos IDs y **preguntar**; no adivinar. Fallback `concepto_id` solo si el usuario elige.
3. **Un AST** (`ast_secundario` null o no definido):
   - Ofrecer: cargar todo el faltante en `ast_principal` (mostrar `label` / `actividad_id`).
4. **Dos AST** (`reparto_dos_ast`):
   - `todo_principal`: todo el faltante en principal.
   - `mitad_mitad`: dos líneas (redondeo claro en preview).
   - `preguntar_siempre`: reparto manual entre principal y secundario.
5. **Preview** (tabla: fecha, AST, horas, minutos, **concepto id + nombre**) + total a cargar + total del día después.
6. Tras OK: `peoplehub_log_hours` con `work_date`, `hours`, `minutes`, `actividad_id` / `activity`, `subactividad_id`, `codigo`, `concepto_id` (el resuelto en el paso 2), `grupo_id`, `rework_id`, **`confirm: true`**.
7. Opcional: `peoplehub_list_week` para confirmar.

Validaciones: no superar `faltante_min` sin confirmación explícita; no POST si entre A y B ya hay 8 h.

`peoplehub_update_hours` / `peoplehub_delete_hours`: solo si el usuario pide corregir (`confirm: true`).

---

## No hacer

- No escribir en PeopleHub en Fase A.
- No `confirm: true` sin preview y sin OK del usuario.
- No exigir TFS ni elegir entre muchos AST si el perfil ya define uno (o dos).
- No usar un solo `concepto_id` fijo si hay calendario: oficina vs remoto según `peoplehub_list_calendar`.
- No inventar `grupo_id` ni IDs de concepto si el perfil los tiene; si faltan, onboarding o `peoplehub_list_conceptos`.

---

## Referencia

Instructivo de instalación: `README-INSTALACION.md` en `.cursor/skills/pampa-timereport-diario/`. Uso diario: `USO-DIARIO.md`.
