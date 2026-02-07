// ================================
// Relatório Geral (Vendas + Despesas) + Exportação PDF
// ================================

// Estado do relatório (última geração)
window.__relatorioGeral = {
  filtros: null,
  vendas: [],
  despesas: [],
  resumo: null,
  porProduto: [],
  porCliente: [],
  porForma: [],
  porDespCategoria: []
};

// Elementos
const relFilterStart = document.getElementById("rel-filter-start");
const relFilterEnd = document.getElementById("rel-filter-end");
const relFilterClient = document.getElementById("rel-filter-client");
const relFilterProduct = document.getElementById("rel-filter-product");
const relFilterForma = document.getElementById("rel-filter-forma");
const relFilterNf = document.getElementById("rel-filter-nf");
const relFilterFornecedor = document.getElementById("rel-filter-fornecedor");
const relFilterDescricao = document.getElementById("rel-filter-descricao");
const relFilterMarca = document.getElementById("rel-filter-marca");

const btnRelGerar = document.getElementById("btn-rel-gerar");
const btnRelLimpar = document.getElementById("btn-rel-limpar");
const btnRelExportPdf = document.getElementById("btn-rel-export-pdf");

const relStatus = document.getElementById("rel-status");

const relKpiTotalVendas = document.getElementById("rel-kpi-total-vendas");
const relKpiTotalDespesas = document.getElementById("rel-kpi-total-despesas");
const relKpiResultado = document.getElementById("rel-kpi-resultado");
const relKpiMargem = document.getElementById("rel-kpi-margem");
const relKpiUnidades = document.getElementById("rel-kpi-unidades");
const relKpiPedidos = document.getElementById("rel-kpi-pedidos");
const relKpiTicket = document.getElementById("rel-kpi-ticket");
const relKpiTopCliente = document.getElementById("rel-kpi-top-cliente");
const relKpiTopProduto = document.getElementById("rel-kpi-top-produto");

const relProdutosTbody = document.getElementById("rel-produtos-tbody");
const relClientesTbody = document.getElementById("rel-clientes-tbody");
const relFormasTbody = document.getElementById("rel-formas-tbody");
const relDespCategoriasTbody = document.getElementById("rel-desp-categorias-tbody");

const relVendasTbody = document.getElementById("rel-vendas-tbody");
const relDespesasTbody = document.getElementById("rel-despesas-tbody");
const relVendasInfo = document.getElementById("rel-vendas-info");
const relDespesasInfo = document.getElementById("rel-despesas-info");

// ----------------------
// Utils locais
// ----------------------
function relPad2(n) {
  return String(n).padStart(2, "0");
}

function relToISODateLocal(d) {
  return `${d.getFullYear()}-${relPad2(d.getMonth() + 1)}-${relPad2(d.getDate())}`;
}

function relFormatarMoeda(v) {
  if (typeof formatarMoedaBR === "function") return formatarMoedaBR(v);
  const num = Number(v || 0);
  return "R$ " + num.toFixed(2).replace(".", ",");
}

function relFormatarPercent(v) {
  if (typeof formatarPercent === "function") return formatarPercent(v);
  const num = Number(v || 0);
  return num.toFixed(1).replace(".", ",") + "%";
}

function relFormatarDataBR(iso) {
  if (typeof formatarDataBrasil === "function") return formatarDataBrasil(iso);
  if (!iso) return "";
  const p = String(iso).split("-");
  if (p.length !== 3) return String(iso);
  const [a, m, d] = p;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${a}`;
}

function relMsg(texto, tipo) {
  if (!relStatus) return;
  relStatus.textContent = texto || "";
  relStatus.className = "msg" + (tipo ? ` ${tipo}` : "");
}

function relSetDefaultMesAtual() {
  if (!relFilterStart || !relFilterEnd) return;
  if (relFilterStart.value && relFilterEnd.value) return;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  if (!relFilterStart.value) relFilterStart.value = relToISODateLocal(start);
  if (!relFilterEnd.value) relFilterEnd.value = relToISODateLocal(end);
}

function relLimparTbody(tbody, msg, cols) {
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${cols}">${msg}</td></tr>`;
}

function relSortByText(a, b) {
  return a.text.localeCompare(b.text, "pt-BR", { sensitivity: "base" });
}

function relPreencherSelect(selectEl, items, placeholder, selected) {
  if (!selectEl) return;
  const cur = selected ?? selectEl.value;
  selectEl.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);
  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = it.text;
    selectEl.appendChild(opt);
  }
  // restaura seleção se existir
  if (cur) selectEl.value = cur;
}

function relPopularSelects() {
  // Clientes
  if (relFilterClient && typeof clientesMap === "object") {
    const items = Object.entries(clientesMap)
      .map(([id, v]) => ({ id, text: (v && v.nome) ? v.nome : "(sem nome)" }))
      .sort(relSortByText);
    relPreencherSelect(relFilterClient, items, "Todos os clientes");
  }

  // Produtos
  if (relFilterProduct && typeof produtosMap === "object") {
    const items = Object.entries(produtosMap)
      .map(([id, v]) => ({ id, text: (v && v.descricao) ? v.descricao : "(sem descrição)" }))
      .sort(relSortByText);
    relPreencherSelect(relFilterProduct, items, "Todos os produtos");
  }

  // Formas
  if (relFilterForma && typeof formasMap === "object") {
    const items = Object.entries(formasMap)
      .map(([id, v]) => ({ id, text: (v && v.descricao) ? v.descricao : "(sem descrição)" }))
      .sort(relSortByText);
    relPreencherSelect(relFilterForma, items, "Todas as formas");
  }

  // Fornecedores
  const fornMap = window.fornecedoresMap;
  if (relFilterFornecedor && fornMap && typeof fornMap === "object") {
    const items = Object.entries(fornMap)
      .map(([id, v]) => ({ id, text: (v && v.nome) ? v.nome : "(sem nome)" }))
      .sort(relSortByText);
    relPreencherSelect(relFilterFornecedor, items, "Todos os fornecedores");
  }
}

