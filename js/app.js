// Lecteur PDF : PDF.js chargé depuis un CDN (aucune installation nécessaire)
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

// ===== Liste des ouvrages (modifiez ici) =====
const books = [
  { id: "manuel", title: "Manuel du jeune Citoyen", subtitle: "Engagement, leadership et développement",
    pages: 280, size: "44,1 Mo", cover: "images/manuel-cover.png", pdf: "pdf/manuel-du-jeune-citoyen.pdf" },
  { id: "colorie", title: "Découvre et colorie le Congo", subtitle: "Valeurs républicaines et patriotisme",
    pages: 246, size: "34,4 Mo", cover: "images/colorie-cover-v2.png", pdf: "pdf/decouvre-et-colorie-le-congo.pdf" },
];

// ===== Compteurs (enregistrés dans le navigateur du visiteur) =====
const KEY = "dgj-stats";
const load = () => JSON.parse(localStorage.getItem(KEY) || "{}");
const stats = Object.assign(Object.fromEntries(books.map((b) => [b.id, { views: 0, downloads: 0 }])), load());
const fr = (n) => n.toLocaleString("fr-FR");

function bump(id, key) {
  stats[id][key]++;
  localStorage.setItem(KEY, JSON.stringify(stats));
  render();
}

function render() {
  document.getElementById("books").innerHTML = books.map((b) => `
    <article class="book">
      <img src="${b.cover}" alt="${b.title}" />
      <div class="book-info">
        <h3>${b.title}</h3>
        <p class="muted">${b.subtitle}</p>
        <div class="meta">
          <span>📖 <strong>${b.pages}</strong> pages · <strong>${b.size}</strong></span>
          <span>👁 <strong>${fr(stats[b.id].views)}</strong> consultations</span>
          <span>⬇ <strong>${fr(stats[b.id].downloads)}</strong> téléchargements</span>
        </div>
        <div class="actions">
          <button class="btn btn-green" data-view="${b.id}">Consulter →</button>
          <button class="btn btn-outline" data-dl="${b.id}">⬇ Télécharger</button>
        </div>
      </div>
    </article>`).join("");
  const t = Object.values(stats).reduce((a, s) => ({ v: a.v + s.views, d: a.d + s.downloads }), { v: 0, d: 0 });
  document.getElementById("total-views").textContent = fr(t.v);
  document.getElementById("total-downloads").textContent = fr(t.d);
}

function download(book) {
  bump(book.id, "downloads");
  const a = document.createElement("a");
  a.href = book.pdf;
  a.download = `${book.title}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

document.getElementById("books").addEventListener("click", (e) => {
  const v = e.target.closest("[data-view]");
  const d = e.target.closest("[data-dl]");
  if (v) { const b = books.find((x) => x.id === v.dataset.view); bump(b.id, "views"); openReader(b); }
  if (d) download(books.find((x) => x.id === d.dataset.dl));
});

// ===== Lecteur =====
const $ = (id) => document.getElementById(id);
const reader = $("reader"), canvas = $("canvas"), ctx = canvas.getContext("2d");
let doc = null, current = null, page = 1, scale = 1, task = null;

async function openReader(book) {
  current = book; page = 1; scale = 1; doc = null;
  $("reader-title").textContent = book.title;
  $("page-count").textContent = "/ …";
  $("reader-loading").hidden = false;
  canvas.hidden = true;
  reader.hidden = false;
  document.body.style.overflow = "hidden";
  try {
    doc = await pdfjsLib.getDocument(book.pdf).promise;
    $("page-count").textContent = `/ ${doc.numPages}`;
    $("page-input").max = doc.numPages;
    await draw();
  } catch {
    $("reader-loading").textContent = "Impossible d'afficher ce document.";
  }
}

async function draw() {
  if (!doc) return;
  const p = await doc.getPage(page);
  const base = p.getViewport({ scale: 1 });
  const fit = Math.min(900, window.innerWidth - 48) / base.width;
  const vp = p.getViewport({ scale: fit * scale });
  const dpr = window.devicePixelRatio || 1;
  canvas.width = vp.width * dpr; canvas.height = vp.height * dpr;
  canvas.style.width = vp.width + "px"; canvas.style.height = vp.height + "px";
  if (task) task.cancel();
  task = p.render({ canvasContext: ctx, viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] });
  try { await task.promise; } catch { return; }
  $("reader-loading").hidden = true;
  canvas.hidden = false;
  $("page-input").value = page;
  $("zoom-label").textContent = Math.round(scale * 100) + "%";
  $("prev").disabled = page <= 1;
  $("next").disabled = page >= doc.numPages;
}

const go = (d) => { if (!doc) return; page = Math.min(Math.max(page + d, 1), doc.numPages); draw(); };
const close = () => { reader.hidden = true; document.body.style.overflow = ""; };
$("prev").onclick = () => go(-1);
$("next").onclick = () => go(1);
$("zoom-in").onclick = () => { scale = Math.min(3, +(scale + 0.2).toFixed(2)); draw(); };
$("zoom-out").onclick = () => { scale = Math.max(0.5, +(scale - 0.2).toFixed(2)); draw(); };
$("page-input").onchange = (e) => { const v = +e.target.value; if (doc && v >= 1 && v <= doc.numPages) { page = v; draw(); } };
$("reader-dl").onclick = () => download(current);
$("close").onclick = close;
window.addEventListener("keydown", (e) => {
  if (reader.hidden) return;
  if (e.key === "ArrowRight") go(1);
  if (e.key === "ArrowLeft") go(-1);
  if (e.key === "Escape") close();
});
window.addEventListener("resize", () => !reader.hidden && draw());

render();
