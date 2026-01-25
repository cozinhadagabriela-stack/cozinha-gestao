// =====================================================
// Estoque de Insumos / Matérias-primas
// - Controle por item de despesa (itensDespesas)
// - Entrada automática quando lançar uma despesa vinculada
//   a itens de: Matéria-prima / Embalagens / Insumos de produção
// - Permite ver saldo (qtd, custo médio e valor em estoque)
// =====================================================

// ----------------------
// DOM
// ----------------------
const subtabEstProdBtn = document.getElementById("subtab-estoque-produtos");
const subtabEstInsBtn  = document.getElementById("subtab-estoque-insumos");
const wrapEstProd      = document.getElementById("estoque-produtos-wrap");
const wrapEstIns       = document.getElementById("estoque-insumos-wrap");

const insItemSelect    = document.getElementById("ins-item");
const insLoteInput     = document.getElementById("ins-lote");
const insValidadeInput = document.getElementById("ins-validade");
const insCodInput      = document.getElementById("ins-cod-barras");
const insQtdInput      = document.getElementById("ins-quantidade");
const insUnInput       = document.getElementById("ins-unidade");
const insTipoSelect    = document.getElementById("ins-tipo");
const insCustoUnit     = document.getElementById("ins-custo-unit");
const insDataInput     = document.getElementById("ins-data");
const btnSaveIns       = document.getElementById("btn-save-estoque-insumos");
const btnCancelIns     = document.getElementById("btn-cancel-estoque-insumos");
const insMessage       = document.getElementById("ins-message");

const insTbody         = document.getElementById("estoque-insumos-saldos-tbody");
const insCanvas        = document.getElementById("chart-estoque-insumos");

// Filtros e totais (saldos)
const insFiltroItemSelect = document.getElementById("ins-saldo-filter-item");
const insFiltroTextoInput = document.getElementById("ins-saldo-filter-text");
const btnInsLimparFiltros = document.getElementById("btn-ins-saldo-clear-filters");
const insTotalQtdEl       = document.getElementById("estoque-insumos-total-qtd");
const insTotalValorEl     = document.getElementById("estoque-insumos-total-valor");

// ----------------------
// Estado / cache
// ----------------------
const COLECAO_ESTOQUE_INSUMOS = "estoqueInsumos";

const GRUPOS_ESTOQUE_INSUMOS = new Set([
  "Matéria-prima",
  "Embalagens",
  "Insumos de produção",
]);

let insumosItensCache = [];
let insumosItensMap = {};
let estoqueInsumosCache = [];
let chartEstoqueInsumos = null;

let editingInsumoId = null;      // docId do estoqueInsumos
let editingInsumoData = null;    // dados do doc

function txt(t) {
  return String(t || "").trim();
}

