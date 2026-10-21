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

```text
Time Report Pampa — repo único (rama feat/peoplehub-list-calendar)

Repo: https://github.com/PradellaNicolas/cursor-peoplehub-mcp
Guía: docs/INSTALACION-PAMPA.md

1. git clone -b feat/peoplehub-list-calendar https://github.com/PradellaNicolas/cursor-peoplehub-mcp.git
2. cd cursor-peoplehub-mcp; npm ci; npm run build
3. mcp.json → scripts/launcher.mjs (tu ruta)
4. .\scripts\install-pampa-skill.ps1
5. plantilla-perfil.yaml → %USERPROFILE%\.pampa-timereport.yaml (tu AST)
6. peoplehub_login

Tras git pull: npm ci; npm run build; .\scripts\install-pampa-skill.ps1 -Force
```
