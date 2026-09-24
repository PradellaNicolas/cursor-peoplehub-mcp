/**
 * Verificación local de PATCH/DELETE (usa ~/.peoplehub-mcp/storage.json).
 * Uso: node scripts/verify-update-delete.mjs
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const base = process.env.PEOPLEHUB_BASE_URL ?? 'https://peoplehub.accusystechnology.com';
const storagePath = join(
  process.env.USERPROFILE ?? process.env.HOME ?? '',
  '.peoplehub-mcp',
  'storage.json',
);

function cookieHeader(state) {
  return state.cookies
    .filter((c) => c.domain?.includes('peoplehub'))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

async function api(method, path, body) {
  const state = JSON.parse(readFileSync(storagePath, 'utf8'));
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Cookie: cookieHeader(state),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: res.status, data };
}

function buildPatch(row, totalMinutes) {
  const payload = { id: row.id, total_horas: totalMinutes };
  if (row.cat_otros_conceptos_id != null) {
    payload.cat_otros_conceptos_id = row.cat_otros_conceptos_id;
  }
  if (row.grupo_id) {
    payload.grupo_id = row.grupo_id;
  }
  if (row.actividad_id == null && row.cat_clientes_id != null) {
    payload.cat_clientes_id = row.cat_clientes_id;
  }
  if (row.actividad_id == null && row.descripcion != null) {
    payload.descripcion = row.descripcion;
  }
  if (row.rework_id != null) {
    payload.rework_id = row.rework_id;
  }
  return payload;
}

const qs = new URLSearchParams({
  date_from: '2026-09-14',
  date_to: '2026-09-20',
  limit: '10',
});
const list = await api('GET', `/api/time-report?${qs}`);
const row = list.data?.data?.[0];
if (!row) {
  console.error('Sin filas para probar', list);
  process.exit(1);
}

const original = row.minutos;
const probe = original === 480 ? 465 : original + 15;

const patch1 = await api('PATCH', '/api/time-report', buildPatch(row, probe));
const list2 = await api('GET', `/api/time-report?${qs}`);
const after = list2.data?.data?.find((r) => r.id === row.id);

const patch2 = await api('PATCH', '/api/time-report', buildPatch(row, original));
const list3 = await api('GET', `/api/time-report?${qs}`);
const restored = list3.data?.data?.find((r) => r.id === row.id);

const ok =
  patch1.status === 200 &&
  after?.minutos === probe &&
  patch2.status === 200 &&
  restored?.minutos === original;

console.log(
  JSON.stringify(
    {
      ok,
      row_id: row.id,
      original,
      probe,
      patch1_status: patch1.status,
      patch1_body: patch1.data,
      after_minutos: after?.minutos,
      patch2_status: patch2.status,
      patch2_body: patch2.data,
      restored_minutos: restored?.minutos,
    },
    null,
    2,
  ),
);

const delBad = await api('DELETE', '/api/time-report?id=00000000-0000-4000-8000-000000000001');
const deleteBadOk = delBad.status >= 400 && delBad.status < 500;

let deleteLive = null;
if (process.env.VERIFY_DELETE_LIVE === '1') {
  const post = await api('POST', '/api/time-report', {
    work_date: row.work_date,
    total_horas: 15,
    actividad_id: 123027,
    subactividad_id: 1,
    codigo: 1,
    cat_otros_conceptos_id: row.cat_otros_conceptos_id ?? 19,
    grupo_id: row.grupo_id,
    rework_id: 0,
  });
  if (post.status === 201 && post.data?.id) {
    const del = await api('DELETE', `/api/time-report?id=${encodeURIComponent(post.data.id)}`);
    const listAfter = await api('GET', `/api/time-report?${qs}`);
    const gone = !listAfter.data?.data?.some((r) => r.id === post.data.id);
    deleteLive = { post_status: post.status, del_status: del.status, gone, del_body: del.data };
  } else {
    deleteLive = { skipped: true, post_status: post.status, post_body: post.data };
  }
}

const allOk = ok && deleteBadOk && (deleteLive == null || deleteLive.gone === true || deleteLive.skipped);
console.log(JSON.stringify({ delete_bad_status: delBad.status, deleteLive, allOk }, null, 2));
process.exit(allOk ? 0 : 1);