// ----------------------
// Fetch Firestore
// ----------------------
async function relFetchVendas(startISO, endISO) {
  const out = [];
  const col = db.collection("vendas");

  // range por data (string ISO) + orderBy data
  let base = col
    .orderBy("data", "asc")
    .where("data", ">=", startISO)
    .where("data", "<=", endISO)
    .limit(1000);

  let lastDoc = null;
  while (true) {
    let q = base;
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    snap.forEach((doc) => {
      out.push({ id: doc.id, ...(doc.data() || {}) });
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < 1000) break;
  }

  return out;
}

async function relFetchDespesas(startTs, endTs) {
  const out = [];
  const col = db.collection("despesas");

  // range por timestamp + orderBy timestamp
  let base = col
    .orderBy("dataPagamentoTimestamp", "asc")
    .where("dataPagamentoTimestamp", ">=", startTs)
    .where("dataPagamentoTimestamp", "<=", endTs)
    .limit(1000);

  let lastDoc = null;
  while (true) {
    let q = base;
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    snap.forEach((doc) => {
      out.push({ id: doc.id, ...(doc.data() || {}) });
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < 1000) break;
  }

  return out;
}

// ----------------------
// Filtros
// ----------------------
function relLerFiltros() {
  const start = relFilterStart ? relFilterStart.value : "";
  const end = relFilterEnd ? relFilterEnd.value : "";

  return {
    startISO: start,
    endISO: end,
    clienteId: relFilterClient ? relFilterClient.value : "",
    produtoId: relFilterProduct ? relFilterProduct.value : "",
    formaId: relFilterForma ? relFilterForma.value : "",
    nf: relFilterNf ? relFilterNf.value : "",
    fornecedorId: relFilterFornecedor ? relFilterFornecedor.value : "",
    despDescricao: relFilterDescricao ? relFilterDescricao.value.trim() : "",
    despMarca: relFilterMarca ? relFilterMarca.value.trim() : ""
  };
}

function relAplicarFiltrosVendas(vendas, f) {
  return (vendas || []).filter((v) => {
    if (f.clienteId && v.clienteId !== f.clienteId) return false;
    if (f.produtoId && v.produtoId !== f.produtoId) return false;
    if (f.formaId && v.formaId !== f.formaId) return false;

    if (f.nf === "com") {
      if (!v.numeroNota) return false;
    }
    if (f.nf === "sem") {
      if (v.numeroNota) return false;
    }

    return true;
  });
}

function relAplicarFiltrosDespesas(despesas, f) {
  const desc = (f.despDescricao || "").toLowerCase();
  const marca = (f.despMarca || "").toLowerCase();

  return (despesas || []).filter((d) => {
    if (f.fornecedorId && d.fornecedorId !== f.fornecedorId) return false;
    if (desc) {
      const txt = String(d.descricaoItem || "").toLowerCase();
      if (!txt.includes(desc)) return false;
    }
    if (marca) {
      const txt = String(d.marca || "").toLowerCase();
      if (!txt.includes(marca)) return false;
    }
    return true;
  });
}

// ----------------------
// Cálculos
// ----------------------
function relAgrupar(arr, keyFn, valFn) {
  const m = new Map();
  for (const it of arr) {
    const k = keyFn(it);
    const v = Number(valFn(it) || 0);
    m.set(k, (m.get(k) || 0) + v);
  }
  return m;
}

function relCalcularResumo(vendas, despesas) {
  const totalVendas = vendas.reduce((s, v) => s + Number(v.valorTotal || 0), 0);
  const totalUnid = vendas.reduce((s, v) => s + Number(v.quantidade || 0), 0);

  const pedidosSet = new Set();
  for (const v of vendas) {
    if (v.pedidoChave) pedidosSet.add(v.pedidoChave);
    else pedidosSet.add(v.id);
  }
  const numPedidos = pedidosSet.size;

  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valorTotal || 0), 0);
  const resultado = totalVendas - totalDespesas;
  const margem = totalVendas > 0 ? (resultado / totalVendas) * 100 : 0;
  const ticket = numPedidos > 0 ? totalVendas / numPedidos : 0;

  // top cliente (por valor)
  const porCliente = relAgrupar(vendas, (v) => v.clienteNome || "(sem cliente)", (v) => v.valorTotal);
  let topCliente = null;
  for (const [nome, val] of porCliente.entries()) {
    if (!topCliente || val > topCliente.valor) topCliente = { nome, valor: val };
  }

  // top produto (por quantidade)
  const porProdutoQtd = relAgrupar(vendas, (v) => v.produtoDescricao || "(sem produto)", (v) => v.quantidade);
  let topProduto = null;
  for (const [nome, qtd] of porProdutoQtd.entries()) {
    if (!topProduto || qtd > topProduto.qtd) topProduto = { nome, qtd };
  }

  return {
    totalVendas,
    totalUnid,
    numPedidos,
    totalDespesas,
    resultado,
    margem,
    ticket,
    topCliente,
    topProduto
  };
}

function relRankingProdutos(vendas) {
  const totalVendas = vendas.reduce((s, v) => s + Number(v.valorTotal || 0), 0) || 0;
  const qtdMap = relAgrupar(vendas, (v) => v.produtoDescricao || "(sem produto)", (v) => v.quantidade);
  const valMap = relAgrupar(vendas, (v) => v.produtoDescricao || "(sem produto)", (v) => v.valorTotal);

  const itens = [];
  for (const [prod, qtd] of qtdMap.entries()) {
    const val = valMap.get(prod) || 0;
    const pct = totalVendas > 0 ? (val / totalVendas) * 100 : 0;
    itens.push({ produto: prod, qtd, valor: val, pct });
  }
  itens.sort((a, b) => b.valor - a.valor);
  return itens;
}

function relRankingClientes(vendas) {
  const totalVendas = vendas.reduce((s, v) => s + Number(v.valorTotal || 0), 0) || 0;
  const valMap = relAgrupar(vendas, (v) => v.clienteNome || "(sem cliente)", (v) => v.valorTotal);

  const itens = [];
  for (const [cli, val] of valMap.entries()) {
    const pct = totalVendas > 0 ? (val / totalVendas) * 100 : 0;
    itens.push({ cliente: cli, valor: val, pct });
  }
  itens.sort((a, b) => b.valor - a.valor);
  return itens;
}


function relRankingFormas(vendas) {
  const totalVendas = vendas.reduce((s, v) => s + Number(v.valorTotal || 0), 0) || 0;
  const valMap = relAgrupar(vendas, (v) => v.formaDescricao || "(sem forma)", (v) => v.valorTotal);

  const itens = [];
  for (const [forma, val] of valMap.entries()) {
    const pct = totalVendas > 0 ? (val / totalVendas) * 100 : 0;
    itens.push({ forma, valor: val, pct });
  }
  itens.sort((a, b) => b.valor - a.valor);
  return itens;
}

