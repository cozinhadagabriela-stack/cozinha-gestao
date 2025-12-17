// js/despesas.js

// Map global de fornecedores
window.fornecedoresMap = window.fornecedoresMap || {};
let despesasCache = [];

// Itens de despesa (por fornecedor)
let itensDespesasCache = [];
let itensDespesasMap = {};
let itensPorFornecedorMap = {};

// Charts (despesas)
let chartDespCategorias = null;
let chartDespFornecedores = null;
// NOVO: linha mês a mês
let chartDespMensal = null;

// ----------------------
// Referências de fornecedores
// ----------------------
const fornNomeInput        = document.getElementById("forn-nome");
const btnSaveFornecedor    = document.getElementById("btn-save-fornecedor");
const fornMessage          = document.getElementById("forn-message");
const fornecedoresTbody    = document.getElementById("fornecedores-tbody");

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
const itemMessage           = document.getElementById("item-message");
const itensDespesaTbody     = document.getElementById("itens-despesas-tbody");

// ----------------------
// Referências da parte de despesas (lançamento)
// ----------------------
const despFornecedorSelect = document.getElementById("desp-fornecedor");
const despItemSelect       = document.getElementById("desp-item");
const despQtdInput         = document.getElementById("desp-quantidade");
const despDescInput        = document.getElementById("desp-descricao");
const despMarcaInput       = document.getElementById("desp-marca");
const despDataInput        = document.getElementById("desp-data");
const despValorUnitInput   = document.getElementById("desp-valor-unitario");
const despValorTotalInput  = document.getElementById("desp-valor-total");
const despFormaSelect      = document.getElementById("desp-forma-pagamento");
const btnSaveDespesa       = document.getElementById("btn-save-despesa");
const despMessage          = document.getElementById("desp-message");
const despesasTbody        = document.getElementById("despesas-tbody");

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
const despesasTotalLabel         = document.getElementById("despesas-total");

// ----------------------
// Referências dos KPIs / resumos de despesas
// ----------------------
const kpiDespTotalEl        = document.getElementById("kpi-desp-total");
const kpiDespMpEmbEl        = document.getElementById("kpi-desp-mp-emb");
const kpiDespFixasEl        = document.getElementById("kpi-desp-fixas");
const kpiDespNumLancEl      = document.getElementById("kpi-desp-num-lanc");
const kpiDespTopFornEl      = document.getElementById("kpi-desp-top-forn");

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

// Formata "aaaa-mm-dd" -> "dd/mm/aaaa"
function formatarDataBrasil(dataIso) {
  if (!dataIso) return "";
  const partes = dataIso.split("-");
  if (partes.length !== 3) return dataIso;
  const [ano, mes, dia] = partes;
  return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
}

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

// ----------------------
// Fornecedores
// ----------------------
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
    // select de fornecedor do cadastro de itens
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
    await db.collection("fornecedores").add({
      nome,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });

    fornNomeInput.value = "";
    if (fornMessage) {
      fornMessage.textContent = "Fornecedor salvo com sucesso!";
      fornMessage.className = "msg ok";
    }
    await carregarFornecedores();
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
    await carregarFornecedores();
  } catch (e) {
    console.error("Erro ao excluir fornecedor:", e);
    alert("Erro ao excluir fornecedor.");
  }
}

if (btnSaveFornecedor) {
  btnSaveFornecedor.addEventListener("click", salvarFornecedor);
}

