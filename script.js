/* LAST CALL — Sala de escucha (GitHub Pages)
   - Catálogo: catalogo.json (161 tomas extraídas del espacio).
   - Marcas: decisiones.json del repo es la fuente compartida; al cargar se
     fusiona con lo guardado en este navegador (gana la marca más reciente).
   - Al marcar: se guarda en localStorage y, si hay un token de GitHub
     configurado, se hace commit de decisiones.json vía la API de GitHub.
     El token vive SOLO en localStorage de este navegador. */
"use strict";

const REPO = { owner: "MashLanzer", name: "LastCall-Sala", branch: "main", file: "decisiones.json" };
const LS_DEC = "lastcall.decisiones.v1";
const LS_TOK = "lastcall.ghtoken.v1";

const VISTAS = [
  { id: "publicadas", label: "Publicadas" },
  { id: "produccion", label: "En producción" },
  { id: "me-gusta", label: "Me gusta" },
  { id: "banco", label: "Producidas sin publicar" },
];
const VACIOS = {
  "publicadas": "Todavía no hay tomas publicadas en esta vista.",
  "produccion": "Todavía no marcas ninguna toma «A producción» sin publicar.",
  "me-gusta": "Todavía no marcas ningún «Me gusta» sin publicar.",
  "banco": "No quedan tomas nuevas sin marcar: todo el banco está escuchado o marcado.",
};

const ICONS = {
  suno: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  ear: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/></svg>',
  up: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
  down: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>',
  clapper: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m3 11 18-5"/><path d="M5 11v7a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7"/></svg>',
};

let catalogo = null;      // {grupos:[...]}
let decisiones = {};      // {takeId: {like, dislike, produccion, escuchada, nota, ts}}
let notas = {};           // {grupo: {nota, ts}}
let vista = "banco";
let query = "";
let syncBusy = false;
let syncPending = false;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const vacia = () => ({ like: false, dislike: false, produccion: false, escuchada: false, nota: "", ts: null });
const dec = (id) => decisiones[id] || vacia();
const enPublicada = (g) => !!g.publicada;
const totalTomas = () => catalogo.grupos.reduce((n, g) => n + g.tomas.length, 0);

function enVista(g, t, v) {
  const d = dec(t.id);
  const sinMarcas = !d.like && !d.dislike && !d.produccion && !d.escuchada;
  if (v === "publicadas") return enPublicada(g);
  if (enPublicada(g)) return false;
  if (v === "me-gusta") return d.like === true;
  if (v === "produccion") return d.produccion === true;
  return sinMarcas; // banco
}

function conteos() {
  const c = { publicadas: 0, produccion: 0, "me-gusta": 0, banco: 0, likesTotal: 0, prodTotal: 0, escuchadas: 0 };
  for (const g of catalogo.grupos) for (const t of g.tomas) {
    const d = dec(t.id);
    for (const v of VISTAS) if (enVista(g, t, v.id)) c[v.id]++;
    if (d.like) c.likesTotal++;
    if (d.produccion) c.prodTotal++;
    if (d.escuchada) c.escuchadas++;
  }
  return c;
}

/* ---------- Persistencia local + sincronización ---------- */
function guardarLocal() {
  try { localStorage.setItem(LS_DEC, JSON.stringify({ decisiones, notas })); } catch (e) { /* sin espacio: se sigue en memoria */ }
}
function cargarLocal() {
  try {
    const raw = localStorage.getItem(LS_DEC);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { decisiones: p.decisiones || {}, notas: p.notas || {} };
  } catch (e) { return null; }
}

function fusionar(base, encima) {
  const out = { ...base };
  for (const [k, v] of Object.entries(encima || {})) {
    const b = out[k];
    if (!b) { out[k] = v; continue; }
    const tb = b.ts ? Date.parse(b.ts) : 0;
    const tv = v.ts ? Date.parse(v.ts) : 0;
    out[k] = tv >= tb ? v : b;
  }
  return out;
}

function serializar() {
  const out = { _notas: notas };
  for (const g of catalogo.grupos) for (const t of g.tomas) {
    const d = decisiones[t.id];
    if (d && (d.like || d.dislike || d.produccion || d.escuchada || d.nota)) out[t.id] = d;
  }
  return JSON.stringify(out, null, 1);
}