function relRankingDespesasCategoria(despesas) {
  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valorTotal || 0), 0) || 0;
  const catMap = relAgrupar(
    despesas,
    (d) => d.itemDespesaCategoria || d.itemDespesaGrupo || "(sem categoria)",
    (d) => d.valorTotal
  );

  const itens = [];
  for (const [categoria, val] of catMap.entries()) {
    const pct = totalDespesas > 0 ? (val / totalDespesas) * 100 : 0;
    itens.push({ categoria, valor: val, pct });
  }
  itens.sort((a, b) => b.valor - a.valor);
  return itens;
}

// ----------------------
// Render
// ----------------------
function relRenderResumo(res) {
  if (!res) return;
  if (relKpiTotalVendas) relKpiTotalVendas.textContent = relFormatarMoeda(res.totalVendas);
  if (relKpiTotalDespesas) relKpiTotalDespesas.textContent = relFormatarMoeda(res.totalDespesas);
  if (relKpiResultado) relKpiResultado.textContent = relFormatarMoeda(res.resultado);
  if (relKpiMargem) relKpiMargem.textContent = relFormatarPercent(res.margem);
  if (relKpiUnidades) relKpiUnidades.textContent = String(Math.round(res.totalUnid || 0));
  if (relKpiPedidos) relKpiPedidos.textContent = String(res.numPedidos || 0);
  if (relKpiTicket) relKpiTicket.textContent = relFormatarMoeda(res.ticket);

  if (relKpiTopCliente) {
    relKpiTopCliente.textContent = res.topCliente
      ? `${res.topCliente.nome} (${relFormatarMoeda(res.topCliente.valor)})`
      : "—";
  }
  if (relKpiTopProduto) {
    relKpiTopProduto.textContent = res.topProduto
      ? `${res.topProduto.nome} (${Math.round(res.topProduto.qtd)} un.)`
      : "—";
  }
}

function relRenderTabelaProdutos(ranking) {
  if (!relProdutosTbody) return;
  if (!ranking || ranking.length === 0) {
    relLimparTbody(relProdutosTbody, "Sem dados.", 4);
    return;
  }

  const top = ranking.slice(0, 10);
  relProdutosTbody.innerHTML = top.map((r) => {
    return `
      <tr>
        <td>${r.produto}</td>
        <td>${Math.round(r.qtd)}</td>
        <td>${relFormatarMoeda(r.valor)}</td>
        <td>${relFormatarPercent(r.pct)}</td>
      </tr>
    `;
  }).join("");
}

function relRenderTabelaClientes(ranking) {
  if (!relClientesTbody) return;
  if (!ranking || ranking.length === 0) {
    relLimparTbody(relClientesTbody, "Sem dados.", 3);
    return;
  }

  const top = ranking.slice(0, 10);
  relClientesTbody.innerHTML = top.map((r) => {
    return `
      <tr>
        <td>${r.cliente}</td>
        <td>${relFormatarMoeda(r.valor)}</td>
        <td>${relFormatarPercent(r.pct)}</td>
      </tr>
    `;
  }).join("");

}

function relRenderTabelaFormas(ranking) {
  if (!relFormasTbody) return;
  if (!ranking || ranking.length === 0) {
    relLimparTbody(relFormasTbody, "Sem dados.", 3);
    return;
  }

  const top = ranking.slice(0, 10);
  relFormasTbody.innerHTML = top.map((r) => {
    return `
      <tr>
        <td>${r.forma}</td>
        <td>${relFormatarMoeda(r.valor)}</td>
        <td>${relFormatarPercent(r.pct)}</td>
      </tr>
    `;
  }).join("");
}

function relRenderTabelaDespCategorias(ranking) {
  if (!relDespCategoriasTbody) return;
  if (!ranking || ranking.length === 0) {
    relLimparTbody(relDespCategoriasTbody, "Sem dados.", 3);
    return;
  }

  const top = ranking.slice(0, 10);
  relDespCategoriasTbody.innerHTML = top.map((r) => {
    return `
      <tr>
        <td>${r.categoria}</td>
        <td>${relFormatarMoeda(r.valor)}</td>
        <td>${relFormatarPercent(r.pct)}</td>
      </tr>
    `;
  }).join("");
}

function relRenderVendas(vendas) {
  if (!relVendasTbody) return;
  if (!vendas || vendas.length === 0) {
    relLimparTbody(relVendasTbody, "Nenhuma venda carregada.", 7);
    if (relVendasInfo) relVendasInfo.textContent = "0 itens";
    return;
  }

  // Para não travar a UI, limita renderização na tela (PDF vai levar mais)
  const LIMITE = 300;
  const slice = vendas.slice(0, LIMITE);

  relVendasTbody.innerHTML = slice.map((v) => {
    return `
      <tr>
        <td>${relFormatarDataBR(v.data)}</td>
        <td>${v.clienteNome || ""}</td>
        <td>${v.produtoDescricao || ""}</td>
        <td>${Math.round(Number(v.quantidade || 0))}</td>
        <td>${relFormatarMoeda(v.valorTotal)}</td>
        <td>${v.formaDescricao || ""}</td>
        <td>${v.numeroNota || ""}</td>
      </tr>
    `;
  }).join("");

  if (relVendasInfo) {
    relVendasInfo.textContent = vendas.length <= LIMITE
      ? `${vendas.length} itens`
      : `${slice.length} de ${vendas.length} itens (exibição limitada)`;
  }
}

function relRenderDespesas(despesas) {
  if (!relDespesasTbody) return;
  if (!despesas || despesas.length === 0) {
    relLimparTbody(relDespesasTbody, "Nenhuma despesa carregada.", 7);
    if (relDespesasInfo) relDespesasInfo.textContent = "0 itens";
    return;
  }

  const LIMITE = 300;
  const slice = despesas.slice(0, LIMITE);

  relDespesasTbody.innerHTML = slice.map((d) => {
    const cat = d.itemDespesaCategoria || d.itemDespesaGrupo || "";
    return `
      <tr>
        <td>${relFormatarDataBR(d.dataPagamento)}</td>
        <td>${d.fornecedorNome || ""}</td>
        <td>${d.descricaoItem || ""}</td>
        <td>${cat}</td>
        <td>${d.marca || ""}</td>
        <td>${relFormatarMoeda(d.valorTotal)}</td>
        <td>${d.formaDescricao || ""}</td>
      </tr>
    `;
  }).join("");

  if (relDespesasInfo) {
    relDespesasInfo.textContent = despesas.length <= LIMITE
      ? `${despesas.length} itens`
      : `${slice.length} de ${despesas.length} itens (exibição limitada)`;
  }
}

