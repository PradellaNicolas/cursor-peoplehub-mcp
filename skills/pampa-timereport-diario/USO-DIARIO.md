# Uso diario — Time Report Pampa (Cursor)

## Primera vez (si aún no configuraste)

Decile al agente en **Agent mode**, por ejemplo:

> Quiero configurar time report Pampa. Mi AST de célula es [número]. Recordatorio a las [HH:MM].

O completá vos `%USERPROFILE%\.pampa-timereport.yaml` siguiendo `plantilla-perfil.yaml` y `README-INSTALACION.md`.

Asegurate de haber corrido **`peoplehub_login`** al menos una vez (ventana Edge de PeopleHub, perfil aparte; tu Edge cotidiano no hace falta cerrarlo).

---

## Cada día

1. A la hora que elegiste (o cuando termines el día), abrí Cursor y escribí:

   > Revisar mis horas de hoy

2. **Si dice que tenés 8 h:** listo.

3. **Si dice “Faltan X h Y min”:** solo es un aviso; no se cargó nada automáticamente. Si querés completar:

   > Sí, cargá el faltante en mi AST

4. **Revisá la tabla de preview** (fecha, AST, horas, **concepto**). Oficina según calendario → Horas Calendario; día hábil sin oficina → Hs Trabajo Remoto. Confirmá solo si está bien.

5. El agente registra en PeopleHub; podés verificar en la web de Time Report.

**Calendario / oficina** (otro módulo): “¿qué dice mi calendario de asistencia?” usa `peoplehub_list_calendar`, no las 8 h de declaración.

---

## Dos células (dos AST)

Si en tu perfil tenés `ast_secundario`, el agente reparte según `reparto_dos_ast` (`todo_principal`, `mitad_mitad` o te pregunta cada vez).

---

## Si algo falla

| Síntoma | Qué hacer |
|---------|-----------|
| “Sesión expirada” / AUTH_REQUIRED | **`peoplehub_login`** (SSO o un clic en la ventana sidecar) |
| MCP peoplehub en rojo | Revisar ruta en `%USERPROFILE%\.cursor\mcp.json` y `npm run build` en el clone del MCP |
| No encuentra tu AST | Revisar `actividad_id` en `.pampa-timereport.yaml` |
| No querés cargar sin mirar | Nunca confirmes el preview si los datos no coinciden |

---

## Qué no hace esta herramienta

- No usa TFS ni tarjetas de sprint.
- No carga horas sin tu confirmación explícita después del preview.