function normalizarParaBusca(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function setMsg(el, msg, type) {
  if (!el) return;
  el.textContent = msg || "";
  el.className = "msg" + (type ? ` ${type}` : "");
}

function moeda(n) {
  if (typeof formatarMoedaBR === "function") return formatarMoedaBR(n);
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function numero(n, casas = 2) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function formatarDataBR(yyyyMmDd) {
  const s = txt(yyyyMmDd);
  if (!s) return "";
  // espera YYYY-MM-DD
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// Converte timestamp (ms) para data BR usando UTC (evita "voltar um dia" por fuso)
function formatarDataBRFromTimestampUTC(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  const dt = new Date(n);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
}

function formatarUltimaEntrada(r) {
  const data = txt(r?.ultimaEntradaData);
  if (data) return formatarDataBR(data);
  const ts = r?.ultimaEntradaDataTimestamp;
  if (Number.isFinite(Number(ts))) return formatarDataBRFromTimestampUTC(ts);
  // Firestore Timestamp (ultimaEntradaEm)
  try {
    const t = r?.ultimaEntradaEm;
    if (t && typeof t.toDate === "function") {
      const dt = t.toDate();
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${d}/${m}/${y}`;
    }
  } catch (_) {}
  return "";
}

function docIdInsumo(itemId, lote) {
  return `${itemId}__${txt(lote) || "SEMLOTE"}`;
}

function deveEntrarNoEstoque(item) {
  const grupo = txt(item?.categoriaGrupo || item?.grupo || "");
  const categoria = txt(item?.categoria || "");
  return GRUPOS_ESTOQUE_INSUMOS.has(grupo) || GRUPOS_ESTOQUE_INSUMOS.has(categoria);
}

// ----------------------
// Subtabs (Produtos x Insumos)
// ----------------------
function mostrarSubtabEstoque(alvo) {
  if (!wrapEstProd || !wrapEstIns) return;

  const isProd = alvo === "produtos";
  wrapEstProd.classList.toggle("hidden", !isProd);
  wrapEstIns.classList.toggle("hidden", isProd);

  if (subtabEstProdBtn) subtabEstProdBtn.classList.toggle("active-tab", isProd);
  if (subtabEstInsBtn)  subtabEstInsBtn.classList.toggle("active-tab", !isProd);
}

(function initSubtabs() {
  if (subtabEstProdBtn) subtabEstProdBtn.addEventListener("click", () => mostrarSubtabEstoque("produtos"));
  if (subtabEstInsBtn)  subtabEstInsBtn.addEventListener("click", () => {
    mostrarSubtabEstoque("insumos");
    // garante carga ao abrir
    if (typeof preencherItensEstoqueInsumos === "function") preencherItensEstoqueInsumos();
    if (typeof carregarEstoqueInsumosSaldos === "function") carregarEstoqueInsumosSaldos();
  });

  // default
  mostrarSubtabEstoque("produtos");
})();

// ----------------------
// Carregar itens (itensDespesas) para o select
// ----------------------
async function carregarItensParaEstoqueInsumos() {
  if (!db) return;

  try {
    const snap = await db.collection("itensDespesas").orderBy("descricao").get();

    insumosItensCache = [];
    insumosItensMap = {};

    snap.forEach((doc) => {
      const d = doc.data() || {};
      const item = {
        id: doc.id,
        descricao: txt(d.descricao),
        unidade: txt(d.unidade),
        categoria: txt(d.categoria),
        categoriaGrupo: txt(d.categoriaGrupo),
        codigoBarras: txt(d.codigoBarras),
      };
      if (!item.descricao) return;
      if (!deveEntrarNoEstoque(item)) return;

      insumosItensCache.push(item);
      insumosItensMap[item.id] = item;
    });

    // ordena por descrição
    insumosItensCache.sort((a, b) => a.descricao.localeCompare(b.descricao));
  } catch (e) {
    console.error("Erro ao carregar itens para estoque de insumos:", e);
    insumosItensCache = [];
    insumosItensMap = {};
  }
}

function renderSelectInsumos() {
  if (!insItemSelect) return;

  insItemSelect.innerHTML = '<option value="">Selecione um insumo</option>';
  insumosItensCache.forEach((it) => {
    const op = document.createElement("option");
    op.value = it.id;
    op.textContent = it.descricao;
    insItemSelect.appendChild(op);
  });
}

function aplicarAutoCamposItem(itemId) {
  const it = insumosItensMap[itemId] || null;
  if (!it) {
    if (insUnInput) insUnInput.value = "";
    return;
  }

  if (insUnInput) insUnInput.value = it.unidade || "";
  if (insCodInput && !txt(insCodInput.value)) {
    insCodInput.value = it.codigoBarras || "";
  }
}

async function preencherItensEstoqueInsumos() {
  if (!db || !insItemSelect) return;

  // Se já carregou uma vez, não precisa recarregar toda hora
  if (!insumosItensCache.length) {
    await carregarItensParaEstoqueInsumos();
  }

  renderSelectInsumos();

  // listeners
  if (insItemSelect && !insItemSelect._insListenerAttached) {
    insItemSelect.addEventListener("change", (e) => {
      aplicarAutoCamposItem(e.target.value);
    });
    insItemSelect._insListenerAttached = true;
  }

  // data padrão
  if (insDataInput && !insDataInput.value) {
    insDataInput.value = new Date().toISOString().substring(0, 10);
  }
}

window.preencherItensEstoqueInsumos = preencherItensEstoqueInsumos;

// ----------------------
// Firestore helpers
// ----------------------
async function obterSaldoEstoqueInsumo(itemId, lote) {
  if (!db) return 0;
  const id = docIdInsumo(itemId, lote);
  const snap = await db.collection(COLECAO_ESTOQUE_INSUMOS).doc(id).get();
  if (!snap.exists) return 0;
  const d = snap.data() || {};
  return Number(d.quantidade || 0);
}

async function ajustarSaldoEstoqueInsumo(params) {
  if (!db) return;

  const {
    itemId,
    itemDescricao,
    unidade,
    categoria,
    grupo,
    lote,
    dataValidade,
    codigoBarras,
    delta,
    custoUnitEntrada,
    dataMovimento,
  } = params;

  const id = docIdInsumo(itemId, lote);
  const ref = db.collection(COLECAO_ESTOQUE_INSUMOS).doc(id);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const atual = snap.exists ? (snap.data() || {}) : {};

    const qtdAtual = Number(atual.quantidade || 0);
    const custoAtual = Number(atual.custoMedio || 0);

    const qtdNova = qtdAtual + Number(delta || 0);

    if (qtdNova <= 0) {
      if (snap.exists) tx.delete(ref);
      return;
    }

    // custo médio: só recalcula em entradas positivas quando tem custo informado
    let custoNovo = custoAtual;
    const deltaNum = Number(delta || 0);
    const custoEntrada = Number(custoUnitEntrada || 0);

    // Para exibir no saldo: data da última entrada (YYYY-MM-DD) + timestamp (ms)
    const mov = txt(dataMovimento);
    let movTs = null;
    if (mov) {
      // interpreta a data como UTC (date-only)
      const p = mov.split("-");
      if (p.length === 3) {
        const y = Number(p[0]);
        const m = Number(p[1]);
        const d = Number(p[2]);
        if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
          movTs = Date.UTC(y, m - 1, d);
        }
      }
    }

    if (deltaNum > 0) {
      if (Number.isFinite(custoEntrada) && custoEntrada > 0) {
        custoNovo = ((qtdAtual * custoAtual) + (deltaNum * custoEntrada)) / qtdNova;
      } else if (!custoAtual || custoAtual <= 0) {
        // sem custo existente, e sem custo informado -> mantém 0
        custoNovo = custoAtual;
      }
    }

    tx.set(ref, {
      itemId,
      itemDescricao,
      unidade,
      categoria,
      grupo,
      lote: txt(lote),
      dataValidade: txt(dataValidade),
      codigoBarras: txt(codigoBarras),
      quantidade: qtdNova,
      custoMedio: Number.isFinite(custoNovo) ? custoNovo : custoAtual,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      ...(deltaNum > 0 ? {
        ultimaEntradaEm: firebase.firestore.FieldValue.serverTimestamp(),
        ...(mov ? { ultimaEntradaData: mov } : {}),
        ...(mov ? { ultimaEntradaDataTimestamp: movTs } : {}),
        ...(Number.isFinite(custoEntrada) && custoEntrada > 0 ? { ultimoCustoUnit: custoEntrada } : {}),
      } : {}),
    }, { merge: true });
  });
}

// ----------------------
// Render / gráfico
// ----------------------
function atualizarGraficoEstoqueInsumos(lista) {
  const dados = Array.isArray(lista) ? lista : estoqueInsumosCache;
  if (!insCanvas || typeof Chart === "undefined") return;

  const ctx = insCanvas.getContext("2d");
  if (!ctx) return;

  // agrega por insumo
  const porItem = {};
  dados.forEach((r) => {
    const k = r.itemDescricao || "(Sem nome)";
    porItem[k] = (porItem[k] || 0) + Number(r.quantidade || 0);
  });

  const labels = Object.keys(porItem);
  const valores = labels.map((k) => porItem[k]);

  if (chartEstoqueInsumos) {
    chartEstoqueInsumos.destroy();
    chartEstoqueInsumos = null;
  }

  if (!labels.length) {
    ctx.clearRect(0, 0, insCanvas.width, insCanvas.height);
    return;
  }

  chartEstoqueInsumos = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: valores }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
}


function obterSaldosFiltradosInsumos() {
  let lista = Array.isArray(estoqueInsumosCache) ? [...estoqueInsumosCache] : [];

  const itemId = txt(insFiltroItemSelect?.value);
  const q = normalizarParaBusca(insFiltroTextoInput?.value);

  if (itemId) {
    lista = lista.filter((r) => txt(r.itemId) === itemId);
  }

  if (q) {
    lista = lista.filter((r) => {
      const alvo = normalizarParaBusca(`${r.itemDescricao || ""} ${r.lote || ""} ${r.codigoBarras || ""}`);
      return alvo.includes(q);
    });
  }

  return lista;
}

function atualizarTotaisSaldosInsumos(lista) {
  const dados = Array.isArray(lista) ? lista : [];

  const totalQtd = dados.reduce((acc, r) => acc + Number(r.quantidade || 0), 0);
  const totalValor = dados.reduce((acc, r) => acc + (Number(r.quantidade || 0) * Number(r.custoMedio || 0)), 0);

  if (insTotalQtdEl) insTotalQtdEl.innerHTML = `<strong>${numero(totalQtd, 2)}</strong>`;
  if (insTotalValorEl) insTotalValorEl.innerHTML = `<strong>${moeda(totalValor)}</strong>`;
}

function atualizarSelectFiltroSaldosInsumos() {
  if (!insFiltroItemSelect) return;

  const atual = txt(insFiltroItemSelect.value);

  // Mapa itemId -> descricao
  const map = new Map();
  (Array.isArray(estoqueInsumosCache) ? estoqueInsumosCache : []).forEach((r) => {
    const id = txt(r.itemId);
    const desc = txt(r.itemDescricao);
    if (!id || !desc) return;
    if (!map.has(id)) map.set(id, desc);
  });

  const itens = Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  insFiltroItemSelect.innerHTML = '<option value="">Todos os insumos</option>';
  itens.forEach(([id, desc]) => {
    const op = document.createElement('option');
    op.value = id;
    op.textContent = desc;
    insFiltroItemSelect.appendChild(op);
  });

  // Restaura seleção se ainda existir
  if (atual && map.has(atual)) {
    insFiltroItemSelect.value = atual;
  } else {
    insFiltroItemSelect.value = '';
  }
}

function initFiltrosSaldosInsumos() {
  if (insFiltroItemSelect && !insFiltroItemSelect._listenerAttached) {
    insFiltroItemSelect.addEventListener('change', () => {
      renderTabelaSaldosInsumos();
    });
    insFiltroItemSelect._listenerAttached = true;
  }

  if (insFiltroTextoInput && !insFiltroTextoInput._listenerAttached) {
    insFiltroTextoInput.addEventListener('input', () => {
      renderTabelaSaldosInsumos();
    });
    insFiltroTextoInput._listenerAttached = true;
  }

  if (btnInsLimparFiltros && !btnInsLimparFiltros._listenerAttached) {
    btnInsLimparFiltros.addEventListener('click', () => {
      if (insFiltroItemSelect) insFiltroItemSelect.value = '';
      if (insFiltroTextoInput) insFiltroTextoInput.value = '';
      renderTabelaSaldosInsumos();
    });
    btnInsLimparFiltros._listenerAttached = true;
  }
}

function renderTabelaSaldosInsumos() {
  if (!insTbody) return;

  const lista = obterSaldosFiltradosInsumos();

  // Totais sempre baseados no que está sendo exibido (itens filtrados)
  atualizarTotaisSaldosInsumos(lista);

  // Se não tem nenhum registro no banco
  if (!estoqueInsumosCache.length) {
    insTbody.innerHTML = '<tr><td colspan="9">Nenhum saldo cadastrado.</td></tr>';
    atualizarGraficoEstoqueInsumos([]);
    return;
  }

  // Se há registros, mas filtros deixaram vazio
  if (!lista.length) {
    insTbody.innerHTML = '<tr><td colspan="9">Nenhum item encontrado com os filtros.</td></tr>';
    atualizarGraficoEstoqueInsumos([]);
    return;
  }

  insTbody.innerHTML = '';

  lista.forEach((r) => {
    const tr = document.createElement('tr');

    const valorEstoque = Number(r.quantidade || 0) * Number(r.custoMedio || 0);

    const tdNome = document.createElement('td');
    tdNome.textContent = r.itemDescricao || '';

    const tdUn = document.createElement('td');
    tdUn.textContent = r.unidade || '';

    const tdLote = document.createElement('td');
    tdLote.textContent = r.lote || '';

    const tdVal = document.createElement('td');
    tdVal.textContent = formatarDataBR(r.dataValidade || '');

    const tdUlt = document.createElement('td');
    tdUlt.textContent = formatarUltimaEntrada(r) || '';

    const tdQtd = document.createElement('td');
    tdQtd.textContent = numero(r.quantidade || 0, 2);

    const tdCusto = document.createElement('td');
    tdCusto.textContent = r.custoMedio ? numero(r.custoMedio, 2) : '';

    const tdValor = document.createElement('td');
    tdValor.textContent = r.custoMedio ? moeda(valorEstoque) : '';

    const tdAcoes = document.createElement('td');

    const btnEditar = document.createElement('button');
    btnEditar.textContent = 'Editar';
    btnEditar.className = 'btn-secundario';
    btnEditar.addEventListener('click', () => entrarEdicaoInsumo(r._id, r));

    const btnExcluir = document.createElement('button');
    btnExcluir.textContent = 'Excluir';
    btnExcluir.className = 'btn-secundario';
    btnExcluir.addEventListener('click', () => excluirSaldoInsumo(r._id));

    tdAcoes.appendChild(btnEditar);
    tdAcoes.appendChild(document.createTextNode(' '));
    tdAcoes.appendChild(btnExcluir);

    tr.appendChild(tdNome);
    tr.appendChild(tdUn);
    tr.appendChild(tdLote);
    tr.appendChild(tdVal);
    tr.appendChild(tdUlt);
    tr.appendChild(tdQtd);
    tr.appendChild(tdCusto);
    tr.appendChild(tdValor);
    tr.appendChild(tdAcoes);

    insTbody.appendChild(tr);
  });

  atualizarGraficoEstoqueInsumos(lista);
}

async function carregarEstoqueInsumosSaldos() {
  if (!db || !insTbody) return;

  try {
    const snap = await db.collection(COLECAO_ESTOQUE_INSUMOS).get();

    estoqueInsumosCache = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      estoqueInsumosCache.push({
        _id: doc.id,
        itemId: d.itemId,
        itemDescricao: d.itemDescricao,
        unidade: d.unidade,
        categoria: d.categoria,
        grupo: d.grupo,
        lote: d.lote,
        dataValidade: d.dataValidade,
        codigoBarras: d.codigoBarras,
        quantidade: Number(d.quantidade || 0),
        custoMedio: Number(d.custoMedio || 0),
        ultimaEntradaData: d.ultimaEntradaData || "",
        ultimaEntradaDataTimestamp: d.ultimaEntradaDataTimestamp ?? null,
        ultimaEntradaEm: d.ultimaEntradaEm || null,
      });
    });

    // ordena por nome
    estoqueInsumosCache.sort((a, b) => (a.itemDescricao || "").localeCompare(b.itemDescricao || ""));

    // atualiza opções e listeners dos filtros
    initFiltrosSaldosInsumos();
    atualizarSelectFiltroSaldosInsumos();

    renderTabelaSaldosInsumos();
  } catch (e) {
    console.error("Erro ao carregar saldos de insumos:", e);
    if (insTbody) {
      insTbody.innerHTML = '<tr><td colspan="9">Erro ao carregar saldos.</td></tr>';
    }
    estoqueInsumosCache = [];
    atualizarGraficoEstoqueInsumos();
  }
}

window.carregarEstoqueInsumosSaldos = carregarEstoqueInsumosSaldos;

// ----------------------
// Edição / exclusão
// ----------------------
function entrarEdicaoInsumo(docId, dados) {
  editingInsumoId = docId;
  editingInsumoData = dados || null;

  if (!editingInsumoData) return;

  if (btnCancelIns) btnCancelIns.classList.remove("hidden");
  if (btnSaveIns) btnSaveIns.textContent = "Atualizar saldo";

  // trava item e lote pra não trocar o docId
  if (insItemSelect) {
    insItemSelect.value = editingInsumoData.itemId || "";
    insItemSelect.disabled = true;
    aplicarAutoCamposItem(editingInsumoData.itemId || "");
  }
  if (insLoteInput) {
    insLoteInput.value = editingInsumoData.lote || "";
    insLoteInput.disabled = true;
  }

  if (insValidadeInput) insValidadeInput.value = editingInsumoData.dataValidade || "";
  if (insCodInput) insCodInput.value = editingInsumoData.codigoBarras || "";
  if (insQtdInput) insQtdInput.value = String(editingInsumoData.quantidade ?? 0);

  // Em edição, o campo custo é opcional (só se estiver aumentando o saldo)
  if (insCustoUnit) insCustoUnit.value = "";

  if (insTipoSelect) {
    insTipoSelect.value = "ENTRADA";
    insTipoSelect.disabled = true;
  }

  setMsg(insMessage, "Modo edição: informe a NOVA quantidade total e clique em Atualizar.", "");
}

function cancelarEdicaoInsumo() {
  editingInsumoId = null;
  editingInsumoData = null;

  if (btnCancelIns) btnCancelIns.classList.add("hidden");
  if (btnSaveIns) btnSaveIns.textContent = "Salvar movimento";

  if (insItemSelect) {
    insItemSelect.disabled = false;
    insItemSelect.value = "";
  }
  if (insLoteInput) {
    insLoteInput.disabled = false;
    insLoteInput.value = "";
  }
  if (insValidadeInput) insValidadeInput.value = "";
  if (insCodInput) insCodInput.value = "";
  if (insQtdInput) insQtdInput.value = "1";
  if (insUnInput) insUnInput.value = "";
  if (insTipoSelect) {
    insTipoSelect.disabled = false;
    insTipoSelect.value = "ENTRADA";
  }
  if (insCustoUnit) insCustoUnit.value = "";

  setMsg(insMessage, "", "");
}

async function excluirSaldoInsumo(docId) {
  const ok = window.confirm("Tem certeza que deseja excluir este saldo de insumo?");
  if (!ok) return;

  try {
    await db.collection(COLECAO_ESTOQUE_INSUMOS).doc(docId).delete();
    await carregarEstoqueInsumosSaldos();
  } catch (e) {
    console.error("Erro ao excluir saldo de insumo:", e);
    setMsg(insMessage, "Erro ao excluir saldo.", "error");
  }
}

if (btnCancelIns) {
  btnCancelIns.addEventListener("click", cancelarEdicaoInsumo);
}

// ----------------------
// Salvar movimento (manual)
// ----------------------
async function salvarMovimentoInsumo() {
  if (!db || !insItemSelect) return;

  const user = auth?.currentUser;
  if (!user) {
    setMsg(insMessage, "Você precisa estar logado para salvar.", "error");
    return;
  }

  const itemId = insItemSelect.value;
  const lote = txt(insLoteInput?.value);
  const dataValidade = insValidadeInput?.value || "";
  const codigoBarras = txt(insCodInput?.value);
  const tipo = insTipoSelect?.value || "ENTRADA";
  const dataStr = insDataInput?.value || new Date().toISOString().substring(0, 10);

  const qtdInformada = Number(insQtdInput?.value || 0);
  const custoEntrada = Number(insCustoUnit?.value || 0);

  if (!itemId) {
    setMsg(insMessage, "Selecione um insumo.", "error");
    return;
  }

  const item = insumosItensMap[itemId] || null;
  if (!item) {
    setMsg(insMessage, "Insumo inválido.", "error");
    return;
  }

  // EDIÇÃO: o usuário informa a NOVA quantidade total
  if (editingInsumoId && editingInsumoData) {
    const saldoAtual = await obterSaldoEstoqueInsumo(itemId, editingInsumoData.lote || "");
    const novaQtd = Number.isFinite(qtdInformada) ? qtdInformada : 0;
    const delta = novaQtd - saldoAtual;

    if (!Number.isFinite(novaQtd) || novaQtd < 0) {
      setMsg(insMessage, "Informe uma quantidade válida (>= 0).", "error");
      return;
    }

    // Se estiver aumentando, exige custo unitário (para manter custo médio coerente)
    if (delta > 0 && (!Number.isFinite(custoEntrada) || custoEntrada <= 0)) {
      setMsg(insMessage, "Para aumentar o saldo, informe o custo unitário (R$).", "error");
      return;
    }

    await ajustarSaldoEstoqueInsumo({
      itemId,
      itemDescricao: item.descricao,
      unidade: item.unidade,
      categoria: item.categoria,
      grupo: item.categoriaGrupo || item.categoria,
      lote: editingInsumoData.lote || "",
      dataValidade,
      codigoBarras,
      delta,
      custoUnitEntrada: delta > 0 ? custoEntrada : null,
      dataMovimento: txt(insDataInput?.value) || dataStr,
    });

    setMsg(insMessage, "Saldo atualizado com sucesso!", "ok");
    cancelarEdicaoInsumo();
    await carregarEstoqueInsumosSaldos();
    return;
  }

  // NOVO MOVIMENTO
  if (!Number.isFinite(qtdInformada) || qtdInformada <= 0) {
    setMsg(insMessage, "Informe quantidade maior que zero.", "error");
    return;
  }

  // data padrão
  if (insDataInput && !insDataInput.value) {
    insDataInput.value = dataStr;
  }

  let delta = qtdInformada;
  if (tipo === "SAIDA") delta = -qtdInformada;

  // valida saída
  if (delta < 0) {
    const saldoAtual = await obterSaldoEstoqueInsumo(itemId, lote);
    if (saldoAtual + delta < 0) {
      setMsg(insMessage, `Movimento deixaria o estoque negativo (saldo atual: ${saldoAtual}).`, "error");
      return;
    }
  }

  // entrada exige custo unit
  if (delta > 0 && (!Number.isFinite(custoEntrada) || custoEntrada <= 0)) {
    setMsg(insMessage, "Na entrada, informe o custo unitário (R$).", "error");
    return;
  }

  await ajustarSaldoEstoqueInsumo({
    itemId,
    itemDescricao: item.descricao,
    unidade: item.unidade,
    categoria: item.categoria,
    grupo: item.categoriaGrupo || item.categoria,
    lote,
    dataValidade,
    codigoBarras,
    delta,
    custoUnitEntrada: delta > 0 ? custoEntrada : null,
    dataMovimento: txt(insDataInput?.value) || dataStr,
  });

  setMsg(insMessage, "Movimento de insumo salvo com sucesso!", "ok");

  // limpa
  if (insItemSelect) insItemSelect.value = "";
  if (insLoteInput) insLoteInput.value = "";
  if (insValidadeInput) insValidadeInput.value = "";
  if (insCodInput) insCodInput.value = "";
  if (insQtdInput) insQtdInput.value = "1";
  if (insUnInput) insUnInput.value = "";
  if (insTipoSelect) insTipoSelect.value = "ENTRADA";
  if (insCustoUnit) insCustoUnit.value = "";

  await carregarEstoqueInsumosSaldos();
}

if (btnSaveIns) {
  btnSaveIns.addEventListener("click", salvarMovimentoInsumo);
}