// ----------------------
// Geração principal
// ----------------------
async function gerarRelatorioGeral() {
  if (!db || typeof db.collection !== "function") {
    relMsg("Banco de dados não inicializado.", "error");
    return;
  }

  relSetDefaultMesAtual();
  relPopularSelects();

  const f = relLerFiltros();
  if (!f.startISO || !f.endISO) {
    relMsg("Informe data inicial e final.", "error");
    return;
  }

  const startTs = new Date(f.startISO + "T00:00:00").getTime();
  const endTs = new Date(f.endISO + "T23:59:59").getTime();

  relMsg("Gerando relatório...", "");

  try {
    // carrega fornecedores se necessário (para popular select e nomes)
    if (typeof carregarFornecedores === "function" && (!window.fornecedoresMap || Object.keys(window.fornecedoresMap).length === 0)) {
      await carregarFornecedores();
    }
    // carrega clientes/produtos/formas se necessário
    if (typeof carregarClientes === "function" && typeof clientesMap === "object" && Object.keys(clientesMap).length === 0) {
      await carregarClientes();
    }
    if (typeof carregarProdutos === "function" && typeof produtosMap === "object" && Object.keys(produtosMap).length === 0) {
      await carregarProdutos();
    }
    if (typeof carregarFormasPagamento === "function" && typeof formasMap === "object" && Object.keys(formasMap).length === 0) {
      await carregarFormasPagamento();
    }

    relPopularSelects();

    // Fetch
    const [vendasAll, despesasAll] = await Promise.all([
      relFetchVendas(f.startISO, f.endISO),
      relFetchDespesas(startTs, endTs)
    ]);

    // Aplica filtros extras
    const vendas = relAplicarFiltrosVendas(vendasAll, f);
    const despesas = relAplicarFiltrosDespesas(despesasAll, f);

    // Ordena por data
    vendas.sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
    despesas.sort((a, b) => Number(a.dataPagamentoTimestamp || 0) - Number(b.dataPagamentoTimestamp || 0));

    const resumo = relCalcularResumo(vendas, despesas);
    const rankProdutos = relRankingProdutos(vendas);
    const rankClientes = relRankingClientes(vendas);
    const rankFormas = relRankingFormas(vendas);
    const rankDespCategorias = relRankingDespesasCategoria(despesas);

    // Salva estado
    window.__relatorioGeral = {
      filtros: f,
      vendas,
      despesas,
      resumo,
      porProduto: rankProdutos,
      porCliente: rankClientes,
      porForma: rankFormas,
      porDespCategoria: rankDespCategorias
    };

    // Render
    relRenderResumo(resumo);
    relRenderTabelaProdutos(rankProdutos);
    relRenderTabelaClientes(rankClientes);
    relRenderTabelaFormas(rankFormas);
    relRenderTabelaDespCategorias(rankDespCategorias);
    relRenderVendas(vendas);
    relRenderDespesas(despesas);

    relMsg("Relatório gerado.", "ok");
  } catch (e) {
    console.error("Erro ao gerar relatório:", e);
    relMsg("Erro ao gerar relatório. Verifique o console.", "error");
  }
}

// Exposto para ui.js
function initRelatorioGeral() {
  try {
    relSetDefaultMesAtual();
    relPopularSelects();
  } catch (_) {}
}

