// js/despesas.js

// Map global de fornecedores
window.fornecedoresMap = window.fornecedoresMap || {};
let despesasCache = [];

// Itens de despesa (por fornecedor)
let itensDespesasCache = [];
let itensDespesasMap = {};
let itensPorFornecedorMap = {};

// Guarda exatamente o que está sendo exibido na tabela (filtrado ou não)
let despesasViewAtual = [];

// Charts (despesas)
let chartDespCategorias = null;
let chartDespFornecedores = null;
// linha mês a mês
let chartDespMensal = null;

// ==============================
// ✅ Estoque de insumos (integração)
// Regra: só gera entrada automática no estoque quando:
// 1) a despesa está vinculada a um "Item de despesa" (itemId), e
// 2) o grupo/categoria for: Matéria-prima, Embalagens ou Insumos de produção.
//
// Isso permite mensurar melhor o mês (CMV) usando a lógica:
//   CMV = Estoque inicial + Compras do mês - Estoque final
//
// Obs.: se a despesa for lançada como "OUTRO" (sem item cadastrado),
// ela NÃO entra no estoque automaticamente.
// ⚠️ Importante: este arquivo e o estoque-insumos.js rodam no mesmo escopo global.
// Para evitar conflito de nomes ("Identifier has already been declared"),
// mantemos um nome exclusivo aqui.
const GRUPOS_ESTOQUE_INSUMOS__DESPESAS = new Set([
  "Matéria-prima",
  "Embalagens",
  "Insumos de produção",
]);

function normalizarTexto(t) {
  return String(t || "").trim();
}

function despesaDeveGerarEstoqueInsumos(grupo) {
  const g = normalizarTexto(grupo);
  return GRUPOS_ESTOQUE_INSUMOS__DESPESAS.has(g);
}

// ----------------------
// Referências de fornecedores
// ----------------------
const fornNomeInput        = document.getElementById("forn-nome");
const btnSaveFornecedor    = document.getElementById("btn-save-fornecedor");
const btnCancelFornecedor  = document.getElementById("btn-cancel-fornecedor");
const fornMessage          = document.getElementById("forn-message");
const fornecedoresTbody    = document.getElementById("fornecedores-tbody");

let fornecedorEditandoId = null;

// ----------------------
// Referências da parte de itens de despesa (cadastro)
// ----------------------
const itemFornecedorSelect  = document.getElementById("item-fornecedor");
const itemDescricaoInput    = document.getElementById("item-descricao");
const itemCategoriaSelect   = document.getElementById("item-categoria");
const itemUnidadeInput      = document.getElementById("item-unidade");
const itemCodBarrasInput    = document.getElementById("item-cod-barras");
const itemPrecoPadraoInput  = document.getElementById("item-preco-padrao");
const btnSaveItemDespesa    = document.getElementById("btn-save-item-despesa");
const btnCancelItemDespesa  = document.getElementById("btn-cancel-item-despesa");
const itemMessage           = document.getElementById("item-message");
const itensDespesaTbody     = document.getElementById("itens-despesas-tbody");

let itemDespesaEditandoId = null;


// ----------------------
// Categorias de despesas (dinâmicas)
// ----------------------
let categoriasDespesasCache = [];
let categoriasDespesasMapById = {};
let categoriasDespesasMapByNome = {};
let categoriaEditandoId = null;

const catNomeInput       = document.getElementById("cat-nome");
const catGrupoSelect     = document.getElementById("cat-grupo");
const catStatusSelect    = document.getElementById("cat-status");
const btnSaveCategoria   = document.getElementById("btn-save-categoria");
const btnCancelCategoria = document.getElementById("btn-cancel-categoria");
const catMessage         = document.getElementById("cat-message");
const categoriasTbody    = document.getElementById("categorias-tbody");

function catNormalizar(t) {
  return String(t || "").trim();
}

function catEscapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function catSetMsg(texto, tipo) {
  if (!catMessage) return;
  catMessage.textContent = texto || "";
  catMessage.className = "msg" + (tipo ? " " + tipo : "");
}

function preencherSelectCategoriasDespesas() {
  if (!itemCategoriaSelect) return;

  const ativas = (categoriasDespesasCache || []).filter((c) => c.ativo !== false);
  ativas.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  // fallback (caso ainda não exista coleção)
  const fallback = [
    "Matéria-prima",
    "Embalagens",
    "Insumos de produção",
    "Despesas fixas",
    "Tributos",
    "Outros",
    "Combustível",
  ];

  let html = '<option value="">Selecione uma categoria</option>';

  if (ativas.length) {
    ativas.forEach((c) => {
      const nome = catNormalizar(c.nome);
      if (!nome) return;
      html += `<option value="${catEscapeHtml(nome)}">${catEscapeHtml(nome)}</option>`;
    });
  } else {
    fallback.forEach((nome) => {
      html += `<option value="${catEscapeHtml(nome)}">${catEscapeHtml(nome)}</option>`;
    });
  }

  itemCategoriaSelect.innerHTML = html;
}

