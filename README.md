# cursor-peoplehub-mcp

MCP (stdio) para consultar y cargar horas en [PeopleHub](https://peoplehub.accusystechnology.com/time-report) de Accusys vía `/api/time-report`, y leer [Mi calendario](https://peoplehub.accusystechnology.com/asistencia?tab=calendario) vía `/api/attendance/me`.

Repositorio: [github.com/PradellaNicolas/cursor-peoplehub-mcp](https://github.com/PradellaNicolas/cursor-peoplehub-mcp)

Nombre del servidor en Cursor: **peoplehub**.

## Requisitos

- Node.js 20+
- Chromium de Playwright (solo para `peoplehub_login`)
- Cursor con MCP habilitado

## Instalación

```powershell
git clone https://github.com/PradellaNicolas/cursor-peoplehub-mcp.git
cd cursor-peoplehub-mcp
npm ci
npx playwright install chromium
npm run build
```

Opcional: copiar `.env.example` a `.env` si necesitás cambiar `PEOPLEHUB_BASE_URL`.

## Cursor (`~/.cursor/mcp.json`)

```json
"peoplehub": {
  "command": "node",
  "args": ["C:/Users/<tu-usuario>/projects/cursor-peoplehub-mcp/scripts/launcher.mjs"]
}
```

Ajustá la ruta al clone local (mismo patrón que [cursor-workflow-hints-mcp](https://github.com/PradellaNicolas/cursor-workflow-hints-mcp)). Recargá Cursor y verificá **Settings → MCP** (`peoplehub` en verde).

## Primer uso

1. Ejecutá **`peoplehub_login`** desde el agente.
2. Se abre Chromium: **Continuar con Microsoft** (MFA si aplica).
3. Al llegar a Time Report, la sesión queda en `%USERPROFILE%\.peoplehub-mcp\storage.json`.
4. **`peoplehub_session`** para verificar.
5. **`peoplehub_list_week`** / **`peoplehub_list_calendar`** / **`peoplehub_log_hours`** (con `confirm: true`).

Cada usuario corre su propio `peoplehub_login`. No commitear `.env` ni `storage.json`.

## MCP tools

| Tool | Descripción |
|------|-------------|
| `peoplehub_login` | SSO Microsoft → guarda sesión local |
| `peoplehub_session` | Estado de sesión |
| `peoplehub_list_week` | Cargas de la semana (Time Report / declaración) |
| `peoplehub_list_calendar` | Mi calendario de asistencia (`GET /api/attendance/me?from=&to=`) |
| `peoplehub_list_activities` | Catálogo actividades |
| `peoplehub_list_conceptos` | Conceptos asociados |
| `peoplehub_list_groups` | Grupos |
| `peoplehub_list_reworks` | Reworks por `actividad_id` |
| `peoplehub_log_hours` | Alta de horas (requiere `confirm: true`) |
| `peoplehub_update_hours` | Editar minutos de un registro (`id` + `confirm: true`) |
| `peoplehub_delete_hours` | Borrar registro por `id` (`confirm: true`) |

Detalle PATCH/DELETE: [`docs/api-patch-delete.md`](docs/api-patch-delete.md). Calendario (solo lectura): [`docs/api-attendance.md`](docs/api-attendance.md).

## Estado local

`%USERPROFILE%\.peoplehub-mcp\`

- `storage.json` — cookies de sesión (Playwright storage state)
- `meta.json` — metadata Supabase para refresh (si aplica)

## Seguridad

- Auth por cookies Supabase/Azure; refresh automático cuando hay `meta.json` con anon key.
- Si expira la sesión: volver a `peoplehub_login`.
- `peoplehub_log_hours` no envía nada sin `confirm: true`.

## Build

```powershell
npm run build
npm start
```