// ----------------------
// Cadastro de itens de despesa
// ----------------------
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

        // Monta linha na tabela
        const tr = document.createElement("tr");

        const tdForn = document.createElement("td");
        tdForn.textContent = item.fornecedorNome;
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
        const btnExcluir = document.createElement("button");
        btnExcluir.textContent = "Excluir";
        btnExcluir.className = "btn-small btn-danger";
        btnExcluir.addEventListener("click", () => excluirItemDespesa(item.id));
        tdAcoes.appendChild(btnExcluir);
        tr.appendChild(tdAcoes);

        itensDespesaTbody.appendChild(tr);
      });
    }

    // Atualiza o select de itens no lançamento de despesas
    const fornecedorAtual = despFornecedorSelect?.value || "";
    if (fornecedorAtual) {
      atualizarSelectItensFornecedor(fornecedorAtual);
    } else if (despItemSelect) {
      despItemSelect.innerHTML =
        '<option value="">Selecione um item (opcional)</option>';
    }
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
    await db.collection("itensDespesas").add({
      fornecedorId,
      fornecedorNome,
      descricao,
      categoria,
      unidade,
      codigoBarras,
      precoPadrao:
        precoPadrao != null && !isNaN(precoPadrao) ? precoPadrao : null,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (itemMessage) {
      itemMessage.textContent = "Item salvo com sucesso!";
      itemMessage.className = "msg ok";
    }

    // Limpa campos
    itemDescricaoInput.value = "";
    if (itemCategoriaSelect) itemCategoriaSelect.value = "";
    itemUnidadeInput.value = "";
    itemCodBarrasInput.value = "";
    itemPrecoPadraoInput.value = "";

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
    await carregarItensDespesas();
  } catch (e) {
    console.error("Erro ao excluir item de despesa:", e);
    alert("Erro ao excluir item de despesa.");
  }
}

if (btnSaveItemDespesa) {
  btnSaveItemDespesa.addEventListener("click", salvarItemDespesa);
}

// Atualiza o select de itens no lançamento, conforme o fornecedor
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

// Quando trocar o fornecedor no lançamento, recarrega os itens
if (despFornecedorSelect) {
  despFornecedorSelect.addEventListener("change", () => {
    const fornecedorId = despFornecedorSelect.value || "";
    atualizarSelectItensFornecedor(fornecedorId);

    // Sempre que troca o fornecedor, reseta campos do item
    if (despItemSelect) despItemSelect.value = "";
    if (despDescInput) {
      despDescInput.value = "";
      despDescInput.readOnly = false;
    }
    if (despValorUnitInput) despValorUnitInput.value = "";
    atualizarTotalDespesa();
  });
}