async function garantirCategoriasPadraoSeVazio() {
  if (!db) return;

  const snap = await db.collection("categoriasDespesas").limit(1).get();
  if (!snap.empty) return;

  const padrao = [
    { nome: "Matéria-prima", grupoKpi: "Matéria-prima", ativo: true },
    { nome: "Embalagens", grupoKpi: "Embalagens", ativo: true },
    { nome: "Insumos de produção", grupoKpi: "Insumos de produção", ativo: true },
    { nome: "Despesas fixas", grupoKpi: "Despesas fixas", ativo: true },
    { nome: "Tributos", grupoKpi: "Tributos", ativo: true },
    { nome: "Outros", grupoKpi: "Outros", ativo: true },
    { nome: "Combustível", grupoKpi: "Combustível", ativo: true },
  ];

  for (const c of padrao) {
    await db.collection("categoriasDespesas").add({
      ...c,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
}

function catLimparEdicao() {
  categoriaEditandoId = null;
  if (catNomeInput) catNomeInput.value = "";
  if (catGrupoSelect) catGrupoSelect.value = "";
  if (catStatusSelect) catStatusSelect.value = "ativo";
  if (btnCancelCategoria) btnCancelCategoria.classList.add("hidden");
}

async function catPropagarAtualizacao(oldNome, newNome, newGrupo) {
  if (!db) return;

  const oldN = catNormalizar(oldNome);
  const newN = catNormalizar(newNome);
  const newG = catNormalizar(newGrupo);

  if (!oldN) return;

  // Itens
  const itensSnap = await db.collection("itensDespesas").where("categoria", "==", oldN).get();
  for (const doc of itensSnap.docs) {
    const upd = {};
    if (newN && oldN !== newN) upd.categoria = newN;
    if (newG) upd.categoriaGrupo = newG;
    if (Object.keys(upd).length) {
      await db.collection("itensDespesas").doc(doc.id).update(upd);
    }
  }

  // Despesas já lançadas
  const despSnap = await db.collection("despesas").where("itemDespesaCategoria", "==", oldN).get();
  for (const doc of despSnap.docs) {
    const upd = {};
    if (newN && oldN !== newN) upd.itemDespesaCategoria = newN;
    if (newG) upd.itemDespesaGrupo = newG;
    if (Object.keys(upd).length) {
      await db.collection("despesas").doc(doc.id).update(upd);
    }
  }
}

function renderizarCategoriasDespesas() {
  if (!categoriasTbody) return;

  if (!categoriasDespesasCache || !categoriasDespesasCache.length) {
    categoriasTbody.innerHTML = '<tr><td colspan="4">Nenhuma categoria cadastrada.</td></tr>';
    return;
  }

  categoriasTbody.innerHTML = "";

  const ordenada = [...categoriasDespesasCache].sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  ordenada.forEach((c) => {
    const tr = document.createElement("tr");

    const tdNome = document.createElement("td");
    tdNome.textContent = c.nome || "";
    tr.appendChild(tdNome);

    const tdGrupo = document.createElement("td");
    tdGrupo.textContent = c.grupoKpi || "";
    tr.appendChild(tdGrupo);

    const tdStatus = document.createElement("td");
    tdStatus.textContent = c.ativo ? "Ativa" : "Desativada";
    tr.appendChild(tdStatus);

    const tdAcoes = document.createElement("td");

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.className = "btn-small";
    btnEditar.addEventListener("click", () => {
      categoriaEditandoId = c.id;
      if (catNomeInput) catNomeInput.value = c.nome || "";
      if (catGrupoSelect) catGrupoSelect.value = c.grupoKpi || "";
      if (catStatusSelect) catStatusSelect.value = c.ativo ? "ativo" : "inativo";
      if (btnCancelCategoria) btnCancelCategoria.classList.remove("hidden");
      catSetMsg("Editando categoria...", "");
    });
    tdAcoes.appendChild(btnEditar);

    const btnToggle = document.createElement("button");
    btnToggle.textContent = c.ativo ? "Desativar" : "Ativar";
    btnToggle.className = "btn-small";
    btnToggle.addEventListener("click", async () => {
      try {
        await db.collection("categoriasDespesas").doc(c.id).update({
          ativo: !c.ativo,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await carregarCategoriasDespesas();
      } catch (e) {
        console.error("Erro ao alterar status da categoria:", e);
        alert("Erro ao alterar status da categoria.");
      }
    });
    tdAcoes.appendChild(btnToggle);

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir";
    btnExcluir.className = "btn-small btn-danger";
    btnExcluir.addEventListener("click", async () => {
      const ok = window.confirm(
        "Excluir categoria? Isso só é permitido se ela não estiver sendo usada em itens/despesas."
      );
      if (!ok) return;

      try {
        const nome = c.nome || "";
        const itensSnap = await db.collection("itensDespesas").where("categoria", "==", nome).limit(1).get();
        const despSnap  = await db.collection("despesas").where("itemDespesaCategoria", "==", nome).limit(1).get();

        if (!itensSnap.empty || !despSnap.empty) {
          alert("Essa categoria já está em uso. Use 'Desativar' em vez de excluir.");
          return;
        }

        await db.collection("categoriasDespesas").doc(c.id).delete();
        await carregarCategoriasDespesas();
      } catch (e) {
        console.error("Erro ao excluir categoria:", e);
        alert("Erro ao excluir categoria.");
      }
    });
    tdAcoes.appendChild(btnExcluir);

    tr.appendChild(tdAcoes);
    categoriasTbody.appendChild(tr);
  });
}

async function carregarCategoriasDespesas() {
  if (!db) return;

  try {
    await garantirCategoriasPadraoSeVazio();

    const snap = await db.collection("categoriasDespesas").orderBy("nome").get();

    categoriasDespesasCache = [];
    categoriasDespesasMapById = {};
    categoriasDespesasMapByNome = {};

    snap.forEach((doc) => {
      const d = doc.data() || {};
      const c = {
        id: doc.id,
        nome: catNormalizar(d.nome),
        grupoKpi: catNormalizar(d.grupoKpi),
        ativo: d.ativo !== false,
      };
      if (!c.nome) return;
      categoriasDespesasCache.push(c);
      categoriasDespesasMapById[c.id] = c;
      categoriasDespesasMapByNome[c.nome] = c;
    });

    preencherSelectCategoriasDespesas();
    renderizarCategoriasDespesas();

    // expõe para outros módulos (ex.: estoque-insumos)
    window.categoriasDespesasCache = categoriasDespesasCache;
    window.categoriasDespesasMapByNome = categoriasDespesasMapByNome;
    window.categoriasDespesasMapById = categoriasDespesasMapById;
  } catch (e) {
    console.error("Erro ao carregar categorias:", e);
    // fallback: mantém select com valores padrão
    preencherSelectCategoriasDespesas();
    if (categoriasTbody) {
      categoriasTbody.innerHTML = '<tr><td colspan="4">Erro ao carregar categorias.</td></tr>';
    }
  }
}

async function salvarCategoriaDespesa() {
  if (!db) return;

  const nome = catNormalizar(catNomeInput?.value || "");
  const grupo = catNormalizar(catGrupoSelect?.value || "");
  const status = catNormalizar(catStatusSelect?.value || "ativo");
  const ativo = status !== "inativo";

  if (!nome || !grupo) {
    catSetMsg("Informe a categoria e o grupo.", "error");
    return;
  }

  try {
    // checa duplicidade de nome (quando é novo ou renomeando)
    const existente = categoriasDespesasMapByNome[nome];
    if (existente && existente.id !== categoriaEditandoId) {
      catSetMsg("Já existe uma categoria com esse nome.", "error");
      return;
    }

    if (categoriaEditandoId) {
      const atual = categoriasDespesasMapById[categoriaEditandoId];
      const oldNome = atual ? atual.nome : "";

      await db.collection("categoriasDespesas").doc(categoriaEditandoId).update({
        nome,
        grupoKpi: grupo,
        ativo,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Se mudou nome e/ou grupo, propaga para itens e despesas
      if (atual && (oldNome !== nome || (atual.grupoKpi || "") !== grupo)) {
        await catPropagarAtualizacao(oldNome, nome, grupo);
      }

      catSetMsg("Categoria atualizada!", "ok");
    } else {
      await db.collection("categoriasDespesas").add({
        nome,
        grupoKpi: grupo,
        ativo,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      catSetMsg("Categoria salva!", "ok");
    }

    catLimparEdicao();
    await carregarCategoriasDespesas();
    await carregarItensDespesas();
    if (typeof carregarDespesas === "function") {
      await carregarDespesas();
    }
  } catch (e) {
    console.error("Erro ao salvar categoria:", e);
    catSetMsg("Erro ao salvar categoria.", "error");
  }
}

if (btnSaveCategoria) {
  btnSaveCategoria.addEventListener("click", salvarCategoriaDespesa);
}
if (btnCancelCategoria) {
  btnCancelCategoria.addEventListener("click", catLimparEdicao);
}

// ----------------------
// Referências da parte de despesas (lançamento)
// ----------------------
const despFornecedorSelect = document.getElementById("desp-fornecedor");
const despItemSelect       = document.getElementById("desp-item");
const despQtdInput         = document.getElementById("desp-quantidade");
const despDescInput        = document.getElementById("desp-descricao");
const despMarcaInput       = document.getElementById("desp-marca");
const despDataInput        = document.getElementById("desp-data");
const despDataEntradaInput = document.getElementById("desp-data-entrada");
const despValorUnitInput   = document.getElementById("desp-valor-unitario");
const despValorTotalInput  = document.getElementById("desp-valor-total");
const despFormaSelect      = document.getElementById("desp-forma-pagamento");
const btnSaveDespesa       = document.getElementById("btn-save-despesa");
const despMessage          = document.getElementById("desp-message");
const despesasTbody        = document.getElementById("despesas-tbody");

// ====== CONTROLE DE ITENS (LANÇAMENTO DE DESPESAS - CARRINHO) ======
let itensLancamentoDespesa = [];

const btnDespAddItem = document.getElementById("btn-desp-add-item");
const despPedidoItensTbody = document.getElementById("desp-pedido-itens-tbody");
const despLancTotalInput = document.getElementById("desp-lanc-total");

function calcularTotalLancamentoDespesa() {
  if (!despLancTotalInput) return;
  const total = itensLancamentoDespesa.reduce((acc, it) => acc + (Number(it.valorTotal) || 0), 0);
  despLancTotalInput.value = Number.isFinite(total) ? total.toFixed(2) : "0.00";
}

function renderItensLancamentoDespesa() {
  if (!despPedidoItensTbody) return;

  if (!itensLancamentoDespesa.length) {
    despPedidoItensTbody.innerHTML = '<tr><td colspan="5">Nenhum item adicionado.</td></tr>';
    calcularTotalLancamentoDespesa();
    return;
  }

  despPedidoItensTbody.innerHTML = itensLancamentoDespesa
    .map((it, idx) => {
      const desc = (it.descricao || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const qtd = Number(it.quantidade || 0);
      const vu = Number(it.valorUnitario || 0);
      const vt = Number(it.valorTotal || 0);
      return `
        <tr>
          <td>${desc}</td>
          <td>${qtd}</td>
          <td>${vu.toFixed(2)}</td>
          <td>${vt.toFixed(2)}</td>
          <td><button class="btn-secundario" data-desp-remove-idx="${idx}">Remover</button></td>
        </tr>
      `;
    })
    .join("");

  calcularTotalLancamentoDespesa();
}

function limparCamposItemDespesa() {
  if (despItemSelect) despItemSelect.value = "";
  if (despQtdInput) despQtdInput.value = "1";
  if (despDescInput) {
    despDescInput.value = "";
    despDescInput.readOnly = false;
  }
  if (despMarcaInput) despMarcaInput.value = "";
  if (despValorUnitInput) despValorUnitInput.value = "";
  if (despValorTotalInput) despValorTotalInput.value = "";
}

function adicionarItemDespesaAoCarrinho() {
  if (!db) return;

  const fornecedorId = despFornecedorSelect?.value || "";
  if (!fornecedorId) {
    if (despMessage) {
      despMessage.textContent = "Selecione um fornecedor antes de adicionar itens.";
      despMessage.className = "msg error";
    }
    return;
  }

  const itemId = despItemSelect?.value || "";
  const quantidade = Number(despQtdInput?.value || 0);
  const descricao = (despDescInput?.value || "").trim();
  const marca = (despMarcaInput?.value || "").trim();
  const valorUnit = Number(despValorUnitInput?.value || 0);
  const valorTotal = Number(despValorTotalInput?.value || (quantidade * valorUnit));

  if (!descricao || quantidade <= 0 || valorUnit <= 0 || valorTotal <= 0) {
    if (despMessage) {
      despMessage.textContent = "Preencha item/descrição, quantidade e valores antes de adicionar.";
      despMessage.className = "msg error";
    }
    return;
  }

  itensLancamentoDespesa.push({
    itemId,
    quantidade,
    descricao,
    marca,
    valorUnitario: valorUnit,
    valorTotal,
  });

  if (despMessage) {
    despMessage.textContent = "";
    despMessage.className = "msg";
  }

  renderItensLancamentoDespesa();
  limparCamposItemDespesa();
}

if (btnDespAddItem) {
  btnDespAddItem.addEventListener("click", adicionarItemDespesaAoCarrinho);
}

if (despPedidoItensTbody) {
  despPedidoItensTbody.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button[data-desp-remove-idx]");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-desp-remove-idx"));
    if (!Number.isFinite(idx)) return;
    itensLancamentoDespesa.splice(idx, 1);
    renderItensLancamentoDespesa();
  });
}



// Se a data de entrada no estoque não for preenchida, assume a data de pagamento.
// Isso mantém compatibilidade e evita erro quando o usuário não quiser separar as datas.
if (despDataInput && despDataEntradaInput) {
  despDataInput.addEventListener("change", () => {
    if (!despDataEntradaInput.value) {
      despDataEntradaInput.value = despDataInput.value;
    }
  });
}

// ----------------------
// Referências da parte de filtros
// ----------------------
const despFilterStartInput       = document.getElementById("desp-filter-start");
const despFilterEndInput         = document.getElementById("desp-filter-end");
const despFilterFornecedorSelect = document.getElementById("desp-filter-fornecedor");
const despFilterDescricaoInput   = document.getElementById("desp-filter-descricao");
const despFilterMarcaInput       = document.getElementById("desp-filter-marca");
const btnDespApplyFilters        = document.getElementById("btn-desp-apply-filters");
const btnDespClearFilters        = document.getElementById("btn-desp-clear-filters");
const btnDespExportCsv           = document.getElementById("btn-desp-export-csv");
const despesasTotalLabel         = document.getElementById("despesas-total");

// ----------------------
// Referências dos KPIs / resumos de despesas
// ----------------------
const kpiDespTotalEl        = document.getElementById("kpi-desp-total");
const kpiDespMpEl           = document.getElementById("kpi-desp-mp");
const kpiDespEmbEl          = document.getElementById("kpi-desp-emb");
const kpiDespFixasEl        = document.getElementById("kpi-desp-fixas");
const kpiDespNumLancEl      = document.getElementById("kpi-desp-num-lanc");
const kpiDespTopFornEl      = document.getElementById("kpi-desp-top-forn");
const kpiDespCombEl         = document.getElementById("kpi-desp-comb");


// ----------------------
// KPIs de comparação (mesmas datas do mês anterior)
// ----------------------
const kpiDespCompTotalEl     = document.getElementById("kpi-desp-comp-total");
const kpiDespCompMpEl        = document.getElementById("kpi-desp-comp-mp");
const kpiDespCompEmbEl       = document.getElementById("kpi-desp-comp-emb");
const kpiDespCompFixasEl     = document.getElementById("kpi-desp-comp-fixas");
const kpiDespCompNumLancEl   = document.getElementById("kpi-desp-comp-num-lanc");
const kpiDespCompTopFornEl   = document.getElementById("kpi-desp-comp-top-forn");
const kpiDespCompCombEl      = document.getElementById("kpi-desp-comp-comb");

const kpiDespCategoriasTbody    = document.getElementById("kpi-desp-categorias-tbody");
const kpiDespFornecedoresTbody  = document.getElementById("kpi-desp-fornecedores-tbody");

// ----------------------
// Utils
// ----------------------
function formatarMoedaBR(valor) {
  const num = Number(valor || 0);
  return "R$ " + num.toFixed(2).replace(".", ",");
}

function formatarPercent(num) {
  const n = Number(num || 0);
  return n.toFixed(1).replace(".", ",") + "%";
}

function numeroBR(num) {
  const n = Number(num || 0);
  if (isNaN(n)) return "";
  return n.toFixed(2).replace(".", ",");
}

// Formata "aaaa-mm-dd" -> "dd/mm/aaaa"
function formatarDataBrasil(dataIso) {
  if (!dataIso) return "";
  const partes = dataIso.split("-");
  if (partes.length !== 3) return dataIso;
  const [ano, mes, dia] = partes;
  return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
}

// ==============================
// ✅ FILTRO: iniciar no mês atual
// (igual Extrato/Relatório)
// ==============================
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toISODateLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function garantirMesAtualNoFiltroDespesas() {
  if (!despFilterStartInput || !despFilterEndInput) return;

  const startAtual = (despFilterStartInput.value || "").trim();
  const endAtual   = (despFilterEndInput.value || "").trim();

  // Se os dois vazios, coloca mês atual completo
  if (!startAtual && !endAtual) {
    const hoje = new Date();
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimo   = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    despFilterStartInput.value = toISODateLocal(primeiro);
    despFilterEndInput.value   = toISODateLocal(ultimo);
    return;
  }

  // Se só um preenchido, copia no outro
  if (startAtual && !endAtual) {
    despFilterEndInput.value = startAtual;
  } else if (!startAtual && endAtual) {
    despFilterStartInput.value = endAtual;
  }
}

// Já tenta aplicar ao carregar o JS (se inputs existirem)
garantirMesAtualNoFiltroDespesas();

// Atualizar total da despesa (qtd x valor unit)
function atualizarTotalDespesa() {
  if (!despValorTotalInput) return;
  const qtd  = Number(despQtdInput?.value || 0);
  const unit = Number(despValorUnitInput?.value || 0);

  if (qtd > 0 && unit >= 0) {
    despValorTotalInput.value = (qtd * unit).toFixed(2);
  } else {
    despValorTotalInput.value = "";
  }
}

if (despQtdInput) {
  despQtdInput.addEventListener("input", atualizarTotalDespesa);
}
if (despValorUnitInput) {
  despValorUnitInput.addEventListener("input", atualizarTotalDespesa);
}

function escapeCsvCell(value) {
  const s = String(value ?? "");
  const needsQuotes = /[;"\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function gerarNomeArquivoDespesas() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `despesas_${yyyy}-${mm}-${dd}_${hh}${mi}.csv`;
}

function exportarDespesasParaCsv() {
  const lista = Array.isArray(despesasViewAtual) ? despesasViewAtual : [];
  if (!lista.length) {
    alert("Não há despesas para exportar.");
    return;
  }

  // CSV com ; (Excel pt-BR costuma abrir melhor)
  const header = [
    "Data",
    "Fornecedor",
    "Descrição",
    "Categoria",
    "Marca",
    "Qtd",
    "Valor unit. (R$)",
    "Total (R$)",
    "Forma pagto."
  ].join(";");

  const linhas = lista.map((d) => {
    const data = formatarDataBrasil(d.dataPagamento || "");
    const fornecedor = d.fornecedorNome || "";
    const descricao = d.descricaoItem || "";
    const categoria = (d.itemDespesaCategoria || d.categoria || "").trim();
    const marca = d.marca || "";
    const qtd = d.quantidade != null ? d.quantidade : "";
    const vUnit = d.valorUnitario != null ? numeroBR(d.valorUnitario) : "";
    const vTotal = d.valorTotal != null ? numeroBR(d.valorTotal) : "";
    const forma = d.formaDescricao || "";

    return [
      escapeCsvCell(data),
      escapeCsvCell(fornecedor),
      escapeCsvCell(descricao),
      escapeCsvCell(categoria),
      escapeCsvCell(marca),
      escapeCsvCell(qtd),
      escapeCsvCell(vUnit),
      escapeCsvCell(vTotal),
      escapeCsvCell(forma)
    ].join(";");
  });

  // BOM para acentuação correta no Excel
  const csv = "\uFEFF" + [header, ...linhas].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = gerarNomeArquivoDespesas();
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

if (btnDespExportCsv) {
  btnDespExportCsv.addEventListener("click", exportarDespesasParaCsv);
}

// ----------------------
// Fornecedores
// ----------------------
function iniciarEdicaoFornecedor(fornecedorId) {
  const f = (window.fornecedoresMap || {})[fornecedorId];
  if (!f || !fornNomeInput) return;

  fornecedorEditandoId = fornecedorId;
  fornNomeInput.value = (f.nome || "").trim();

  if (btnSaveFornecedor) btnSaveFornecedor.textContent = "Atualizar fornecedor";
  if (btnCancelFornecedor) btnCancelFornecedor.classList.remove("hidden");

  if (fornMessage) {
    fornMessage.textContent = "Editando fornecedor. Altere o nome e clique em Atualizar.";
    fornMessage.className = "msg";
  }

  // traz o campo para a área visível
  try { fornNomeInput.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {}
}

function cancelarEdicaoFornecedor() {
  fornecedorEditandoId = null;
  if (fornNomeInput) fornNomeInput.value = "";
  if (btnSaveFornecedor) btnSaveFornecedor.textContent = "Salvar fornecedor";
  if (btnCancelFornecedor) btnCancelFornecedor.classList.add("hidden");
  if (fornMessage) {
    fornMessage.textContent = "";
    fornMessage.className = "msg";
  }
}

async function carregarFornecedores() {
  if (!db || !fornecedoresTbody) return;

  try {
    const snap = await db.collection("fornecedores")
      .orderBy("nome")
      .get();

    window.fornecedoresMap = {};
    fornecedoresTbody.innerHTML = "";

    let optionsHtml = '<option value="">Selecione um fornecedor</option>';
    let filterOptionsHtml = '<option value="">Todos os fornecedores</option>';

    if (snap.empty) {
      fornecedoresTbody.innerHTML =
        '<tr><td colspan="2">Nenhum fornecedor cadastrado.</td></tr>';
    } else {
      snap.forEach((doc) => {
        const dados = doc.data();
        const id = doc.id;
        window.fornecedoresMap[id] = { id, ...dados };

        const nome = dados.nome || "Fornecedor";

        optionsHtml += `<option value="${id}">${nome}</option>`;
        filterOptionsHtml += `<option value="${id}">${nome}</option>`;

        const tr = document.createElement("tr");

        const tdNome = document.createElement("td");
        tdNome.textContent = nome;
        tr.appendChild(tdNome);

        const tdAcoes = document.createElement("td");

        const btnEditar = document.createElement("button");
        btnEditar.textContent = "Editar";
        btnEditar.className = "btn-small";
        btnEditar.style.marginRight = "6px";
        btnEditar.addEventListener("click", () => iniciarEdicaoFornecedor(id));
        tdAcoes.appendChild(btnEditar);

        const btnExcluir = document.createElement("button");
        btnExcluir.textContent = "Excluir";
        btnExcluir.className = "btn-small btn-danger";
        btnExcluir.addEventListener("click", () => excluirFornecedor(id));
        tdAcoes.appendChild(btnExcluir);
        tr.appendChild(tdAcoes);

        fornecedoresTbody.appendChild(tr);
      });
    }

    if (despFornecedorSelect) {
      despFornecedorSelect.innerHTML = optionsHtml;
    }
    if (despFilterFornecedorSelect) {
      despFilterFornecedorSelect.innerHTML = filterOptionsHtml;
    }
    if (itemFornecedorSelect) {
      itemFornecedorSelect.innerHTML = optionsHtml;
    }
  } catch (e) {
    console.error("Erro ao carregar fornecedores:", e);
    if (fornMessage) {
      fornMessage.textContent = "Erro ao carregar fornecedores.";
      fornMessage.className = "msg error";
    }
  }
}

async function salvarFornecedor() {
  if (!fornNomeInput) return;

  const nome = fornNomeInput.value.trim();

  if (!nome) {
    if (fornMessage) {
      fornMessage.textContent = "Informe o nome do fornecedor.";
      fornMessage.className = "msg error";
    }
    return;
  }

  try {
    if (fornecedorEditandoId) {
      await db.collection("fornecedores").doc(fornecedorEditandoId).update({
        nome,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      if (fornMessage) {
        fornMessage.textContent = "Fornecedor atualizado com sucesso!";
        fornMessage.className = "msg ok";
      }
      cancelarEdicaoFornecedor();
    } else {
      await db.collection("fornecedores").add({
        nome,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      fornNomeInput.value = "";
      if (fornMessage) {
        fornMessage.textContent = "Fornecedor salvo com sucesso!";
        fornMessage.className = "msg ok";
      }
    }

    await carregarFornecedores();
    // Atualiza a tabela de itens para refletir nome atualizado no UI
    await carregarItensDespesas();
  } catch (e) {
    console.error("Erro ao salvar fornecedor:", e);
    if (fornMessage) {
      fornMessage.textContent = "Erro ao salvar fornecedor.";
      fornMessage.className = "msg error";
    }
  }
}

async function excluirFornecedor(id) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir este fornecedor?"
  );
  if (!confirmar) return;

  try {
    await db.collection("fornecedores").doc(id).delete();
    if (fornecedorEditandoId === id) {
      cancelarEdicaoFornecedor();
    }
    await carregarFornecedores();
  } catch (e) {
    console.error("Erro ao excluir fornecedor:", e);
    alert("Erro ao excluir fornecedor.");
  }
}

if (btnSaveFornecedor) {
  btnSaveFornecedor.addEventListener("click", salvarFornecedor);
}

if (btnCancelFornecedor) {
  btnCancelFornecedor.addEventListener("click", cancelarEdicaoFornecedor);
}

// ----------------------
// Cadastro de itens de despesa
// ----------------------
function iniciarEdicaoItemDespesa(itemId) {
  const item = itensDespesasMap[itemId];
  if (!item) return;

  itemDespesaEditandoId = itemId;

  if (itemFornecedorSelect) itemFornecedorSelect.value = item.fornecedorId || "";
  if (itemDescricaoInput) itemDescricaoInput.value = item.descricao || "";
  if (itemCategoriaSelect) itemCategoriaSelect.value = item.categoria || "";
  if (itemUnidadeInput) itemUnidadeInput.value = item.unidade || "";
  if (itemCodBarrasInput) itemCodBarrasInput.value = item.codigoBarras || "";
  if (itemPrecoPadraoInput) {
    itemPrecoPadraoInput.value = item.precoPadrao != null ? String(item.precoPadrao.toFixed(2)) : "";
  }

  if (btnSaveItemDespesa) btnSaveItemDespesa.textContent = "Atualizar item";
  if (btnCancelItemDespesa) btnCancelItemDespesa.classList.remove("hidden");

  if (itemMessage) {
    itemMessage.textContent = "Editando item. Altere os campos e clique em Atualizar.";
    itemMessage.className = "msg";
  }

  try { itemDescricaoInput?.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {}
}

function cancelarEdicaoItemDespesa() {
  itemDespesaEditandoId = null;

  if (itemFornecedorSelect) itemFornecedorSelect.value = "";
  if (itemDescricaoInput) itemDescricaoInput.value = "";
  if (itemCategoriaSelect) itemCategoriaSelect.value = "";
  if (itemUnidadeInput) itemUnidadeInput.value = "";
  if (itemCodBarrasInput) itemCodBarrasInput.value = "";
  if (itemPrecoPadraoInput) itemPrecoPadraoInput.value = "";

  if (btnSaveItemDespesa) btnSaveItemDespesa.textContent = "Salvar item";
  if (btnCancelItemDespesa) btnCancelItemDespesa.classList.add("hidden");

  if (itemMessage) {
    itemMessage.textContent = "";
    itemMessage.className = "msg";
  }
}

async function carregarItensDespesas() {
  if (!db || !itensDespesaTbody) return;

  try {
    const snap = await db
      .collection("itensDespesas")
      .orderBy("descricao")
      .get();

    itensDespesasCache = [];
    itensDespesasMap = {};
    itensPorFornecedorMap = {};
    itensDespesaTbody.innerHTML = "";

    if (snap.empty) {
      itensDespesaTbody.innerHTML =
        '<tr><td colspan="7">Nenhum item cadastrado.</td></tr>';
    } else {
      snap.forEach((doc) => {
        const dados = doc.data();
        const item = {
          id: doc.id,
          fornecedorId: dados.fornecedorId || "",
          fornecedorNome: dados.fornecedorNome || "",
          descricao: dados.descricao || "",
          categoria: dados.categoria || "",
        categoriaGrupo: dados.categoriaGrupo || null,
          unidade: dados.unidade || "",
          codigoBarras: dados.codigoBarras || "",
          precoPadrao:
            typeof dados.precoPadrao === "number" ? dados.precoPadrao : null,
        };

        itensDespesasCache.push(item);
        itensDespesasMap[item.id] = item;

        if (!itensPorFornecedorMap[item.fornecedorId]) {
          itensPorFornecedorMap[item.fornecedorId] = [];
        }
        itensPorFornecedorMap[item.fornecedorId].push(item);

        const tr = document.createElement("tr");

        const tdForn = document.createElement("td");
        const fornAtual = (window.fornecedoresMap || {})[item.fornecedorId];
        tdForn.textContent = (fornAtual && fornAtual.nome) ? fornAtual.nome : item.fornecedorNome;
        tr.appendChild(tdForn);

        const tdDesc = document.createElement("td");
        tdDesc.textContent = item.descricao;
        tr.appendChild(tdDesc);

        const tdCat = document.createElement("td");
        tdCat.textContent = item.categoria || "";
        tr.appendChild(tdCat);

        const tdUnd = document.createElement("td");
        tdUnd.textContent = item.unidade || "";
        tr.appendChild(tdUnd);

        const tdCod = document.createElement("td");
        tdCod.textContent = item.codigoBarras || "";
        tr.appendChild(tdCod);

        const tdPreco = document.createElement("td");
        tdPreco.textContent =
          item.precoPadrao != null ? item.precoPadrao.toFixed(2) : "";
        tr.appendChild(tdPreco);

        const tdAcoes = document.createElement("td");

        const btnEditar = document.createElement("button");
        btnEditar.textContent = "Editar";
        btnEditar.className = "btn-small";
        btnEditar.style.marginRight = "6px";
        btnEditar.addEventListener("click", () => iniciarEdicaoItemDespesa(item.id));
        tdAcoes.appendChild(btnEditar);

        const btnExcluir = document.createElement("button");
        btnExcluir.textContent = "Excluir";
        btnExcluir.className = "btn-small btn-danger";
        btnExcluir.addEventListener("click", () => excluirItemDespesa(item.id));
        tdAcoes.appendChild(btnExcluir);
        tr.appendChild(tdAcoes);

        itensDespesaTbody.appendChild(tr);
      });
    }

    const fornecedorAtual = despFornecedorSelect?.value || "";
    if (fornecedorAtual) {
      atualizarSelectItensFornecedor(fornecedorAtual);
    } else if (despItemSelect) {
      despItemSelect.innerHTML =
        '<option value="">Selecione um item (opcional)</option>';
    }

    // expõe para outros módulos (ex.: estoque-insumos)
    window.itensDespesasCache = itensDespesasCache;
    window.itensDespesasMap = itensDespesasMap;
    window.itensPorFornecedorMap = itensPorFornecedorMap;
  } catch (e) {
    console.error("Erro ao carregar itens de despesa:", e);
    if (itensDespesaTbody) {
      itensDespesaTbody.innerHTML =
        '<tr><td colspan="7">Erro ao carregar itens.</td></tr>';
    }
  }
}

async function salvarItemDespesa() {
  if (!itemFornecedorSelect || !db) return;

  const fornecedorId = itemFornecedorSelect.value;
  const descricao = (itemDescricaoInput?.value || "").trim();
  const categoria = itemCategoriaSelect?.value || "";
  const categoriaGrupo = (categoriasDespesasMapByNome[categoria]?.grupoKpi) || categoria || "";
  const unidade   = (itemUnidadeInput?.value || "").trim();
  const codigoBarras = (itemCodBarrasInput?.value || "").trim();
  const precoStr  = itemPrecoPadraoInput?.value || "";
  const precoPadrao =
    precoStr !== "" ? Number(precoStr) : null;

  if (itemMessage) {
    itemMessage.textContent = "";
    itemMessage.className = "msg";
  }

  if (!fornecedorId || !descricao) {
    if (itemMessage) {
      itemMessage.textContent =
        "Selecione um fornecedor e informe a descrição do item.";
      itemMessage.className = "msg error";
    }
    return;
  }

  const fornecedor = fornecedoresMap[fornecedorId] || {};
  const fornecedorNome = fornecedor.nome || "";

  try {
    const payload = {
      fornecedorId,
      fornecedorNome,
      descricao,
      categoria,
      categoriaGrupo: categoriaGrupo || null,
      unidade,
      codigoBarras,
      precoPadrao: precoPadrao != null && !isNaN(precoPadrao) ? precoPadrao : null,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (itemDespesaEditandoId) {
      await db.collection("itensDespesas").doc(itemDespesaEditandoId).update(payload);
      if (itemMessage) {
        itemMessage.textContent = "Item atualizado com sucesso!";
        itemMessage.className = "msg ok";
      }
      cancelarEdicaoItemDespesa();
    } else {
      await db.collection("itensDespesas").add({
        ...payload,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (itemMessage) {
        itemMessage.textContent = "Item salvo com sucesso!";
        itemMessage.className = "msg ok";
      }

      itemDescricaoInput.value = "";
      if (itemCategoriaSelect) itemCategoriaSelect.value = "";
      itemUnidadeInput.value = "";
      itemCodBarrasInput.value = "";
      itemPrecoPadraoInput.value = "";
    }

    await carregarItensDespesas();
  } catch (e) {
    console.error("Erro ao salvar item de despesa:", e);
    if (itemMessage) {
      itemMessage.textContent = "Erro ao salvar item.";
      itemMessage.className = "msg error";
    }
  }
}

async function excluirItemDespesa(id) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir este item de despesa?"
  );
  if (!confirmar) return;

  try {
    await db.collection("itensDespesas").doc(id).delete();
    if (itemDespesaEditandoId === id) {
      cancelarEdicaoItemDespesa();
    }
    await carregarItensDespesas();
  } catch (e) {
    console.error("Erro ao excluir item de despesa:", e);
    alert("Erro ao excluir item de despesa.");
  }
}

if (btnSaveItemDespesa) {
  btnSaveItemDespesa.addEventListener("click", salvarItemDespesa);
}

if (btnCancelItemDespesa) {
  btnCancelItemDespesa.addEventListener("click", cancelarEdicaoItemDespesa);
}

function atualizarSelectItensFornecedor(fornecedorId) {
  if (!despItemSelect) return;

  despItemSelect.innerHTML =
    '<option value="">Selecione um item (opcional)</option>';

  const lista = itensPorFornecedorMap[fornecedorId] || [];
  if (lista.length === 0) {
    const optOutro = document.createElement("option");
    optOutro.value = "OUTRO";
    optOutro.textContent = "Outro item...";
    despItemSelect.appendChild(optOutro);
    return;
  }

  const ordenada = [...lista].sort((a, b) =>
    (a.descricao || "").localeCompare(b.descricao || "")
  );

  ordenada.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.descricao;
    despItemSelect.appendChild(opt);
  });

  const optOutro = document.createElement("option");
  optOutro.value = "OUTRO";
  optOutro.textContent = "Outro item...";
  despItemSelect.appendChild(optOutro);
}

if (despFornecedorSelect) {
  despFornecedorSelect.addEventListener("change", () => {
    const fornecedorId = despFornecedorSelect.value || "";
    atualizarSelectItensFornecedor(fornecedorId);

    if (despItemSelect) despItemSelect.value = "";
    if (despDescInput) {
      despDescInput.value = "";
      despDescInput.readOnly = false;
    }
    if (despValorUnitInput) despValorUnitInput.value = "";
    atualizarTotalDespesa();
  });
}

if (despItemSelect) {
  despItemSelect.addEventListener("change", () => {
    const itemId = despItemSelect.value;

    if (!itemId || itemId === "OUTRO") {
      if (despDescInput) {
        despDescInput.readOnly = false;
      }
      return;
    }

    const item = itensDespesasMap[itemId];
    if (!item) return;

    if (despDescInput) {
      despDescInput.value = item.descricao || "";
      despDescInput.readOnly = true;
    }

    if (
      item.precoPadrao != null &&
      !isNaN(item.precoPadrao) &&
      despValorUnitInput
    ) {
      despValorUnitInput.value = Number(item.precoPadrao).toFixed(2);
    }

    atualizarTotalDespesa();
  });
}

// ----------------------
// Formas de pagamento no select de despesas
// ----------------------
function preencherFormasPagamentoDespesas() {
  if (!despFormaSelect) return;
  if (typeof formasMap === "undefined") return;

  despFormaSelect.innerHTML =
    '<option value="">Selecione a forma de pagamento</option>';

  Object.keys(formasMap).forEach((id) => {
    const forma = formasMap[id] || {};
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = forma.descricao || "Forma";
    despFormaSelect.appendChild(opt);
  });
}

// ----------------------
// Despesas - carregar lista
// ----------------------
async function carregarDespesas() {
  if (!despesasTbody || !db) return;

  despesasTbody.innerHTML =
    '<tr><td colspan="10">Carregando...</td></tr>';
  despesasCache = [];


  // Garante categorias para classificar KPIs (grupo)
  if (typeof carregarCategoriasDespesas === "function") {
    await carregarCategoriasDespesas();
  }

  try {
    let query = db
      .collection("despesas")
      .orderBy("dataPagamentoTimestamp", "desc")
      .limit(500);

    const snap = await query.get();

    if (snap.empty) {
      despesasTbody.innerHTML =
        '<tr><td colspan="10">Nenhuma despesa lançada.</td></tr>';
      despesasViewAtual = [];
      if (despesasTotalLabel) {
        despesasTotalLabel.textContent = formatarMoedaBR(0);
      }
      await carregarItensDespesas();
      atualizarResumoDespesas([]);
      return;
    }

    snap.forEach((doc) => {
      const d = doc.data();
      let ts = d.dataPagamentoTimestamp;

      if (!ts && d.dataPagamento) {
        const parsed = new Date(d.dataPagamento);
        ts = isNaN(parsed.getTime()) ? null : parsed.getTime();
      }

      despesasCache.push({
        id: doc.id,
        ...d,
        dataPagamentoTimestamp: ts || null,
      });
    });

    despesasCache.sort(
      (a, b) => (a.dataPagamentoTimestamp || 0) - (b.dataPagamentoTimestamp || 0)
    );

    // ✅ aplica o padrão de mês atual se estiver vazio e já filtra ao iniciar
    garantirMesAtualNoFiltroDespesas();
    aplicarFiltrosDespesas();

    await carregarItensDespesas();
  } catch (e) {
    console.error("Erro ao carregar despesas:", e);
    despesasTbody.innerHTML =
      '<tr><td colspan="10">Erro ao carregar despesas.</td></tr>';
    despesasViewAtual = [];
    if (despesasTotalLabel) {
      despesasTotalLabel.textContent = formatarMoedaBR(0);
    }
    atualizarResumoDespesas([]);
  }
}

// ----------------------
// Despesas - renderizar tabela
// ----------------------
function renderizarDespesas(lista) {
  if (!despesasTbody) return;

  const dados = Array.isArray(lista) ? lista : despesasCache;
  despesasViewAtual = Array.isArray(dados) ? [...dados] : [];

  if (!dados || dados.length === 0) {
    despesasTbody.innerHTML =
      '<tr><td colspan="10">Nenhuma despesa lançada.</td></tr>';
    if (despesasTotalLabel) {
      despesasTotalLabel.textContent = formatarMoedaBR(0);
    }
    return;
  }

  despesasTbody.innerHTML = "";
  let totalFiltrado = 0;

  dados.forEach((d) => {
    const tr = document.createElement("tr");

    const tdData = document.createElement("td");
    tdData.textContent = formatarDataBrasil(d.dataPagamento || "");
    tr.appendChild(tdData);

    const tdForn = document.createElement("td");
    tdForn.textContent = d.fornecedorNome || "";
    tr.appendChild(tdForn);

    const tdDesc = document.createElement("td");
    tdDesc.textContent = d.descricaoItem || "";
    tr.appendChild(tdDesc);

    // Categoria (vinda do item do fornecedor, quando existir)
    const tdCat = document.createElement("td");
    const categoriaNome = d.itemDespesaCategoria || d.categoria || "";
    tdCat.textContent = (categoriaNome || "").trim() || "—";
    tr.appendChild(tdCat);

    const tdMarca = document.createElement("td");
    tdMarca.textContent = d.marca || "";
    tr.appendChild(tdMarca);

    const tdQtd = document.createElement("td");
    tdQtd.textContent =
      d.quantidade != null ? d.quantidade : "";
    tr.appendChild(tdQtd);

    const tdVUnit = document.createElement("td");
    tdVUnit.textContent =
      d.valorUnitario != null
        ? Number(d.valorUnitario).toFixed(2)
        : "";
    tr.appendChild(tdVUnit);

    const tdVTotal = document.createElement("td");
    const vTotalNum =
      d.valorTotal != null ? Number(d.valorTotal) : 0;
    tdVTotal.textContent =
      vTotalNum > 0 ? vTotalNum.toFixed(2) : "";
    tr.appendChild(tdVTotal);

    totalFiltrado += vTotalNum;

    const tdForma = document.createElement("td");
    tdForma.textContent = d.formaDescricao || "";
    tr.appendChild(tdForma);

    const tdAcoes = document.createElement("td");
    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir";
    btnExcluir.className = "btn-small btn-danger";
    btnExcluir.addEventListener("click", () => excluirDespesa(d.id));
    tdAcoes.appendChild(btnExcluir);
    tr.appendChild(tdAcoes);

    despesasTbody.appendChild(tr);
  });

  if (despesasTotalLabel) {
    despesasTotalLabel.textContent = formatarMoedaBR(totalFiltrado);
  }
}

// ----------------------
// Filtros de despesas
// ----------------------
function aplicarFiltrosDespesas() {
  // ✅ garante mês atual se estiver vazio (não muda se já tiver data)
  garantirMesAtualNoFiltroDespesas();

  if (!despesasCache || despesasCache.length === 0) {
    renderizarDespesas([]);
    atualizarResumoDespesas([]);
    return;
  }

  let filtradas = [...despesasCache];

  const start = despFilterStartInput?.value || "";
  const end   = despFilterEndInput?.value || "";

  if (start) {
    const dStart = new Date(start);
    dStart.setHours(0, 0, 0, 0);
    const tsStart = dStart.getTime();

    filtradas = filtradas.filter((d) => {
      const ts = d.dataPagamentoTimestamp || 0;
      return ts >= tsStart;
    });
  }

  if (end) {
    const dEnd = new Date(end);
    dEnd.setHours(23, 59, 59, 999);
    const tsEnd = dEnd.getTime();

    filtradas = filtradas.filter((d) => {
      const ts = d.dataPagamentoTimestamp || 0;
      return ts <= tsEnd;
    });
  }

  const fornecedorFiltro = despFilterFornecedorSelect?.value || "";
  if (fornecedorFiltro) {
    filtradas = filtradas.filter((d) => d.fornecedorId === fornecedorFiltro);
  }

  const descFiltro = (despFilterDescricaoInput?.value || "")
    .trim()
    .toLowerCase();
  if (descFiltro) {
    filtradas = filtradas.filter((d) =>
      (d.descricaoItem || "").toLowerCase().includes(descFiltro)
    );
  }

  const marcaFiltro = (despFilterMarcaInput?.value || "")
    .trim()
    .toLowerCase();
  if (marcaFiltro) {
    filtradas = filtradas.filter((d) =>
      (d.marca || "").toLowerCase().includes(marcaFiltro)
    );
  }

  filtradas.sort(
    (a, b) => (a.dataPagamentoTimestamp || 0) - (b.dataPagamentoTimestamp || 0)
  );

  renderizarDespesas(filtradas);
  atualizarResumoDespesas(filtradas);
}

function limparFiltrosDespesas() {
  // ✅ limpa os outros filtros e volta o período para o mês atual (igual vendas)
  if (despFilterFornecedorSelect) despFilterFornecedorSelect.value = "";
  if (despFilterDescricaoInput) despFilterDescricaoInput.value = "";
  if (despFilterMarcaInput) despFilterMarcaInput.value = "";

  if (despFilterStartInput) despFilterStartInput.value = "";
  if (despFilterEndInput) despFilterEndInput.value = "";

  garantirMesAtualNoFiltroDespesas();
  aplicarFiltrosDespesas();
}

if (btnDespApplyFilters) {
  btnDespApplyFilters.addEventListener("click", aplicarFiltrosDespesas);
}
if (btnDespClearFilters) {
  btnDespClearFilters.addEventListener("click", limparFiltrosDespesas);
}

// ----------------------
// Indicadores / resumos / gráficos de despesas
// ----------------------

// ----------------------
// Comparação (mesmas datas do mês anterior)
// ----------------------
function despFormatarNumeroBR(valor, casas = 0) {
  const n = Number(valor || 0);
  if (!isFinite(n)) return "0";
  return n.toFixed(casas).replace(".", ",");
}

function despShiftMonthISO(iso, deltaMonths) {
  if (!iso) return null;
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length !== 3) return null;

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;

  // Começa no 1º dia do mês para evitar “pulos” (ex: 31 -> mês seguinte)
  const base = new Date(y, m - 1, 1);
  const target = new Date(base.getFullYear(), base.getMonth() + deltaMonths, 1);

  // Ajusta o dia para o último dia do mês de destino, se necessário (ex: 31 -> 28/29)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(d, lastDay);

  const finalDate = new Date(target.getFullYear(), target.getMonth(), day);
  return toISODateLocal(finalDate);
}

function despObterPeriodoAnteriorEquivalente(startIso, endIso) {
  if (!startIso || !endIso) return { prevStart: null, prevEnd: null };

  const prevStart = despShiftMonthISO(startIso, -1);
  const prevEnd = despShiftMonthISO(endIso, -1);

  if (!prevStart || !prevEnd) return { prevStart: null, prevEnd: null };
  return { prevStart, prevEnd };
}

function despFormatarDelta(curr, prev, isMoney = false, casas = 0) {
  const c = Number(curr || 0);
  const p = Number(prev || 0);
  if (!isFinite(c) || !isFinite(p)) return "—";

  const delta = c - p;

  let percTxt = "—";
  if (p !== 0) {
    const perc = (delta / p) * 100;
    percTxt = (perc >= 0 ? "+" : "") + despFormatarNumeroBR(perc, 1) + "%";
  }

  let deltaTxt = "—";
  if (isMoney) {
    const abs = Math.abs(delta);
    deltaTxt = (delta >= 0 ? "+" : "-") + formatarMoedaBR(abs);
  } else {
    deltaTxt = (delta >= 0 ? "+" : "") + despFormatarNumeroBR(delta, casas);
  }

  return `${deltaTxt} (${percTxt})`;
}

function despFormatarPontosPercentuais(currPerc, prevPerc) {
  const c = Number(currPerc || 0);
  const p = Number(prevPerc || 0);
  if (!isFinite(c) || !isFinite(p)) return "—";
  const dp = c - p;
  return (dp >= 0 ? "+" : "") + despFormatarNumeroBR(dp, 1) + " p.p.";
}

function despAplicarFiltrosEmMemoriaPeriodo(startIso, endIso) {
  if (!despesasCache || despesasCache.length === 0) return [];

  let filtradas = despesasCache.slice();

  if (startIso) {
    const dStart = new Date(startIso);
    dStart.setHours(0, 0, 0, 0);
    const tsStart = dStart.getTime();

    filtradas = filtradas.filter((d) => {
      const ts = d.dataPagamentoTimestamp || 0;
      return ts >= tsStart;
    });
  }

  if (endIso) {
    const dEnd = new Date(endIso);
    dEnd.setHours(23, 59, 59, 999);
    const tsEnd = dEnd.getTime();

    filtradas = filtradas.filter((d) => {
      const ts = d.dataPagamentoTimestamp || 0;
      return ts <= tsEnd;
    });
  }

  // Mantém os demais filtros (fornecedor / descrição / marca)
  const fornecedorFiltro = despFilterFornecedorSelect?.value || "";
  if (fornecedorFiltro) {
    filtradas = filtradas.filter((d) => d.fornecedorId === fornecedorFiltro);
  }

  const descFiltro = (despFilterDescricaoInput?.value || "")
    .trim()
    .toLowerCase();
  if (descFiltro) {
    filtradas = filtradas.filter((d) =>
      (d.descricaoItem || "").toLowerCase().includes(descFiltro)
    );
  }

  const marcaFiltro = (despFilterMarcaInput?.value || "")
    .trim()
    .toLowerCase();
  if (marcaFiltro) {
    filtradas = filtradas.filter((d) =>
      (d.marca || "").toLowerCase().includes(marcaFiltro)
    );
  }

  filtradas.sort(
    (a, b) => (a.dataPagamentoTimestamp || 0) - (b.dataPagamentoTimestamp || 0)
  );

  return filtradas;
}


function despObterGrupoKpi(d) {
  if (!d) return "";
  const g = String(d.itemDespesaGrupo || "").trim();
  if (g) return g;
  const cat = String(d.itemDespesaCategoria || "").trim();
  if (!cat) return "";
  const ref = categoriasDespesasMapByNome ? categoriasDespesasMapByNome[cat] : null;
  const g2 = ref && ref.grupoKpi ? String(ref.grupoKpi).trim() : "";
  return g2 || cat;
}

function despKpiKey(txt) {
  return String(txt || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function despCalcularMetricasComparacao(lista) {
  const dados = Array.isArray(lista) ? lista : [];

  let total = 0;
  let totalMp = 0;
  let totalEmb = 0;
  let totalFixas = 0;
  let totalComb = 0;
  const gastoPorFornecedor = {};

  dados.forEach((d) => {
    const v = Number(d.valorTotal || 0);
    if (!isNaN(v)) total += v;

    const grupoKey = despKpiKey(despObterGrupoKpi(d));
    if (grupoKey === "materia-prima") totalMp += v;
    if (grupoKey === "embalagens") totalEmb += v;
    if (grupoKey === "despesas fixas") totalFixas += v;
    if (grupoKey === "combustivel") totalComb += v;

    const fornNome = (d.fornecedorNome || "—").trim();
    if (!gastoPorFornecedor[fornNome]) gastoPorFornecedor[fornNome] = 0;
    gastoPorFornecedor[fornNome] += v;
  });

  // Top fornecedor
  let topFornNome = "—";
  let topFornValor = 0;
  for (const nome in gastoPorFornecedor) {
    if (gastoPorFornecedor[nome] > topFornValor) {
      topFornValor = gastoPorFornecedor[nome];
      topFornNome = nome;
    }
  }

  const numLanc = dados.length;
  const topFornShare = total > 0 ? (topFornValor / total) * 100 : 0;

  return {
    total,
    totalMp,
    totalEmb,
    totalFixas,
    totalComb,
    numLanc,
    gastoPorFornecedor,
    topFornNome,
    topFornValor,
    topFornShare,
  };
}

function despLimparKPIsComparacao() {
  if (!kpiDespCompTotalEl && !kpiDespCompMpEl && !kpiDespCompEmbEl && !kpiDespCompFixasEl &&
      !kpiDespCompNumLancEl && !kpiDespCompTopFornEl && !kpiDespCompCombEl) return;

  if (kpiDespCompTotalEl) kpiDespCompTotalEl.textContent = "—";
  if (kpiDespCompMpEl) kpiDespCompMpEl.textContent = "—";
  if (kpiDespCompEmbEl) kpiDespCompEmbEl.textContent = "—";
  if (kpiDespCompFixasEl) kpiDespCompFixasEl.textContent = "—";
  if (kpiDespCompNumLancEl) kpiDespCompNumLancEl.textContent = "—";
  if (kpiDespCompTopFornEl) kpiDespCompTopFornEl.textContent = "—";
  if (kpiDespCompCombEl) kpiDespCompCombEl.textContent = "—";
}

function despAtualizarKPIsComparacao(metricAtual, metricAnterior) {
  if (!kpiDespCompTotalEl && !kpiDespCompMpEl && !kpiDespCompEmbEl && !kpiDespCompFixasEl &&
      !kpiDespCompNumLancEl && !kpiDespCompTopFornEl && !kpiDespCompCombEl) return;

  const a = metricAtual || {};
  const p = metricAnterior || {};

  // Total
  if (kpiDespCompTotalEl) {
    const deltaTxt = despFormatarDelta(a.total, p.total, true, 2);
    kpiDespCompTotalEl.textContent = `${formatarMoedaBR(a.total)} • ${deltaTxt}`;
  }

  // Matéria-prima
  if (kpiDespCompMpEl) {
    const deltaTxt = despFormatarDelta(a.totalMp, p.totalMp, true, 2);
    kpiDespCompMpEl.textContent = `${formatarMoedaBR(a.totalMp)} • ${deltaTxt}`;
  }

  // Embalagens
  if (kpiDespCompEmbEl) {
    const deltaTxt = despFormatarDelta(a.totalEmb, p.totalEmb, true, 2);
    kpiDespCompEmbEl.textContent = `${formatarMoedaBR(a.totalEmb)} • ${deltaTxt}`;
  }

  // Fixas
  if (kpiDespCompFixasEl) {
    const deltaTxt = despFormatarDelta(a.totalFixas, p.totalFixas, true, 2);
    kpiDespCompFixasEl.textContent = `${formatarMoedaBR(a.totalFixas)} • ${deltaTxt}`;
  }

  // Nº de lançamentos
  if (kpiDespCompNumLancEl) {
    const deltaTxt = despFormatarDelta(a.numLanc, p.numLanc, false, 0);
    kpiDespCompNumLancEl.textContent = `${String(a.numLanc || 0)} • ${deltaTxt}`;
  }

  // Fornecedor com maior gasto
  if (kpiDespCompTopFornEl) {
    if (!a.topFornNome || a.topFornNome === "—" || !isFinite(Number(a.topFornValor)) || a.topFornValor <= 0) {
      kpiDespCompTopFornEl.textContent = "—";
    } else {
      const prevValorMesmoForn = Number((p.gastoPorFornecedor || {})[a.topFornNome] || 0);
      const deltaTxt = despFormatarDelta(a.topFornValor, prevValorMesmoForn, true, 2);
      kpiDespCompTopFornEl.textContent = `${a.topFornNome}: ${formatarMoedaBR(a.topFornValor)} • ${deltaTxt}`;
    }
  }

  // Combustível
  if (kpiDespCompCombEl) {
    const deltaTxt = despFormatarDelta(a.totalComb, p.totalComb, true, 2);
    kpiDespCompCombEl.textContent = `${formatarMoedaBR(a.totalComb)} • ${deltaTxt}`;
  }
}

function atualizarResumoDespesas(dados) {
  atualizarIndicadoresDespesas(dados);
  atualizarResumosTabelaDespesas(dados);
  atualizarGraficosDespesas(dados);
}

function atualizarIndicadoresDespesas(dados) {
  const lista = Array.isArray(dados) ? dados : [];

  let total = 0;
  let totalMp = 0;
  let totalEmb = 0;
  let totalFixas = 0;
  let totalComb = 0;
  const gastoPorFornecedor = {};

  lista.forEach((d) => {
    const v = Number(d.valorTotal || 0);
    if (!isNaN(v)) {
      total += v;
    }

    const grupoKey = despKpiKey(despObterGrupoKpi(d));
    if (grupoKey === "materia-prima") totalMp += v;
    if (grupoKey === "embalagens") totalEmb += v;
    if (grupoKey === "despesas fixas") totalFixas += v;
    if (grupoKey === "combustivel") totalComb += v;

    const fornNome = (d.fornecedorNome || "—").trim();
    if (!gastoPorFornecedor[fornNome]) {
      gastoPorFornecedor[fornNome] = 0;
    }
    gastoPorFornecedor[fornNome] += v;
  });

  const numLanc = lista.length;

  let topFornNome = "—";
  let topFornValor = 0;
  Object.entries(gastoPorFornecedor).forEach(([nome, valor]) => {
    if (valor > topFornValor) {
      topFornValor = valor;
      topFornNome = nome;
    }
  });

  if (kpiDespTotalEl) kpiDespTotalEl.textContent = formatarMoedaBR(total);
  if (kpiDespMpEl) kpiDespMpEl.textContent = formatarMoedaBR(totalMp);
  if (kpiDespEmbEl) kpiDespEmbEl.textContent = formatarMoedaBR(totalEmb);
  if (kpiDespFixasEl) kpiDespFixasEl.textContent = formatarMoedaBR(totalFixas);
  if (kpiDespNumLancEl) kpiDespNumLancEl.textContent = String(numLanc);
  if (kpiDespCombEl) kpiDespCombEl.textContent = formatarMoedaBR(totalComb);

  if (kpiDespTopFornEl) {
    if (topFornValor > 0) {
      kpiDespTopFornEl.textContent =
        `${topFornNome} (${formatarMoedaBR(topFornValor)})`;
    } else {
      kpiDespTopFornEl.textContent = "—";
    }
  }


  // ----------------------
  // KPIs de comparação (mesmas datas do mês anterior)
  // ----------------------
  const periodoPrev = despObterPeriodoAnteriorEquivalente(
    despFilterStartInput?.value || "",
    despFilterEndInput?.value || ""
  );

  if (periodoPrev.prevStart && periodoPrev.prevEnd) {
    const listaPrev = despAplicarFiltrosEmMemoriaPeriodo(
      periodoPrev.prevStart,
      periodoPrev.prevEnd
    );

    const metricAtual = {
      total,
      totalMp,
      totalEmb,
      totalFixas,
      totalComb,
      numLanc,
      gastoPorFornecedor,
      topFornNome,
      topFornValor,
      topFornShare: total > 0 ? (topFornValor / total) * 100 : 0,
    };

    const metricAnterior = despCalcularMetricasComparacao(listaPrev);
    despAtualizarKPIsComparacao(metricAtual, metricAnterior);
  } else {
    despLimparKPIsComparacao();
  }

}

function atualizarResumosTabelaDespesas(dados) {
  const lista = Array.isArray(dados) ? dados : [];

  if (kpiDespCategoriasTbody) kpiDespCategoriasTbody.innerHTML = "";
  if (kpiDespFornecedoresTbody) kpiDespFornecedoresTbody.innerHTML = "";

  if (!lista.length) {
    if (kpiDespCategoriasTbody) {
      kpiDespCategoriasTbody.innerHTML =
        '<tr><td colspan="3">Sem dados.</td></tr>';
    }
    if (kpiDespFornecedoresTbody) {
      kpiDespFornecedoresTbody.innerHTML =
        '<tr><td colspan="3">Sem dados.</td></tr>';
    }
    return;
  }

  let total = 0;
  const porCategoria = {};
  const porFornecedor = {};

  lista.forEach((d) => {
    const v = Number(d.valorTotal || 0);
    if (isNaN(v)) return;
    total += v;

    const cat = (d.itemDespesaCategoria || "Sem categoria").trim() || "Sem categoria";
    if (!porCategoria[cat]) porCategoria[cat] = 0;
    porCategoria[cat] += v;

    const forn = (d.fornecedorNome || "—").trim();
    if (!porFornecedor[forn]) porFornecedor[forn] = 0;
    porFornecedor[forn] += v;
  });

  if (kpiDespCategoriasTbody) {
    const entriesCat = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1]);

    entriesCat.forEach(([cat, valor]) => {
      const perc = total > 0 ? (valor / total) * 100 : 0;
      const tr = document.createElement("tr");

      const tdCat = document.createElement("td");
      tdCat.textContent = cat;
      tr.appendChild(tdCat);

      const tdVal = document.createElement("td");
      tdVal.textContent = formatarMoedaBR(valor);
      tr.appendChild(tdVal);

      const tdPerc = document.createElement("td");
      tdPerc.textContent = formatarPercent(perc);
      tr.appendChild(tdPerc);

      kpiDespCategoriasTbody.appendChild(tr);
    });

    if (!entriesCat.length) {
      kpiDespCategoriasTbody.innerHTML =
        '<tr><td colspan="3">Sem dados.</td></tr>';
    }
  }

  if (kpiDespFornecedoresTbody) {
    const entriesForn = Object.entries(porFornecedor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    entriesForn.forEach(([forn, valor]) => {
      const perc = total > 0 ? (valor / total) * 100 : 0;
      const tr = document.createElement("tr");

      const tdForn = document.createElement("td");
      tdForn.textContent = forn;
      tr.appendChild(tdForn);

      const tdVal = document.createElement("td");
      tdVal.textContent = formatarMoedaBR(valor);
      tr.appendChild(tdVal);

      const tdPerc = document.createElement("td");
      tdPerc.textContent = formatarPercent(perc);
      tr.appendChild(tdPerc);

      kpiDespFornecedoresTbody.appendChild(tr);
    });

    if (!entriesForn.length) {
      kpiDespFornecedoresTbody.innerHTML =
        '<tr><td colspan="3">Sem dados.</td></tr>';
    }
  }
}

function atualizarGraficosDespesas(dados) {
  const lista = Array.isArray(dados) ? dados : [];

  const mensalCanvas = document.getElementById("chart-desp-mensal");
  const catCanvas = document.getElementById("chart-desp-categorias");
  const fornCanvas = document.getElementById("chart-desp-fornecedores");

  if (!mensalCanvas && !catCanvas && !fornCanvas) return;
  if (typeof Chart === "undefined") return;

  // ===== Helpers (datas locais) =====
  function parseISODateLocal(iso) {
    if (!iso) return null;
    const s = String(iso).slice(0, 10);
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  function isoFromDateLocal(d) {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  function ymFromDateLocal(d) {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  function addDays(d, n) {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  function monthsBetween(startDate, endDate) {
    const out = [];
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cur.getTime() <= end.getTime()) {
      out.push(new Date(cur.getTime()));
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }

  // ===== Agregações =====
  let total = 0;
  const porCategoria = {};
  const porFornecedor = {};

  // Para o gráfico de linha (diário ou mensal)
  const porDia = {};
  const porMes = {};

  // Range preferencial: o período do filtro (porque quando o usuário filtra,
  // ele quer que TUDO siga esse período)
  const startIso = despFilterStartInput?.value || "";
  const endIso = despFilterEndInput?.value || "";

  let rangeStart = parseISODateLocal(startIso);
  let rangeEnd = parseISODateLocal(endIso);

  // fallback: se por algum motivo não tiver filtro preenchido,
  // usa o min/max dos dados
  if (!rangeStart || !rangeEnd) {
    let minTs = null;
    let maxTs = null;
    lista.forEach((d) => {
      const ts = Number(d.dataPagamentoTimestamp || 0);
      if (!ts) return;
      if (minTs === null || ts < minTs) minTs = ts;
      if (maxTs === null || ts > maxTs) maxTs = ts;
    });
    if (minTs != null && maxTs != null) {
      rangeStart = new Date(minTs);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(maxTs);
      rangeEnd.setHours(0, 0, 0, 0);
    }
  }

  // normaliza range
  if (rangeStart) rangeStart.setHours(0, 0, 0, 0);
  if (rangeEnd) rangeEnd.setHours(0, 0, 0, 0);

  // Se range inválido, não desenha linha
  const hasRange = !!(rangeStart && rangeEnd && rangeEnd.getTime() >= rangeStart.getTime());
  const rangeDays =
    hasRange ? Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1 : 0;

  // Heurística:
  // - até 45 dias => mostra diário (fica legível)
  // - acima disso => agrupa por mês
  const useDaily = hasRange && rangeDays <= 45;

  lista.forEach((d) => {
    const v = Number(d.valorTotal || 0);
    if (!isNaN(v)) {
      total += v;
    }

    const cat =
      (d.itemDespesaCategoria || "Sem categoria").trim() || "Sem categoria";
    if (!porCategoria[cat]) porCategoria[cat] = 0;
    porCategoria[cat] += v;

    const forn = (d.fornecedorNome || "—").trim();
    if (!porFornecedor[forn]) porFornecedor[forn] = 0;
    porFornecedor[forn] += v;

    // data da despesa
    let dt = null;
    if (d.dataPagamento) {
      dt = parseISODateLocal(d.dataPagamento);
    }
    if (!dt && d.dataPagamentoTimestamp) {
      const x = new Date(Number(d.dataPagamentoTimestamp));
      if (!isNaN(x.getTime())) dt = x;
    }
    if (!dt) return;

    dt.setHours(0, 0, 0, 0);

    if (useDaily) {
      const key = isoFromDateLocal(dt); // YYYY-MM-DD
      if (!porDia[key]) porDia[key] = 0;
      porDia[key] += v;
    } else {
      const key = ymFromDateLocal(dt); // YYYY-MM
      if (!porMes[key]) porMes[key] = 0;
      porMes[key] += v;
    }
  });

  // ===== Gráfico de linha (mensal/diário) =====
  if (mensalCanvas) {
    if (!hasRange) {
      if (chartDespMensal) {
        chartDespMensal.destroy();
        chartDespMensal = null;
      }
      const ctx = mensalCanvas.getContext("2d");
      ctx && ctx.clearRect(0, 0, mensalCanvas.width, mensalCanvas.height);
    } else {
      // gera labels/valores preenchendo lacunas
      let labels = [];
      let valores = [];

      if (useDaily) {
        const keys = [];
        for (let i = 0; i < rangeDays; i++) {
          const d = addDays(rangeStart, i);
          keys.push(isoFromDateLocal(d));
        }
        labels = keys.map((iso) => {
          const dd = iso.slice(8, 10);
          const mm = iso.slice(5, 7);
          return `${dd}/${mm}`;
        });
        valores = keys.map((k) => Number(porDia[k] || 0));
      } else {
        const meses = monthsBetween(rangeStart, rangeEnd);
        const keys = meses.map((d) => ymFromDateLocal(d));
        labels = keys.map((ym) => {
          const [ano, mes] = ym.split("-");
          return `${mes}/${ano}`;
        });
        valores = keys.map((k) => Number(porMes[k] || 0));
      }

      // recria se mudou o "modo" (diário x mensal)
      const newMode = useDaily ? "daily" : "monthly";
      if (chartDespMensal && chartDespMensal.__cg_mode !== newMode) {
        chartDespMensal.destroy();
        chartDespMensal = null;
      }

      if (labels.length) {
        if (chartDespMensal) {
          chartDespMensal.data.labels = labels;
          chartDespMensal.data.datasets[0].data = valores;
          chartDespMensal.update();
        } else {
          const ctxMes = mensalCanvas.getContext("2d");
          chartDespMensal = new Chart(ctxMes, {
            type: "line",
            data: {
              labels,
              datasets: [
                {
                  label: "Gastos (R$)",
                  data: valores,
                  fill: false,
                  tension: 0.2
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function (context) {
                      const v = Number(context.parsed?.y || 0);
                      return `${formatarMoedaBR(v)}`;
                    }
                  }
                }
              },
              scales: {
                y: { beginAtZero: true }
              }
            }
          });
          chartDespMensal.__cg_mode = newMode;
        }
      } else {
        if (chartDespMensal) {
          chartDespMensal.destroy();
          chartDespMensal = null;
        }
        const ctx = mensalCanvas.getContext("2d");
        ctx && ctx.clearRect(0, 0, mensalCanvas.width, mensalCanvas.height);
      }
    }
  }

  // ===== Pizza por categoria =====
  if (catCanvas) {
    const ctxCat = catCanvas.getContext("2d");

    if (chartDespCategorias) {
      chartDespCategorias.destroy();
      chartDespCategorias = null;
    }

    const entriesCat = Object.keys(porCategoria || {})
      .map((cat) => ({ categoria: cat, valor: porCategoria[cat] || 0 }))
      .filter((e) => Number(e.valor) > 0)
      .sort((a, b) => b.valor - a.valor);

    if (entriesCat.length && total > 0) {
      const labelsCat = entriesCat.map((e) => e.categoria);
      const valoresCat = entriesCat.map((e) => e.valor);

      const baseColors = [
        "#ff6384",
        "#36a2eb",
        "#ffcd56",
        "#4bc0c0",
        "#9966ff",
        "#ff9f40",
        "#8dd17e",
        "#ff6f91"
      ];
      const cores = labelsCat.map((_, i) => baseColors[i % baseColors.length]);

      chartDespCategorias = new Chart(ctxCat, {
        type: "pie",
        data: {
          labels: labelsCat,
          datasets: [
            {
              data: valoresCat,
              backgroundColor: cores,
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const v = Number(context.parsed || 0);
                  const perc = total > 0 ? (v / total) * 100 : 0;
                  return `${context.label}: ${formatarMoedaBR(v)} (${formatarPercent(perc)})`;
                }
              }
            },
            pieCallout: {
              color: "#666",
              lineWidth: 1,
              font: "12px Arial",
              textColor: "#333",
              labelOffset: 6,
              extraRadius: 18
            }
          }
        }
      });
    } else {
      catCanvas.getContext("2d").clearRect(0, 0, catCanvas.width, catCanvas.height);
    }
  }

  // ===== Barras Top 5 fornecedores (mantido) =====
  if (fornCanvas) {
    const ctxForn = fornCanvas.getContext("2d");

    if (chartDespFornecedores) {
      chartDespFornecedores.destroy();
      chartDespFornecedores = null;
    }

    const entriesForn = Object.entries(porFornecedor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const labelsForn = entriesForn.map(([nome]) => nome);
    const valoresForn = entriesForn.map(([, valor]) => valor);

    if (labelsForn.length && total > 0) {
      chartDespFornecedores = new Chart(ctxForn, {
        type: "bar",
        data: {
          labels: labelsForn,
          datasets: [{ data: valoresForn }]
        },
        options: {
          // Barras verticais (mesmo estilo do gráfico do Extrato/Relatório)
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const v = Number(context.parsed?.y || 0);
                  const perc = total > 0 ? (v / total) * 100 : 0;
                  return `${formatarMoedaBR(v)} (${formatarPercent(perc)})`;
                }
              }
            }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    } else {
      fornCanvas.getContext("2d").clearRect(0, 0, fornCanvas.width, fornCanvas.height);
    }
  }
}

// ----------------------
// Salvar / excluir despesas
// ----------------------
async function salvarDespesa() {
  if (!despFornecedorSelect || !db) return;

  const user = auth?.currentUser;
  if (!user) {
    if (despMessage) {
      despMessage.textContent = "Você precisa estar logado para salvar.";
      despMessage.className = "msg error";
    }
    return;
  }

  const fornecedorId = despFornecedorSelect.value;
  const itemId       = despItemSelect?.value || "";
  const quantidade   = Number(despQtdInput?.value || 0);
  const descricao    = (despDescInput?.value || "").trim();
  const marca        = (despMarcaInput?.value || "").trim();
  const dataPag      = despDataInput?.value || "";
  // Data que representa a entrada física no estoque (para CMV). Se não informar, assume a data de pagamento.
  const dataEntrada  = (despDataEntradaInput?.value || "").trim() || dataPag;
  const valorUnit    = Number(despValorUnitInput?.value || 0);
  const valorTotal   = Number(despValorTotalInput?.value || 0);
  const formaId      = despFormaSelect?.value || "";

  if (despMessage) {
    despMessage.textContent = "";
    despMessage.className = "msg";
  }

  if (
    !fornecedorId ||
    !descricao ||
    !dataPag ||
    quantidade <= 0 ||
    valorUnit <= 0 ||
    valorTotal <= 0 ||
    !formaId
  ) {
    if (despMessage) {
      despMessage.textContent =
        "Preencha fornecedor, quantidade, descrição, data, valores e forma de pagamento.";
      despMessage.className = "msg error";
    }
    return;
  }

  const fornecedor = fornecedoresMap[fornecedorId] || {};
  const fornecedorNome = fornecedor.nome || "";

  const forma = typeof formasMap !== "undefined"
    ? (formasMap[formaId] || {})
    : {};
  const formaDescricao = forma.descricao || "";

  let itemInfo = null;
  if (itemId && itemId !== "OUTRO" && itensDespesasMap[itemId]) {
    itemInfo = itensDespesasMap[itemId];
  }

  try {
    const dataTimestamp = new Date(dataPag).getTime();
    const dataEntradaTimestamp = dataEntrada ? new Date(dataEntrada).getTime() : null;

    const itemGrupo = itemInfo
      ? (itemInfo.categoriaGrupo || (categoriasDespesasMapByNome[itemInfo.categoria]?.grupoKpi) || itemInfo.categoria || null)
      : null;

    const deveGerarEstoque = !!(itemInfo && despesaDeveGerarEstoqueInsumos(itemGrupo));
    const estoqueInsumoDocId = deveGerarEstoque ? `${itemInfo.id}__SEMLOTE` : null;

    const despRef = db.collection("despesas").doc();
    const estoqueRef = deveGerarEstoque
      ? db.collection("estoqueInsumos").doc(estoqueInsumoDocId)
      : null;

    await db.runTransaction(async (tx) => {
      // ⚠️ Firestore Transactions: TODOS os READs precisam acontecer ANTES dos WRITEs.
      // Como a integração com estoque exige um tx.get(estoqueRef), fazemos a leitura
      // primeiro (quando aplicável) e só depois executamos os tx.set.

      // 1) Se for compra de insumo, lê o estoque atual primeiro (READ)
      let estAtual = null;
      if (deveGerarEstoque && estoqueRef) {
        const estSnap = await tx.get(estoqueRef);
        estAtual = estSnap.exists ? (estSnap.data() || {}) : {};
      }

      // 2) Se for compra de insumo, atualiza o estoque (WRITE)
      if (deveGerarEstoque && estoqueRef) {
        const qtdAtual = Number(estAtual?.quantidade || 0);
        const custoAtual = Number(estAtual?.custoMedio || 0);

        const qtdNova = qtdAtual + quantidade;
        const custoNovo = qtdNova > 0
          ? ((qtdAtual * custoAtual) + (quantidade * valorUnit)) / qtdNova
          : valorUnit;

        tx.set(estoqueRef, {
          itemId: itemInfo.id,
          itemDescricao: itemInfo.descricao || descricao,
          unidade: itemInfo.unidade || "",
          categoria: itemInfo.categoria || "",
          grupo: itemGrupo || "",
          lote: "",
          dataValidade: "",
          codigoBarras: itemInfo.codigoBarras || "",
          quantidade: qtdNova,
          custoMedio: Number.isFinite(custoNovo) ? custoNovo : valorUnit,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          ultimaEntradaEm: firebase.firestore.FieldValue.serverTimestamp(),
          // Para relatórios/CMV: data da entrada física no estoque
          ultimaEntradaData: dataEntrada,
          ultimaEntradaDataTimestamp: Number.isFinite(dataEntradaTimestamp) ? dataEntradaTimestamp : null,
          ultimoCustoUnit: valorUnit,
        }, { merge: true });
      }

      // 3) salva a despesa (WRITE)
      tx.set(despRef, {
        usuarioId: user.uid,
        fornecedorId,
        fornecedorNome,
        quantidade,
        descricaoItem: descricao,
        marca,
        dataPagamento: dataPag,
        dataPagamentoTimestamp: dataTimestamp,
        // Para CMV/estoque: data real de entrada do item no estoque
        dataEntradaEstoque: dataEntrada,
        dataEntradaEstoqueTimestamp: Number.isFinite(dataEntradaTimestamp) ? dataEntradaTimestamp : null,
        valorUnitario: valorUnit,
        valorTotal,
        formaId,
        formaDescricao,
        itemDespesaId: itemInfo ? itemInfo.id : null,
        itemDespesaDescricao: itemInfo ? itemInfo.descricao : null,
        itemDespesaCategoria: itemInfo ? itemInfo.categoria : null,
        itemDespesaGrupo: itemGrupo,
        itemDespesaUnidade: itemInfo ? itemInfo.unidade : null,
        itemDespesaCodBarras: itemInfo ? itemInfo.codigoBarras : null,

        // integração com estoque de insumos
        gerouEstoqueInsumo: deveGerarEstoque,
        estoqueInsumoDocId: estoqueInsumoDocId,
        estoqueInsumoDeltaQtd: deveGerarEstoque ? quantidade : null,
        estoqueInsumoCustoUnitEntrada: deveGerarEstoque ? valorUnit : null,

        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });

    if (despMessage) {
      despMessage.textContent = "Despesa salva com sucesso!";
      despMessage.className = "msg ok";
    }

    despFornecedorSelect.value = "";
    if (despItemSelect) despItemSelect.value = "";
    if (despQtdInput) despQtdInput.value = "1";
    if (despDescInput) {
      despDescInput.value = "";
      despDescInput.readOnly = false;
    }
    if (despMarcaInput) despMarcaInput.value = "";
    if (despDataInput) despDataInput.value = "";
    if (despDataEntradaInput) despDataEntradaInput.value = "";
    if (despValorUnitInput) despValorUnitInput.value = "";
    if (despValorTotalInput) despValorTotalInput.value = "";
    if (despFormaSelect) despFormaSelect.value = "";

    await carregarDespesas();
  } catch (e) {
    console.error("Erro ao salvar despesa:", e);
    if (despMessage) {
      despMessage.textContent = "Erro ao salvar despesa.";
      despMessage.className = "msg error";
    }
  }
}

async function excluirDespesa(id) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir esta despesa?"
  );
  if (!confirmar) return;

  try {
    const despRef = db.collection("despesas").doc(id);
    const snap = await despRef.get();
    const dados = snap.exists ? (snap.data() || {}) : null;

    // Se essa despesa gerou movimento de estoque de insumos, reverte antes de excluir
    if (dados && dados.gerouEstoqueInsumo === true && dados.estoqueInsumoDocId) {
      const estoqueRef = db.collection("estoqueInsumos").doc(dados.estoqueInsumoDocId);
      const deltaReversao = -Number(dados.estoqueInsumoDeltaQtd || 0); // desfaz a entrada

      await db.runTransaction(async (tx) => {
        const estSnap = await tx.get(estoqueRef);
        const estAtual = estSnap.exists ? (estSnap.data() || {}) : {};
        const qtdAtual = Number(estAtual.quantidade || 0);
        const qtdNova = qtdAtual + deltaReversao;

        if (qtdNova <= 0) {
          if (estSnap.exists) tx.delete(estoqueRef);
        } else {
          tx.set(estoqueRef, {
            quantidade: qtdNova,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        tx.delete(despRef);
      });
    } else {
      await despRef.delete();
    }

    await carregarDespesas();
  } catch (e) {
    console.error("Erro ao excluir despesa:", e);
    alert("Erro ao excluir despesa.");
  }
}


// ====== SALVAR LANÇAMENTO (MÚLTIPLOS ITENS) ======
async function salvarLancamentoDespesas() {
  if (!db) return;

  const user = auth?.currentUser;
  if (!user) {
    if (despMessage) {
      despMessage.textContent = "Você precisa estar logado para salvar.";
      despMessage.className = "msg error";
    }
    return;
  }

  const fornecedorId = despFornecedorSelect?.value || "";
  const dataPag = despDataInput?.value || "";
  const dataEntrada = (despDataEntradaInput?.value || "").trim() || dataPag;
  const formaId = despFormaSelect?.value || "";

  if (!fornecedorId || !dataPag || !formaId) {
    if (despMessage) {
      despMessage.textContent = "Preencha fornecedor, data de pagamento e forma de pagamento.";
      despMessage.className = "msg error";
    }
    return;
  }

  if (!itensLancamentoDespesa.length) {
    if (despMessage) {
      despMessage.textContent = "Adicione pelo menos um item antes de salvar.";
      despMessage.className = "msg error";
    }
    return;
  }

  const fornecedor = fornecedoresMap[fornecedorId] || {};
  const fornecedorNome = fornecedor.nome || "";

  const forma = typeof formasMap !== "undefined"
    ? (formasMap[formaId] || {})
    : {};
  const formaDescricao = forma.descricao || "";

  const dataTimestamp = new Date(dataPag).getTime();
  const dataEntradaTimestamp = dataEntrada ? new Date(dataEntrada).getTime() : null;

  if (despMessage) {
    despMessage.textContent = "";
    despMessage.className = "msg";
  }

  try {
    for (const it of itensLancamentoDespesa) {
      const itemId = it.itemId || "";
      const quantidade = Number(it.quantidade || 0);
      const descricao = (it.descricao || "").trim();
      const marca = (it.marca || "").trim();
      const valorUnit = Number(it.valorUnitario || 0);
      const valorTotal = Number(it.valorTotal || (quantidade * valorUnit));

      if (!descricao || quantidade <= 0 || valorUnit <= 0 || valorTotal <= 0) continue;

      let itemInfo = null;
      if (itemId && itemId !== "OUTRO" && itensDespesasMap && itensDespesasMap[itemId]) {
        itemInfo = itensDespesasMap[itemId];
      }

      const itemGrupo = itemInfo
        ? (itemInfo.categoriaGrupo || (categoriasDespesasMapByNome[itemInfo.categoria]?.grupoKpi) || itemInfo.categoria || null)
        : null;

      const deveGerarEstoque = !!(itemInfo && despesaDeveGerarEstoqueInsumos(itemGrupo));
      const estoqueInsumoDocId = deveGerarEstoque ? `${itemInfo.id}__SEMLOTE` : null;

      const despRef = db.collection("despesas").doc();
      const estoqueRef = deveGerarEstoque
        ? db.collection("estoqueInsumos").doc(estoqueInsumoDocId)
        : null;

      await db.runTransaction(async (tx) => {
        // READ estoque (se necessário)
        let estAtual = null;
        if (deveGerarEstoque && estoqueRef) {
          const estSnap = await tx.get(estoqueRef);
          estAtual = estSnap.exists ? (estSnap.data() || {}) : {};
        }

        // WRITE estoque (se necessário)
        if (deveGerarEstoque && estoqueRef) {
          const qtdAtual = Number(estAtual?.quantidade || 0);
          const custoAtual = Number(estAtual?.custoMedio || 0);

          const qtdNova = qtdAtual + quantidade;
          const custoNovo = qtdNova > 0
            ? ((qtdAtual * custoAtual) + (quantidade * valorUnit)) / qtdNova
            : valorUnit;

          tx.set(estoqueRef, {
            itemId: itemInfo.id,
            itemDescricao: itemInfo.descricao || descricao,
            unidade: itemInfo.unidade || "",
            categoria: itemInfo.categoria || "",
            grupo: itemGrupo || "",
            lote: "",
            dataValidade: "",
            codigoBarras: itemInfo.codigoBarras || "",
            quantidade: qtdNova,
            custoMedio: Number.isFinite(custoNovo) ? custoNovo : valorUnit,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            ultimaEntradaEm: firebase.firestore.FieldValue.serverTimestamp(),
            ultimaEntradaData: dataEntrada,
            ultimaEntradaDataTimestamp: Number.isFinite(dataEntradaTimestamp) ? dataEntradaTimestamp : null,
            ultimoCustoUnit: valorUnit,
          }, { merge: true });
        }

        // WRITE despesa
        tx.set(despRef, {
          usuarioId: user.uid,
          fornecedorId,
          fornecedorNome,
          quantidade,
          descricaoItem: descricao,
          marca,
          dataPagamento: dataPag,
          dataPagamentoTimestamp: Number.isFinite(dataTimestamp) ? dataTimestamp : null,
          dataEntradaEstoque: dataEntrada,
          dataEntradaEstoqueTimestamp: Number.isFinite(dataEntradaTimestamp) ? dataEntradaTimestamp : null,
          valorUnitario: valorUnit,
          valorTotal,
          formaId,
          formaDescricao,
          itemDespesaId: itemInfo ? itemInfo.id : null,
          itemDespesaDescricao: itemInfo ? itemInfo.descricao : null,
          itemDespesaCategoria: itemInfo ? itemInfo.categoria : null,
          itemDespesaGrupo: itemGrupo,
          itemDespesaUnidade: itemInfo ? itemInfo.unidade : null,
          itemDespesaCodBarras: itemInfo ? itemInfo.codigoBarras : null,

          gerouEstoqueInsumo: deveGerarEstoque,
          estoqueInsumoDocId: estoqueInsumoDocId,
          estoqueInsumoDeltaQtd: deveGerarEstoque ? quantidade : null,
          estoqueInsumoCustoUnitEntrada: deveGerarEstoque ? valorUnit : null,

          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
    }

    if (despMessage) {
      despMessage.textContent = "Despesas salvas com sucesso!";
      despMessage.className = "msg ok";
    }

    // limpa tudo
    itensLancamentoDespesa = [];
    renderItensLancamentoDespesa();
    limparCamposItemDespesa();

    if (despFornecedorSelect) despFornecedorSelect.value = "";
    if (despDataInput) despDataInput.value = "";
    if (despDataEntradaInput) despDataEntradaInput.value = "";
    if (despFormaSelect) despFormaSelect.value = "";

    await carregarDespesas();
  } catch (e) {
    console.error("Erro ao salvar lançamento de despesas:", e);
    if (despMessage) {
      despMessage.textContent = "Erro ao salvar despesas.";
      despMessage.className = "msg error";
    }
  }
}



if (btnSaveDespesa) {
  btnSaveDespesa.addEventListener("click", salvarLancamentoDespesas);
}
