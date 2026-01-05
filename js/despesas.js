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
const btnDespExportCsv           = document.getElementById("btn-desp-export-csv");
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
    const marca = d.marca || "";
    const qtd = d.quantidade != null ? d.quantidade : "";
    const vUnit = d.valorUnitario != null ? numeroBR(d.valorUnitario) : "";
    const vTotal = d.valorTotal != null ? numeroBR(d.valorTotal) : "";
    const forma = d.formaDescricao || "";

    return [
      escapeCsvCell(data),
      escapeCsvCell(fornecedor),
      escapeCsvCell(descricao),
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
      '<tr><td colspan="9">Erro ao carregar despesas.</td></tr>';
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
    if (cat === "Matéria-prima" || cat === "Embalagens") {
      totalMpEmb += v;
    }

    if (cat === "Despesas fixas") {
      totalFixas += v;
    }

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
  if (kpiDespMpEmbEl) kpiDespMpEmbEl.textContent = formatarMoedaBR(totalMpEmb);
  if (kpiDespFixasEl) kpiDespFixasEl.textContent = formatarMoedaBR(totalFixas);
  if (kpiDespNumLancEl) kpiDespNumLancEl.textContent = String(numLanc);

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
          indexAxis: "y",
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const v = context.parsed.x || 0;
                  const perc = total > 0 ? (v / total) * 100 : 0;
                  return `${formatarMoedaBR(v)} (${formatarPercent(perc)})`;
                }
              }
            }
          },
          scales: {
            x: { beginAtZero: true }
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