// ----------------------
// Export PDF
// ----------------------
async function relExportarPDF() {
  const st = window.__relatorioGeral;
  if (!st || !st.resumo) {
    relMsg("Gere o relatório antes de exportar.", "error");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    relMsg("Biblioteca de PDF não carregou (jsPDF).", "error");
    return;
  }

  if (typeof db === "undefined" || !db) {
    relMsg("Banco (Firestore) não inicializado.", "error");
    return;
  }

  // Helpers locais
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const isoToUtcStartMs = (iso) => {
    const s = String(iso || "");
    const p = s.split("-");
    if (p.length !== 3) return null;
    const y = Number(p[0]);
    const m = Number(p[1]);
    const d = Number(p[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  };

  const isoToUtcEndMs = (iso) => {
    const s = String(iso || "");
    const p = s.split("-");
    if (p.length !== 3) return null;
    const y = Number(p[0]);
    const m = Number(p[1]);
    const d = Number(p[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  };

  const ym = (iso) => (String(iso || "").length >= 7 ? String(iso).slice(0, 7) : "");
  const ymToLabel = (ymStr) => {
    const p = String(ymStr || "").split("-");
    if (p.length !== 2) return String(ymStr || "");
    return `${p[1]}/${p[0]}`;
  };

  const listMonths = (startISO, endISO) => {
    const s = String(startISO || "").slice(0, 7);
    const e = String(endISO || "").slice(0, 7);
    const sp = s.split("-");
    const ep = e.split("-");
    if (sp.length !== 2 || ep.length !== 2) return [];
    let y = Number(sp[0]);
    let m = Number(sp[1]);
    const yEnd = Number(ep[0]);
    const mEnd = Number(ep[1]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(yEnd) || !Number.isFinite(mEnd)) return [];

    const out = [];
    while (y < yEnd || (y === yEnd && m <= mEnd)) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  };

  const chartToPngDataUrl = async (config, width = 1100, height = 520) => {
    if (typeof Chart === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const cfg = {
      type: config.type,
      data: config.data,
      options: {
        ...(config.options || {}),
        responsive: false,
        animation: false,
        devicePixelRatio: 2,
      },
    };

    const ch = new Chart(ctx, cfg);
    ch.update();
    await sleep(0);
    const dataUrl = canvas.toDataURL("image/png", 1.0);
    ch.destroy();
    return dataUrl;
  };

  const fetchAll = async (collectionName) => {
    const out = [];
    const snap = await db.collection(collectionName).get();
    snap.forEach((doc) => out.push({ id: doc.id, ...(doc.data() || {}) }));
    return out;
  };

  const fetchCaixaPeriodo = async (startISO, endISO) => {
    try {
      const snap = await db
        .collection("caixa")
        .orderBy("dataIso")
        .where("dataIso", ">=", startISO)
        .where("dataIso", "<=", endISO)
        .get();

      const out = [];
      snap.forEach((doc) => out.push({ id: doc.id, ...(doc.data() || {}) }));
      return out;
    } catch (e) {
      console.warn("Caixa: fallback para filtro em memória (provável falta de índice).", e);
      const all = await fetchAll("caixa");
      return all
        .filter((r) => String(r.dataIso || r.id || "") >= startISO && String(r.dataIso || r.id || "") <= endISO)
        .sort((a, b) => String(a.dataIso || a.id).localeCompare(String(b.dataIso || b.id)));
    }
  };

  const fetchResultadoMensalPeriodo = async (startISO, endISO) => {
    const startYM = String(startISO || "").slice(0, 7);
    const endYM = String(endISO || "").slice(0, 7);

    try {
      const snap = await db
        .collection("resultadoMensal")
        .orderBy("mesRef")
        .where("mesRef", ">=", startYM)
        .where("mesRef", "<=", endYM)
        .get();

      const out = [];
      snap.forEach((doc) => out.push({ id: doc.id, ...(doc.data() || {}) }));
      return out;
    } catch (e) {
      console.warn("resultadoMensal: fallback para filtro em memória (provável falta de índice).", e);
      const all = await fetchAll("resultadoMensal");
      return all
        .filter((r) => {
          const ref = String(r.mesRef || r.id || "");
          return ref >= startYM && ref <= endYM;
        })
        .sort((a, b) => String(a.mesRef || a.id).localeCompare(String(b.mesRef || b.id)));
    }
  };

  // ----------------
  // Começa o PDF
  // ----------------
  relMsg("Gerando PDF...", "");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margemX = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margemX * 2;

  const filtros = st.filtros || {};
  const resumo = st.resumo;

  const periodo = `${relFormatarDataBR(filtros.startISO)} a ${relFormatarDataBR(filtros.endISO)}`;
  const geradoEm = new Date();
  const geradoStr = `${relPad2(geradoEm.getDate())}/${relPad2(geradoEm.getMonth() + 1)}/${geradoEm.getFullYear()} ${relPad2(geradoEm.getHours())}:${relPad2(geradoEm.getMinutes())}`;

  const drawHeader = (docRef) => {
    const barH = 26;
    docRef.setFillColor(140, 0, 0);
    docRef.rect(0, 0, pageW, barH, "F");

    docRef.setTextColor(255, 255, 255);
    docRef.setFontSize(12);
    docRef.text("Cozinha da Gabriela", margemX, 18);

    docRef.setTextColor(0, 0, 0);
  };

  const drawFooter = (docRef, pageNum, totalPages) => {
    docRef.setFontSize(9);
    docRef.setTextColor(110, 110, 110);
    docRef.text(`Gerado em ${geradoStr}`, margemX, pageH - 18);
    docRef.text(`Página ${pageNum} de ${totalPages}`, pageW - margemX, pageH - 18, { align: "right" });
    docRef.setTextColor(0, 0, 0);
  };

  const ensureSpace = (y, needed) => {
    if (y + needed <= pageH - 40) return y;
    doc.addPage();
    drawHeader(doc);
    return 44;
  };

  // Config padrão de tabelas
  const tableOptsBase = {
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    theme: "grid",
    headStyles: { fillColor: [240, 240, 240] },
    margin: { left: margemX, right: margemX },
    didDrawPage: () => drawHeader(doc),
  };

  // Primeira página
  drawHeader(doc);
  let y = 44;

  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text("Relatório geral", margemX, y);
  y += 22;

  doc.setFontSize(10);
  doc.text(`Período: ${periodo}`, margemX, y);
  y += 14;
  doc.text(`Gerado em: ${geradoStr}`, margemX, y);
  y += 14;

  // filtros compactos
  const fParts = [];
  if (filtros.clienteId) fParts.push(`Cliente: ${relFilterClient?.selectedOptions?.[0]?.textContent || ""}`);
  if (filtros.produtoId) fParts.push(`Produto: ${relFilterProduct?.selectedOptions?.[0]?.textContent || ""}`);
  if (filtros.formaId) fParts.push(`Forma: ${relFilterForma?.selectedOptions?.[0]?.textContent || ""}`);
  if (filtros.nf) fParts.push(`NF: ${filtros.nf === "com" ? "com" : "sem"}`);
  if (filtros.fornecedorId) fParts.push(`Fornecedor: ${relFilterFornecedor?.selectedOptions?.[0]?.textContent || ""}`);
  if (filtros.despDescricao) fParts.push(`Desc.: ${filtros.despDescricao}`);
  if (filtros.despMarca) fParts.push(`Marca: ${filtros.despMarca}`);

  if (fParts.length) {
    const txt = `Filtros: ${fParts.join(" | ")}`;
    const lines = doc.splitTextToSize(txt, contentW);
    doc.text(lines, margemX, y);
    y += (lines.length * 12) + 6;
  } else {
    y += 6;
  }

  // ----------------
  // RESUMO
  // ----------------
  doc.setFontSize(12);
  doc.text("Resumo do período", margemX, y);
  y += 8;

  doc.autoTable({
    ...tableOptsBase,
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total vendido", relFormatarMoeda(resumo.totalVendas)],
      ["Total de despesas", relFormatarMoeda(resumo.totalDespesas)],
      ["Resultado (caixa)", relFormatarMoeda(resumo.resultado)],
      ["Margem", relFormatarPercent(resumo.margem)],
      ["Unidades vendidas", String(Math.round(resumo.totalUnid || 0))],
      ["Nº de pedidos", String(resumo.numPedidos || 0)],
      ["Ticket médio", relFormatarMoeda(resumo.ticket)],
      ["Top cliente", resumo.topCliente ? `${resumo.topCliente.nome} (${relFormatarMoeda(resumo.topCliente.valor)})` : "—"],
      ["Top produto", resumo.topProduto ? `${resumo.topProduto.nome} (${Math.round(resumo.topProduto.qtd)} un.)` : "—"],
    ],
  });

  y = doc.lastAutoTable.finalY + 18;

  // ----------------
  // GRÁFICOS
  // ----------------
  const vendas = Array.isArray(st.vendas) ? st.vendas : [];
  const despesas = Array.isArray(st.despesas) ? st.despesas : [];

  const meses = listMonths(filtros.startISO, filtros.endISO);

  // Série mensal vendas x despesas
  const vendasMes = {};
  vendas.forEach((v) => {
    const k = ym(v.data);
    if (!k) return;
    vendasMes[k] = (vendasMes[k] || 0) + Number(v.valorTotal || 0);
  });

  const despesasMes = {};
  despesas.forEach((d) => {
    const k = ym(d.dataPagamento || "");
    if (!k) return;
    despesasMes[k] = (despesasMes[k] || 0) + Number(d.valorTotal || 0);
  });

  const labelsMes = meses.length ? meses : Array.from(new Set([...Object.keys(vendasMes), ...Object.keys(despesasMes)])).sort();
  const chart1 = {
    type: "line",
    data: {
      labels: labelsMes.map(ymToLabel),
      datasets: [
        { label: "Vendas (R$)", data: labelsMes.map((k) => Number(vendasMes[k] || 0)) },
        { label: "Despesas (R$)", data: labelsMes.map((k) => Number(despesasMes[k] || 0)) },
      ],
    },
    options: {
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } },
    },
  };

  // Top produtos (valor)
  const prodMap = {};
  vendas.forEach((v) => {
    const k = (v.produtoDescricao || "(sem produto)").trim();
    prodMap[k] = (prodMap[k] || 0) + Number(v.valorTotal || 0);
  });
  const topProd = Object.entries(prodMap)
    .map(([k, val]) => ({ k, val }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 10);

  const chart2 = {
    type: "bar",
    data: {
      labels: topProd.map((r) => r.k),
      datasets: [{ label: "Vendas (R$)", data: topProd.map((r) => r.val) }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  };

  // Despesas por categoria (valor)
  const catMap = {};
  despesas.forEach((d) => {
    const k = String(d.itemDespesaCategoria || d.itemDespesaGrupo || "(sem categoria)").trim();
    catMap[k] = (catMap[k] || 0) + Number(d.valorTotal || 0);
  });
  const topCat = Object.entries(catMap)
    .map(([k, val]) => ({ k, val }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 10);

  const chart3 = {
    type: "bar",
    data: {
      labels: topCat.map((r) => r.k),
      datasets: [{ label: "Despesas (R$)", data: topCat.map((r) => r.val) }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  };

  // Gera imagens
  const imgVxD = await chartToPngDataUrl(chart1);
  const imgTopProd = await chartToPngDataUrl(chart2);
  const imgDespCat = await chartToPngDataUrl(chart3);

  if (imgVxD || imgTopProd || imgDespCat) {
    y = ensureSpace(y, 20);
    doc.setFontSize(12);
    doc.text("Gráficos", margemX, y);
    y += 10;

    const addChart = async (title, img) => {
      if (!img) return;
      y = ensureSpace(y, 18);
      doc.setFontSize(10);
      doc.text(title, margemX, y);
      y += 8;
      y = ensureSpace(y, 260);
      doc.addImage(img, "PNG", margemX, y, contentW, 260);
      y += 270;
    };

    await addChart("Vendas x Despesas (mensal)", imgVxD);
    await addChart("Vendas por produto (Top 10)", imgTopProd);
    await addChart("Despesas por categoria (Top 10)", imgDespCat);

    y += 6;
  }

  // ----------------
  // ESTOQUE
  // ----------------
  y = ensureSpace(y, 20);
  doc.setFontSize(12);
  doc.text("Estoque (posição atual)", margemX, y);
  y += 10;

  let estoqueProdutos = [];
  let estoqueInsumos = [];
  try {
    estoqueProdutos = await fetchAll("estoque");
  } catch (e) {
    console.warn("Erro ao carregar estoque de produtos:", e);
    estoqueProdutos = [];
  }

  try {
    estoqueInsumos = await fetchAll("estoqueInsumos");
  } catch (e) {
    console.warn("Erro ao carregar estoque de insumos:", e);
    estoqueInsumos = [];
  }

  const totalQtdProdutos = estoqueProdutos.reduce((acc, r) => acc + Number(r.quantidade || 0), 0);
  const totalValorInsumos = estoqueInsumos.reduce((acc, r) => acc + (Number(r.quantidade || 0) * Number(r.custoMedio || 0)), 0);

  doc.autoTable({
    ...tableOptsBase,
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Produtos acabados (unid.)", String(Math.round(totalQtdProdutos || 0))],
      ["Linhas de estoque (produtos)", String(estoqueProdutos.length || 0)],
      ["Valor em estoque (insumos)", relFormatarMoeda(totalValorInsumos)],
      ["Linhas de estoque (insumos)", String(estoqueInsumos.length || 0)],
    ],
  });

  y = doc.lastAutoTable.finalY + 14;

  // Gráficos de estoque
  const estProdMap = {};
  estoqueProdutos.forEach((r) => {
    const k = String(r.produtoDescricao || "(sem produto)").trim();
    estProdMap[k] = (estProdMap[k] || 0) + Number(r.quantidade || 0);
  });
  const estProdTop = Object.entries(estProdMap)
    .map(([k, val]) => ({ k, val }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 12);

  const chartEstProd = {
    type: "bar",
    data: {
      labels: estProdTop.map((r) => r.k),
      datasets: [{ label: "Quantidade", data: estProdTop.map((r) => r.val) }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  };

  const estInsMap = {};
  estoqueInsumos.forEach((r) => {
    const k = String(r.itemDescricao || "(sem insumo)").trim();
    const val = Number(r.quantidade || 0) * Number(r.custoMedio || 0);
    estInsMap[k] = (estInsMap[k] || 0) + val;
  });
  const estInsTop = Object.entries(estInsMap)
    .map(([k, val]) => ({ k, val }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 12);

  const chartEstIns = {
    type: "bar",
    data: {
      labels: estInsTop.map((r) => r.k),
      datasets: [{ label: "Valor (R$)", data: estInsTop.map((r) => r.val) }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  };

  const imgEstProd = await chartToPngDataUrl(chartEstProd);
  const imgEstIns = await chartToPngDataUrl(chartEstIns);

  if (imgEstProd) {
    y = ensureSpace(y, 18);
    doc.setFontSize(10);
    doc.text("Estoque por produto (Top 12)", margemX, y);
    y += 8;
    y = ensureSpace(y, 260);
    doc.addImage(imgEstProd, "PNG", margemX, y, contentW, 260);
    y += 270;
  }

  if (imgEstIns) {
    y = ensureSpace(y, 18);
    doc.setFontSize(10);
    doc.text("Valor em estoque por insumo (Top 12)", margemX, y);
    y += 8;
    y = ensureSpace(y, 260);
    doc.addImage(imgEstIns, "PNG", margemX, y, contentW, 260);
    y += 270;
  }

  // Tabelas completas de estoque (pode gerar várias páginas)
  if (estoqueProdutos.length) {
    y = ensureSpace(y, 18);
    doc.setFontSize(11);
    doc.text("Anexo: Estoque de produtos (detalhado)", margemX, y);
    y += 8;

    const estProdRows = [...estoqueProdutos]
      .map((r) => ({
        produto: r.produtoDescricao || "",
        lote: r.lote || "",
        validade: relFormatarDataBR(r.dataValidade || ""),
        qtd: Number(r.quantidade || 0),
        cod: r.codigoBarras || "",
      }))
      .sort((a, b) => (a.produto || "").localeCompare(b.produto || "", "pt-BR"));

    doc.autoTable({
      ...tableOptsBase,
      startY: y,
      head: [["Produto", "Lote", "Validade", "Qtd", "Cód. barras"]],
      body: estProdRows.map((r) => [r.produto, r.lote, r.validade, String(r.qtd), r.cod]),
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      pageBreak: "auto",
    });

    y = doc.lastAutoTable.finalY + 14;
  }

  if (estoqueInsumos.length) {
    y = ensureSpace(y, 18);
    doc.setFontSize(11);
    doc.text("Anexo: Estoque de insumos (detalhado)", margemX, y);
    y += 8;

    const insRows = [...estoqueInsumos]
      .map((r) => {
        const qtd = Number(r.quantidade || 0);
        const custo = Number(r.custoMedio || 0);
        return {
          item: r.itemDescricao || "",
          un: r.unidade || "",
          lote: r.lote || "",
          validade: relFormatarDataBR(r.dataValidade || ""),
          qtd,
          custo,
          valor: qtd * custo,
        };
      })
      .sort((a, b) => (b.valor || 0) - (a.valor || 0));

    doc.autoTable({
      ...tableOptsBase,
      startY: y,
      head: [["Insumo", "Un.", "Lote", "Validade", "Qtd", "Custo méd.", "Valor"]],
      body: insRows.map((r) => [
        r.item,
        r.un,
        r.lote,
        r.validade,
        String(r.qtd.toFixed(2)).replace(".", ","),
        relFormatarMoeda(r.custo),
        relFormatarMoeda(r.valor),
      ]),
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      pageBreak: "auto",
    });

    y = doc.lastAutoTable.finalY + 14;
  }

  // ----------------
  // FINANCEIRO
  // ----------------
  y = ensureSpace(y, 20);
  doc.setFontSize(12);
  doc.text("Financeiro", margemX, y);
  y += 10;

  let caixa = [];
  let resultados = [];
  try {
    caixa = await fetchCaixaPeriodo(filtros.startISO, filtros.endISO);
  } catch (e) {
    console.warn("Erro ao carregar caixa:", e);
    caixa = [];
  }

  try {
    resultados = await fetchResultadoMensalPeriodo(filtros.startISO, filtros.endISO);
  } catch (e) {
    console.warn("Erro ao carregar resultados mensais:", e);
    resultados = [];
  }

  // Resumo do caixa no período
  let saldoInicial = null;
  let saldoFinal = null;
  if (caixa.length) {
    const ordered = [...caixa].sort((a, b) => String(a.dataIso || a.id).localeCompare(String(b.dataIso || b.id)));
    saldoInicial = Number(ordered[0].saldoTotal || ordered[0].saldo || 0);
    saldoFinal = Number(ordered[ordered.length - 1].saldoTotal || ordered[ordered.length - 1].saldo || 0);
  }

  // Resumo dos fechamentos (resultadoMensal)
  const totalLucro = resultados.reduce((acc, r) => acc + Number(r.lucro || 0), 0);

  doc.autoTable({
    ...tableOptsBase,
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Lançamentos de caixa no período", String(caixa.length || 0)],
      ["Saldo inicial (caixa)", saldoInicial === null ? "—" : relFormatarMoeda(saldoInicial)],
      ["Saldo final (caixa)", saldoFinal === null ? "—" : relFormatarMoeda(saldoFinal)],
      ["Meses fechados (resultado)", String(resultados.length || 0)],
      ["Lucro total (meses fechados)", resultados.length ? relFormatarMoeda(totalLucro) : "—"],
    ],
  });

  y = doc.lastAutoTable.finalY + 14;

  // Gráfico lucro mensal (se existir)
  if (resultados.length) {
    const ordered = [...resultados].sort((a, b) => String(a.mesRef || a.id).localeCompare(String(b.mesRef || b.id)));
    const chartLucro = {
      type: "bar",
      data: {
        labels: ordered.map((r) => ymToLabel(r.mesRef || r.id)),
        datasets: [{ label: "Lucro (R$)", data: ordered.map((r) => Number(r.lucro || 0)) }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    };

    const imgLucro = await chartToPngDataUrl(chartLucro);
    if (imgLucro) {
      y = ensureSpace(y, 18);
      doc.setFontSize(10);
      doc.text("Lucro por mês (fechamentos)", margemX, y);
      y += 8;
      y = ensureSpace(y, 260);
      doc.addImage(imgLucro, "PNG", margemX, y, contentW, 260);
      y += 270;
    }
  }

  if (resultados.length) {
    y = ensureSpace(y, 18);
    doc.setFontSize(11);
    doc.text("Fechamentos mensais (resultadoMensal)", margemX, y);
    y += 8;

    const ordered = [...resultados].sort((a, b) => String(a.mesRef || a.id).localeCompare(String(b.mesRef || b.id)));

    doc.autoTable({
      ...tableOptsBase,
      startY: y,
      head: [["Mês", "Vendas", "CMV", "Despesas", "Retiradas", "Lucro", "Margem"]],
      body: ordered.map((r) => {
        const vendasN = Number(r.vendas || 0);
        const lucroN = Number(r.lucro || 0);
        const margem = vendasN > 0 ? (lucroN / vendasN) * 100 : null;
        return [
          ymToLabel(r.mesRef || r.id),
          relFormatarMoeda(r.vendas),
          relFormatarMoeda(r.cmv),
          relFormatarMoeda(r.despesas),
          relFormatarMoeda(r.retiradas),
          relFormatarMoeda(r.lucro),
          margem === null ? "—" : relFormatarPercent(margem),
        ];
      }),
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      pageBreak: "auto",
    });

    y = doc.lastAutoTable.finalY + 14;
  }

  if (caixa.length) {
    y = ensureSpace(y, 18);
    doc.setFontSize(11);
    doc.text("Lançamentos de caixa (no período)", margemX, y);
    y += 8;

    const ordered = [...caixa].sort((a, b) => String(a.dataIso || a.id).localeCompare(String(b.dataIso || b.id)));

    // calcula variação vs anterior dentro do período
    let prev = null;
    const rows = ordered.map((r) => {
      const saldo = Number(r.saldoTotal || r.saldo || 0);
      const variacao = prev === null ? null : (saldo - prev);
      prev = saldo;

      return [
        relFormatarDataBR(r.dataIso || r.id),
        relFormatarMoeda(saldo),
        variacao === null ? "—" : relFormatarMoeda(variacao),
        r.observacao || r.descricao || "",
      ];
    });

    doc.autoTable({
      ...tableOptsBase,
      startY: y,
      head: [["Data", "Saldo", "Variação", "Observação"]],
      body: rows,
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      pageBreak: "auto",
    });

    y = doc.lastAutoTable.finalY + 14;
  }

  // ----------------
  // ANEXOS: EXTRATOS
  // ----------------
  y = ensureSpace(y, 18);
  doc.setFontSize(12);
  doc.text("Anexos", margemX, y);
  y += 10;

  // Extrato de vendas (completo)
  y = ensureSpace(y, 18);
  doc.setFontSize(11);
  doc.text(`Anexo: Extrato de vendas (${vendas.length})`, margemX, y);
  y += 8;

  doc.autoTable({
    ...tableOptsBase,
    startY: y,
    head: [["Data", "Cliente", "Produto", "Qtd", "Total", "Forma", "NF"]],
    body: vendas.map((v) => [
      relFormatarDataBR(v.data),
      v.clienteNome || "",
      v.produtoDescricao || "",
      String(Math.round(Number(v.quantidade || 0))),
      relFormatarMoeda(v.valorTotal),
      v.formaDescricao || "",
      v.numeroNota || "",
    ]),
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    pageBreak: "auto",
  });

  y = doc.lastAutoTable.finalY + 14;

  // Extrato de despesas (completo)
  y = ensureSpace(y, 18);
  doc.setFontSize(11);
  doc.text(`Anexo: Extrato de despesas (${despesas.length})`, margemX, y);
  y += 8;

  doc.autoTable({
    ...tableOptsBase,
    startY: y,
    head: [["Data", "Fornecedor", "Descrição", "Categoria", "Marca", "Total", "Forma"]],
    body: despesas.map((d) => [
      relFormatarDataBR(d.dataPagamento),
      d.fornecedorNome || "",
      d.descricaoItem || "",
      (d.itemDespesaCategoria || d.itemDespesaGrupo || ""),
      d.marca || "",
      relFormatarMoeda(d.valorTotal),
      d.formaDescricao || "",
    ]),
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    pageBreak: "auto",
  });

  // ----------------
  // Numeração de páginas
  // ----------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }

  const nome = `relatorio_completo_${filtros.startISO}_${filtros.endISO}.pdf`;

  try {
    doc.save(nome);
    relMsg("PDF exportado.", "ok");
  } catch (e) {
    console.error("Erro ao salvar PDF:", e);
    relMsg("Erro ao salvar o PDF. Verifique o console.", "error");
  }
}


// ----------------------
// Eventos
// ----------------------
if (btnRelGerar) {
  btnRelGerar.addEventListener("click", () => {
    gerarRelatorioGeral();
  });
}

if (btnRelLimpar) {
  btnRelLimpar.addEventListener("click", () => {
    if (relFilterStart) relFilterStart.value = "";
    if (relFilterEnd) relFilterEnd.value = "";
    if (relFilterClient) relFilterClient.value = "";
    if (relFilterProduct) relFilterProduct.value = "";
    if (relFilterForma) relFilterForma.value = "";
    if (relFilterNf) relFilterNf.value = "";
    if (relFilterFornecedor) relFilterFornecedor.value = "";
    if (relFilterDescricao) relFilterDescricao.value = "";
    if (relFilterMarca) relFilterMarca.value = "";

    relSetDefaultMesAtual();
    relPopularSelects();

    // limpa renders
    relRenderResumo({
      totalVendas: 0,
      totalDespesas: 0,
      resultado: 0,
      margem: 0,
      totalUnid: 0,
      numPedidos: 0,
      ticket: 0,
      topCliente: null,
      topProduto: null
    });
    if (relProdutosTbody) relLimparTbody(relProdutosTbody, "Sem dados.", 4);
    if (relClientesTbody) relLimparTbody(relClientesTbody, "Sem dados.", 3);
    if (relFormasTbody) relLimparTbody(relFormasTbody, "Sem dados.", 3);
    if (relDespCategoriasTbody) relLimparTbody(relDespCategoriasTbody, "Sem dados.", 3);
    if (relVendasTbody) relLimparTbody(relVendasTbody, "Nenhuma venda carregada.", 7);
    if (relDespesasTbody) relLimparTbody(relDespesasTbody, "Nenhuma despesa carregada.", 7);
    if (relVendasInfo) relVendasInfo.textContent = "0 itens";
    if (relDespesasInfo) relDespesasInfo.textContent = "0 itens";

    window.__relatorioGeral = {
      filtros: relLerFiltros(),
      vendas: [],
      despesas: [],
      resumo: null,
      porProduto: [],
      porCliente: [],
      porForma: [],
      porDespCategoria: []
    };

    relMsg("Filtros limpos.", "");
  });
}

if (btnRelExportPdf) {
  btnRelExportPdf.addEventListener("click", async () => {
    await relExportarPDF();
  });
}

// tenta iniciar com o mês atual
try {
  relSetDefaultMesAtual();
} catch (_) {}
