// ===== Estado global (mapas e flags) =====
const clientesMap = {};
const produtosMap = {};
const formasMap = {};

// Cache de últimas vendas
let ultimasVendasCache = [];

// Estados de edição
let editingClienteId = null;
let editingProdutoId = null;
let editingFormaId = null;


// ===== Helpers globais de data (date-only, timezone-safe) =====
function erpDateInputToTimestamp(dateIso, endOfDay = false) {
  const s = String(dateIso || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const y = Number(m[1]);
  const mon = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mon) || !Number.isFinite(d)) return null;

  return endOfDay
    ? Date.UTC(y, mon - 1, d, 23, 59, 59, 999)
    : Date.UTC(y, mon - 1, d, 0, 0, 0, 0);
}

function erpTimestampToIsoDate(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "";
  return new Date(n).toISOString().slice(0, 10);
}

window.erpDateInputToTimestamp = erpDateInputToTimestamp;
window.erpTimestampToIsoDate = erpTimestampToIsoDate;