// Quando escolher um item, preenche descrição e, se tiver, preço padrão
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
    '<tr><td colspan="9">Carregando...</td></tr>';
  despesasCache = [];

  try {
    let query = db
      .collection("despesas")
      .orderBy("dataPagamentoTimestamp", "desc")
      .limit(500);

    const snap = await query.get();

    if (snap.empty) {
      despesasTbody.innerHTML =
        '<tr><td colspan="9">Nenhuma despesa lançada.</td></tr>';
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

    // Ordenação do mais velho para o mais novo
    despesasCache.sort(
      (a, b) => (a.dataPagamentoTimestamp || 0) - (b.dataPagamentoTimestamp || 0)
    );

    renderizarDespesas(despesasCache);
    atualizarResumoDespesas(despesasCache);

    // Carrega/atualiza também os itens de despesa
    await carregarItensDespesas();
  } catch (e) {
    console.error("Erro ao carregar despesas:", e);
    despesasTbody.innerHTML =
      '<tr><td colspan="9">Erro ao carregar despesas.</td></tr>';
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

  if (!dados || dados.length === 0) {
    despesasTbody.innerHTML =
      '<tr><td colspan="9">Nenhuma despesa lançada.</td></tr>';
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
  if (!despesasCache || despesasCache.length === 0) {
    renderizarDespesas([]);
    atualizarResumoDespesas([]);
    return;
  }

  let filtradas = [...despesasCache];

  // Datas
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

  // Fornecedor
  const fornecedorFiltro = despFilterFornecedorSelect?.value || "";
  if (fornecedorFiltro) {
    filtradas = filtradas.filter((d) => d.fornecedorId === fornecedorFiltro);
  }

  // Descrição (contém)
  const descFiltro = (despFilterDescricaoInput?.value || "")
    .trim()
    .toLowerCase();
  if (descFiltro) {
    filtradas = filtradas.filter((d) =>
      (d.descricaoItem || "").toLowerCase().includes(descFiltro)
    );
  }

  // Marca (contém)
  const marcaFiltro = (despFilterMarcaInput?.value || "")
    .trim()
    .toLowerCase();
  if (marcaFiltro) {
    filtradas = filtradas.filter((d) =>
      (d.marca || "").toLowerCase().includes(marcaFiltro)
    );
  }

  // Ordena do mais velho para o mais novo
  filtradas.sort(
    (a, b) => (a.dataPagamentoTimestamp || 0) - (b.dataPagamentoTimestamp || 0)
  );

  renderizarDespesas(filtradas);
  atualizarResumoDespesas(filtradas);
}

function limparFiltrosDespesas() {
  if (despFilterStartInput) despFilterStartInput.value = "";
  if (despFilterEndInput) despFilterEndInput.value = "";
  if (despFilterFornecedorSelect) despFilterFornecedorSelect.value = "";
  if (despFilterDescricaoInput) despFilterDescricaoInput.value = "";
  if (despFilterMarcaInput) despFilterMarcaInput.value = "";

  renderizarDespesas(despesasCache);
  atualizarResumoDespesas(despesasCache);
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
function atualizarResumoDespesas(dados) {
  atualizarIndicadoresDespesas(dados);
  atualizarResumosTabelaDespesas(dados);
  atualizarGraficosDespesas(dados);
}

function atualizarIndicadoresDespesas(dados) {
  const lista = Array.isArray(dados) ? dados : [];

  let total = 0;
  let totalMpEmb = 0;
  let totalFixas = 0;
  const gastoPorFornecedor = {};

  lista.forEach((d) => {
    const v = Number(d.valorTotal || 0);
    if (!isNaN(v)) {
      total += v;
    }

    const cat = (d.itemDespesaCategoria || "").trim();
    // Matéria-prima + Embalagens
    if (cat === "Matéria-prima" || cat === "Embalagens") {
      totalMpEmb += v;
    }

    // Despesas fixas
    if (cat === "Despesas fixas") {
      totalFixas += v;
    }

    const fornNome = (d.fornecedorNome || "—").trim();
    if (!gastoPorFornecedor[fornNome]) {
      gastoPorFornecedor[fornNome] = 0;
    }
    gastoPorFornecedor[fornNome] += v;
  });

  // Número de lançamentos
  const numLanc = lista.length;

  // Fornecedor top
  let topFornNome = "—";
  let topFornValor = 0;
  Object.entries(gastoPorFornecedor).forEach(([nome, valor]) => {
    if (valor > topFornValor) {
      topFornValor = valor;
      topFornNome = nome;
    }
  });

  if (kpiDespTotalEl) {
    kpiDespTotalEl.textContent = formatarMoedaBR(total);
  }
  if (kpiDespMpEmbEl) {
    kpiDespMpEmbEl.textContent = formatarMoedaBR(totalMpEmb);
  }
  if (kpiDespFixasEl) {
    kpiDespFixasEl.textContent = formatarMoedaBR(totalFixas);
  }
  if (kpiDespNumLancEl) {
    kpiDespNumLancEl.textContent = String(numLanc);
  }
  if (kpiDespTopFornEl) {
    if (topFornValor > 0) {
      kpiDespTopFornEl.textContent =
        `${topFornNome} (${formatarMoedaBR(topFornValor)})`;
    } else {
      kpiDespTopFornEl.textContent = "—";
    }
  }
}

function atualizarResumosTabelaDespesas(dados) {
  const lista = Array.isArray(dados) ? dados : [];

  if (kpiDespCategoriasTbody) {
    kpiDespCategoriasTbody.innerHTML = "";
  }
  if (kpiDespFornecedoresTbody) {
    kpiDespFornecedoresTbody.innerHTML = "";
  }

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

  // Tabela por categoria
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

  // Tabela por fornecedor (top 10)
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

  let total = 0;
  const porCategoria = {};
  const porFornecedor = {};

  // NOVO: por mês (aaaa-mm)
  const porMes = {};

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

    // agrega mês
    let ym = "";
    if (d.dataPagamento && String(d.dataPagamento).length >= 7) {
      ym = String(d.dataPagamento).slice(0, 7); // "aaaa-mm"
    } else if (d.dataPagamentoTimestamp) {
      const dt = new Date(Number(d.dataPagamentoTimestamp));
      if (!isNaN(dt.getTime())) {
        const ano = dt.getFullYear();
        const mes = String(dt.getMonth() + 1).padStart(2, "0");
        ym = `${ano}-${mes}`;
      }
    }
    if (ym) {
      if (!porMes[ym]) porMes[ym] = 0;
      porMes[ym] += v;
    }
  });

  // ---- NOVO: Gráfico de linha mês a mês ----
  if (mensalCanvas) {
    if (chartDespMensal) {
      chartDespMensal.destroy();
      chartDespMensal = null;
    }

    const chavesMes = Object.keys(porMes).sort(); // 2025-01, 2025-02...

    if (chavesMes.length) {
      const labels = chavesMes.map((ym) => {
        const [ano, mes] = ym.split("-");
        return `${mes}/${ano}`;
      });
      const valores = chavesMes.map((ym) => porMes[ym]);

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
            y: {
              beginAtZero: true
            }
          }
        }
      });
    } else {
      const ctx = mensalCanvas.getContext("2d");
      ctx && ctx.clearRect(0, 0, mensalCanvas.width, mensalCanvas.height);
    }
  }

  // ---- Gráfico de pizza por categoria ----
  if (catCanvas) {
    const ctxCat = catCanvas.getContext("2d");

    if (chartDespCategorias) {
      chartDespCategorias.destroy();
      chartDespCategorias = null;
    }

    const labelsCat = Object.keys(porCategoria);
    const valoresCat = Object.values(porCategoria);

    if (labelsCat.length && total > 0) {
      chartDespCategorias = new Chart(ctxCat, {
        type: "doughnut",
        data: {
          labels: labelsCat,
          datasets: [
            {
              data: valoresCat,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "bottom",
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const v = context.parsed || 0;
                  const perc = total > 0 ? (v / total) * 100 : 0;
                  return `${context.label}: ${formatarMoedaBR(v)} (${formatarPercent(
                    perc
                  )})`;
                },
              },
            },
          },
        },
      });
    } else {
      catCanvas.getContext("2d").clearRect(0, 0, catCanvas.width, catCanvas.height);
    }
  }

  // ---- Gráfico de barras por fornecedor (Top 5) ----
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
          datasets: [
            {
              data: valoresForn,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const v = context.parsed.x || 0;
                  const perc = total > 0 ? (v / total) * 100 : 0;
                  return `${formatarMoedaBR(v)} (${formatarPercent(perc)})`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
            },
          },
        },
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

    await db.collection("despesas").add({
      usuarioId: user.uid,
      fornecedorId,
      fornecedorNome,
      quantidade,
      descricaoItem: descricao,
      marca,
      dataPagamento: dataPag,
      dataPagamentoTimestamp: dataTimestamp,
      valorUnitario: valorUnit,
      valorTotal,
      formaId,
      formaDescricao,
      // Ligação com item de despesa (se houver)
      itemDespesaId: itemInfo ? itemInfo.id : null,
      itemDespesaDescricao: itemInfo ? itemInfo.descricao : null,
      itemDespesaCategoria: itemInfo ? itemInfo.categoria : null,
      itemDespesaUnidade: itemInfo ? itemInfo.unidade : null,
      itemDespesaCodBarras: itemInfo ? itemInfo.codigoBarras : null,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (despMessage) {
      despMessage.textContent = "Despesa salva com sucesso!";
      despMessage.className = "msg ok";
    }

    // limpa campos
    despFornecedorSelect.value = "";
    if (despItemSelect) despItemSelect.value = "";
    if (despQtdInput) despQtdInput.value = "1";
    if (despDescInput) {
      despDescInput.value = "";
      despDescInput.readOnly = false;
    }
    if (despMarcaInput) despMarcaInput.value = "";
    if (despDataInput) despDataInput.value = "";
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
    await db.collection("despesas").doc(id).delete();
    await carregarDespesas();
  } catch (e) {
    console.error("Erro ao excluir despesa:", e);
    alert("Erro ao excluir despesa.");
  }
}

if (btnSaveDespesa) {
  btnSaveDespesa.addEventListener("click", salvarDespesa);
}