function token() { try { return localStorage.getItem(LS_TOK) || ""; } catch (e) { return ""; } }

function syncEstado(modo, texto) {
  const dot = $("syncDot"); const tx = $("syncText");
  if (!dot || !tx) return;
  dot.className = "sync-dot" + (modo ? " " + modo : "");
  tx.textContent = texto;
}
function refrescarSyncTexto() {
  if (syncBusy) return;
  if (!token()) syncEstado("", "Guardado en este navegador · sin sincronizar");
  else syncEstado("ok", "Sincronizado con GitHub");
}
function programarSync() {
  guardarLocal();
  if (!token()) { refrescarSyncTexto(); return; }
  if (syncBusy) { syncPending = true; return; }
  syncAhora();
}

function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
async function gh(path, opts) {
  const r = await fetch("https://api.github.com" + path, {
    ...opts,
    headers: {
      "Authorization": "Bearer " + token(),
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts && opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  return r;
}
async function syncAhora() {
  if (!token()) { refrescarSyncTexto(); return; }
  syncBusy = true; syncPending = false;
  syncEstado("busy", "Sincronizando con GitHub…");
  try {
    const getR = await gh(`/repos/${REPO.owner}/${REPO.name}/contents/${REPO.file}?ref=${REPO.branch}`);
    let sha = null;
    if (getR.ok) { const j = await getR.json(); sha = j.sha; }
    else if (getR.status !== 404) throw new Error("GET " + getR.status);
    const putR = await gh(`/repos/${REPO.owner}/${REPO.name}/contents/${REPO.file}`, {
      method: "PUT",
      body: JSON.stringify({
        message: "Marcas de la sala (" + new Date().toISOString() + ")",
        content: b64utf8(serializar()),
        branch: REPO.branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!putR.ok) throw new Error("PUT " + putR.status);
    const hora = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    syncEstado("ok", "Sincronizado con GitHub · " + hora);
  } catch (e) {
    syncEstado("err", "Error al sincronizar: tus marcas están guardadas en este navegador");
  } finally {
    syncBusy = false;
    if (syncPending) { syncPending = false; syncAhora(); }
  }
}

/* ---------- Acciones de marcas ---------- */
function alternar(id, campo) {
  const d = { ...dec(id) };
  if (campo === "like") {
    d.like = !d.like;
    if (d.like) { d.dislike = false; d.escuchada = true; }
  } else if (campo === "dislike") {
    d.dislike = !d.dislike;
    if (d.dislike) { d.like = false; d.escuchada = true; }
  } else if (campo === "produccion") {
    d.produccion = !d.produccion;
  } else if (campo === "escuchada") {
    d.escuchada = !d.escuchada;
  }
  d.ts = new Date().toISOString();
  decisiones[id] = d;
  programarSync();
  render();
}

let notaTimer = null;
function cambiarNota(grupo, texto) {
  notas[grupo] = { nota: texto, ts: new Date().toISOString() };
  guardarLocal();
  clearTimeout(notaTimer);
  notaTimer = setTimeout(() => programarSync(), 900);
}

/* ---------- Render ---------- */
function botonDec(id, campo, clase, icono, texto, activo) {
  return `<button type="button" class="dec-btn ${activo ? clase : ""}" data-take="${esc(id)}" data-campo="${campo}" aria-pressed="${activo}">${icono}${esc(texto)}</button>`;
}

function renderToma(g, t, idxCola) {
  const d = dec(t.id);
  const sub = t.local
    ? `Archivo local${t.duracion ? " · " + esc(t.duracion) : ""}`
    : `Solo en Suno · sin archivo local${t.duracion ? " · " + esc(t.duracion) : ""}`;
  const sunoBtn = t.url
    ? `<a class="btn-suno" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${ICONS.suno}Escuchar en Suno</a>`
    : "";
  const corta = t.urlCorta
    ? `<a class="short-url" href="${esc(t.urlCorta)}" target="_blank" rel="noopener noreferrer">${esc(t.urlCorta)}</a>`
    : "";
  const badge = t.fueraDeBanda ? '<span class="badge">Fuera de banda · regenerar</span>' : "";
  const cola = idxCola != null ? `<span class="badge badge-queue">Cola n.º ${idxCola}</span>` : "";
  return `<article class="take">
    <div class="take-top">
      <div class="take-info">
        <span class="take-label">${esc(t.etiqueta)}</span>
        <span class="take-sub">${sub}</span>
        ${corta}${badge}${cola}
      </div>
      ${sunoBtn}
    </div>
    <div class="decisions">
      ${botonDec(t.id, "escuchada", "on-heard", ICONS.ear, "Ya escuché", d.escuchada)}
      ${botonDec(t.id, "like", "on-like", ICONS.up, "Me gusta", d.like)}
      ${botonDec(t.id, "dislike", "on-dislike", ICONS.down, "No me gusta", d.dislike)}
      ${botonDec(t.id, "produccion", "on-prod", ICONS.clapper, "A producción", d.produccion)}
    </div>
  </article>`;
}

function renderGrupo(g, tomas, colaDesde) {
  const cover = g.portada
    ? `<div class="cover-row"><img class="cover" src="${esc(g.portada)}" alt="Portada de ${esc(g.grupo)}" loading="lazy">${g.spotify ? `<a class="btn-spotify" href="${esc(g.spotify)}" target="_blank" rel="noopener noreferrer">Escuchar en Spotify</a>` : ""}</div>`
    : "";
  const nota = (notas[g.grupo] && notas[g.grupo].nota) || "";
  const notaId = "nota-" + Math.abs([...g.grupo].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  let html = `<section class="group">
    <h2>${esc(g.grupo)}</h2>
    ${g.receta ? `<p class="receta">${esc(g.receta)}</p>` : ""}
    ${g.meta ? `<p class="meta">${esc(g.meta)}</p>` : ""}
    ${cover}
    <div class="note-row">
      <label for="${notaId}">Nota de esta canción (opcional)</label>
      <textarea id="${notaId}" data-nota-grupo="${esc(g.grupo)}" placeholder="Escribe una nota: se guarda como tus marcas…" rows="2">${esc(nota)}</textarea>
    </div>
    <div class="takes">`;
  let n = colaDesde;
  for (const t of tomas) { html += renderToma(g, t, n); if (n != null) n++; }
  html += `</div></section>`;
  return { html, siguienteCola: n };
}

function render() {
  if (!catalogo) return;
  const c = conteos();
  const total = totalTomas();

  $("marksLine").innerHTML =
    `Cuenta Suno Pro · Tus marcas: <strong>${c["me-gusta"]} me gusta</strong> · <strong>${c.prodTotal} a producción</strong>`;
  $("progressRow").hidden = false;
  $("progressFill").style.width = total ? Math.round((c.escuchadas / total) * 100) + "%" : "0%";
  $("progressText").textContent = `Escuchadas: ${c.escuchadas} de ${total}`;

  $("tabs").innerHTML = VISTAS.map((v) =>
    `<button type="button" class="tab ${vista === v.id ? "active" : ""}" data-vista="${v.id}">${esc(v.label)}<br>(${c[v.id]})</button>`
  ).join("");

  const q = norm(query.trim());
  let html = "";
  let cola = vista === "produccion" ? 1 : null;
  let gruposVisibles = 0;
  for (const g of catalogo.grupos) {
    const tomas = g.tomas.filter((t) => enVista(g, t, vista));
    if (tomas.length === 0) continue;
    if (q && !norm(g.grupo).includes(q) && !norm(g.receta || "").includes(q)) continue;
    const r = renderGrupo(g, tomas, cola);
    html += r.html;
    cola = r.siguienteCola;
    gruposVisibles++;
  }
  if (gruposVisibles === 0) {
    html = `<p class="empty">${q ? `Sin resultados para «${esc(query.trim())}» en esta lista.` : esc(VACIOS[vista])}</p>`;
  }
  $("content").innerHTML = html;
}

/* ---------- Carga inicial ---------- */
async function cargar() {
  $("errorBox").hidden = true;
  try {
    const [rc, rd] = await Promise.all([
      fetch("catalogo.json", { cache: "no-store" }),
      fetch("decisiones.json", { cache: "no-store" }).catch(() => null),
    ]);
    if (!rc.ok) throw new Error("catalogo " + rc.status);
    catalogo = await rc.json();
    let remoto = { decisiones: {}, notas: {} };
    if (rd && rd.ok) {
      const j = await rd.json();
      const { _notas, ...resto } = j || {};
      remoto = { decisiones: resto, notas: _notas || {} };
    }
    const local = cargarLocal();
    decisiones = local ? fusionar(remoto.decisiones, local.decisiones) : remoto.decisiones;
    notas = local ? fusionar(remoto.notas, local.notas) : remoto.notas;
    guardarLocal();
    render();
    refrescarSyncTexto();
  } catch (e) {
    $("errorBox").hidden = false;
    $("marksLine").textContent = "No se pudieron cargar tus marcas.";
  }
}

/* ---------- Exportar / importar ---------- */
function exportar() {
  const blob = new Blob([serializar()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "decisiones-lastcall.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importar(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const j = JSON.parse(String(reader.result));
      if (!j || typeof j !== "object") throw new Error("formato");
      const { _notas, ...resto } = j;
      decisiones = resto;
      notas = _notas || {};
      guardarLocal();
      programarSync();
      render();
    } catch (e) {
      alert("Ese archivo no es un respaldo válido de la sala.");
    }
  };
  reader.readAsText(file);
}

/* ---------- Diálogo de sincronización ---------- */
function abrirSync() {
  const dlg = $("syncDialog");
  $("tokenError").hidden = true;
  $("tokenInput").value = "";
  $("btnDisconnect").hidden = !token();
  $("btnSync").textContent = token() ? "Sincronización" : "Conectar sincronización";
  if (typeof dlg.showModal === "function") dlg.showModal();
}
async function guardarSync(ev) {
  ev.preventDefault();
  const t = $("tokenInput").value.trim();
  const err = $("tokenError");
  if (!t) { err.textContent = "Pega primero tu token de GitHub."; err.hidden = false; return; }
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: { "Authorization": "Bearer " + t, "Accept": "application/vnd.github+json" },
    });
    if (!r.ok) throw new Error("token " + r.status);
  } catch (e) {
    err.textContent = "Ese token no funcionó con GitHub. Revísalo e inténtalo de nuevo.";
    err.hidden = false;
    return;
  }
  localStorage.setItem(LS_TOK, t);
  $("syncDialog").close();
  $("btnSync").textContent = "Sincronización";
  syncAhora();
}

/* ---------- Eventos ---------- */
document.addEventListener("click", (ev) => {
  const decBtn = ev.target.closest("[data-take]");
  if (decBtn) { alternar(decBtn.dataset.take, decBtn.dataset.campo); return; }
  const tab = ev.target.closest("[data-vista]");
  if (tab) { vista = tab.dataset.vista; render(); window.scrollTo({ top: 0 }); }
});
document.addEventListener("input", (ev) => {
  if (ev.target.id === "search") { query = ev.target.value; render(); }
  if (ev.target.dataset && ev.target.dataset.notaGrupo) cambiarNota(ev.target.dataset.notaGrupo, ev.target.value);
});
$("btnRetry").addEventListener("click", cargar);
$("btnSync").addEventListener("click", abrirSync);
$("btnCancelSync").addEventListener("click", () => $("syncDialog").close());
$("btnDisconnect").addEventListener("click", () => {
  localStorage.removeItem(LS_TOK);
  $("syncDialog").close();
  $("btnSync").textContent = "Conectar sincronización";
  refrescarSyncTexto();
});
$("syncForm").addEventListener("submit", guardarSync);
$("btnExport").addEventListener("click", exportar);
$("btnImport").addEventListener("click", () => $("fileImport").click());
$("fileImport").addEventListener("change", (ev) => {
  if (ev.target.files && ev.target.files[0]) importar(ev.target.files[0]);
  ev.target.value = "";
});

if (token()) $("btnSync").textContent = "Sincronización";
cargar();
