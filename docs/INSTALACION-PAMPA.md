# Instalación Pampa — Time Report en Cursor

MCP PeopleHub y skill **`pampa-timereport-diario`** en el mismo repositorio.

- **Repo:** https://github.com/PradellaNicolas/cursor-peoplehub-mcp
- **Rama:** `feat/peoplehub-list-calendar` (hasta que se mergee a `main`)

## Requisitos

- Node.js 20+
- Git
- Microsoft Edge
- Cursor con MCP habilitado
- Cuenta Accusys en [PeopleHub Time Report](https://peoplehub.accusystechnology.com/time-report)

## 1. Clonar e instalar el MCP

```powershell
git clone -b feat/peoplehub-list-calendar https://github.com/PradellaNicolas/cursor-peoplehub-mcp.git
cd cursor-peoplehub-mcp
npm ci
npm run build
```

## 2. Registrar el servidor en Cursor

En `%USERPROFILE%\.cursor\mcp.json`, agregá `peoplehub` con la ruta absoluta a `scripts/launcher.mjs` de **tu** clone:

```json
{
  "mcpServers": {
    "peoplehub": {
      "command": "node",
      "args": [
        "C:/Users/<tu-usuario>/projects/cursor-peoplehub-mcp/scripts/launcher.mjs"
      ]
    }
  }
}
```

**Developer: Reload Window**. En Settings → MCP, `peoplehub` tiene que quedar en verde.

## 3. Instalar el skill

Desde la raíz del clone:

```powershell
.\scripts\install-pampa-skill.ps1
```

Copia `skills/pampa-timereport-diario` a `%USERPROFILE%\.cursor\skills\pampa-timereport-diario`.

Si esa carpeta ya existe, usá `-Force`:

```powershell
.\scripts\install-pampa-skill.ps1 -Force
```

Ejecutá el script **desde la raíz del clone**. Después de un `git pull` que cambie `skills/`, volvé a correrlo con `-Force` y recargá Cursor si el agente no toma la versión nueva.

## 4. Perfil personal

Copiá `skills/pampa-timereport-diario/plantilla-perfil.yaml` a `%USERPROFILE%\.pampa-timereport.yaml` y completá **tu** AST (`ast_principal.actividad_id`) y `grupo_id`.

No compartas ese archivo.

## 5. Login y prueba

En Agent mode pedí `peoplehub_login` (Edge de perfil aparte; no hace falta cerrar tu Edge habitual).

Luego:

> Revisar mis horas de hoy (time report Pampa)

o `/pampa-timereport-diario`.

## Actualizar

```powershell
git pull
npm ci
npm run build
.\scripts\install-pampa-skill.ps1 -Force
```

## Seguridad

No commitear `.env`, `storage.json`, `edge-profile/` ni `.pampa-timereport.yaml`. `peoplehub_log_hours` no envía nada sin `confirm: true`.

## Mensaje para el equipo

Pegá esto en Teams. Cada persona abre Cursor en **Agent mode** y pega solo el bloque **PROMPT**.

```text
Time Report Pampa — instalación asistida por Cursor

1. Abrí Cursor en Agent mode.
2. Copiá y pegá el bloque "PROMPT" de abajo en el chat.
3. Tené a mano tu número de AST de célula y el grupo (PeopleHub).
4. Cuando se abra Edge (perfil PeopleHub), completá Microsoft SSO si pide.

Guía completa en el repo: docs/INSTALACION-PAMPA.md (rama feat/peoplehub-list-calendar).

--- PROMPT (copiar desde la línea siguiente) ---

Instalá Time Report Pampa en esta PC siguiendo docs/INSTALACION-PAMPA.md del repo cursor-peoplehub-mcp.

Repo: https://github.com/PradellaNicolas/cursor-peoplehub-mcp
Rama: feat/peoplehub-list-calendar

Hacé vos todos los pasos que puedas en Agent mode:
1) Si no tengo el repo, git clone -b feat/peoplehub-list-calendar en %USERPROFILE%\projects\cursor-peoplehub-mcp; si ya existe, git pull en esa carpeta.
2) npm ci y npm run build en la raíz del clone.
3) Configurá o actualizá %USERPROFILE%\.cursor\mcp.json con el servidor peoplehub apuntando a scripts\launcher.mjs (ruta absoluta del clone). No borres otros MCP.
4) Ejecutá .\scripts\install-pampa-skill.ps1 -Force desde la raíz del repo.
5) Si no existe %USERPROFILE%\.pampa-timereport.yaml, preguntame mi AST de célula (actividad_id) y grupo_id, y creá el perfil desde skills\pampa-timereport-diario\plantilla-perfil.yaml.
6) peoplehub_login y verificá peoplehub_session.
7) Probá Fase A del skill: revisar mis horas de hoy (time report Pampa).

Decime en cada paso qué hiciste. Si algo requiere mi clic en Edge o mi AST, pedilo antes de seguir.
```

### Actualizar después de un `git pull`

```text
Actualizá mi instalación Time Report Pampa: en mi clone de cursor-peoplehub-mcp (rama feat/peoplehub-list-calendar) hacé git pull, npm ci, npm run build y .\scripts\install-pampa-skill.ps1 -Force. Decime si cambió algo en skills/ o MCP.
```
