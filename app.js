// ===== Referências da interface =====
const loginCard = document.getElementById("login-card");
const appCard = document.getElementById("app-card");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const loginButton = document.getElementById("btn-login");
const loginError = document.getElementById("login-error");
const loadingLabel = document.getElementById("loading");
const userEmailSpan = document.getElementById("user-email");
const logoutButton = document.getElementById("btn-logout");

// abas
const tabVenda = document.getElementById("tab-venda");
const tabExtrato = document.getElementById("tab-extrato");
const tabClientes = document.getElementById("tab-clientes");
const tabProdutos = document.getElementById("tab-produtos");
const tabFormas = document.getElementById("tab-formas");

const sectionVenda = document.getElementById("section-venda");
const sectionExtrato = document.getElementById("section-extrato");
const sectionClientes = document.getElementById("section-clientes");
const sectionProdutos = document.getElementById("section-produtos");
const sectionFormas = document.getElementById("section-formas");

// venda
const saleDateInput = document.getElementById("sale-date");
const saleLoteInput = document.getElementById("sale-lote");
const saleNfNumberInput = document.getElementById("sale-nf-number");
const saleNfSeriesInput = document.getElementById("sale-nf-series");
const saleClientSelect = document.getElementById("sale-client");
const saleProductSelect = document.getElementById("sale-product");
const saleQuantityInput = document.getElementById("sale-quantity");
const saleUnitPriceInput = document.getElementById("sale-unit-price");
const saleTotalInput = document.getElementById("sale-total");
const salePaymentSelect = document.getElementById("sale-payment");
const saveSaleButton = document.getElementById("btn-save-sale");
const saleMessage = document.getElementById("sale-message");

const salesTbody = document.getElementById("sales-tbody");
const salesTotalLabel = document.getElementById("sales-total");

// filtros
const filterStartInput = document.getElementById("filter-start");
const filterEndInput = document.getElementById("filter-end");
const filterClientSelect = document.getElementById("filter-client");
const filterProductSelect = document.getElementById("filter-product");
const filterFormaSelect = document.getElementById("filter-forma");
const applyFilterButton = document.getElementById("btn-apply-filters");
const clearFilterButton = document.getElementById("btn-clear-filters");
const exportCsvButton = document.getElementById("btn-export-csv");

// KPIs cards
const kpiTotalVendas = document.getElementById("kpi-total-vendas");
const kpiQtdVendida = document.getElementById("kpi-qtd-vendida");
const kpiNumVendas = document.getElementById("kpi-num-vendas");
const kpiTopCliente = document.getElementById("kpi-top-cliente");
const kpiTopProduto = document.getElementById("kpi-top-produto");
const kpiTopCidade = document.getElementById("kpi-top-cidade");

// Tabelas de detalhamento
const kpiProdutosBody = document.getElementById("kpi-produtos-body");
const kpiFormasBody = document.getElementById("kpi-formas-body");
const kpiCidadesBody = document.getElementById("kpi-cidades-body");

// clientes
const cliNomeInput = document.getElementById("cli-nome");
const cliCidadeInput = document.getElementById("cli-cidade");
const saveClienteButton = document.getElementById("btn-save-cliente");
const cancelClienteButton = document.getElementById("btn-cancel-cliente");
const cliMessage = document.getElementById("cli-message");
const clientesTbody = document.getElementById("clientes-tbody");

// produtos
const prodDescInput = document.getElementById("prod-desc");
const prodPesoInput = document.getElementById("prod-peso");
const prodPrecoInput = document.getElementById("prod-preco");
const saveProdutoButton = document.getElementById("btn-save-produto");
const cancelProdutoButton = document.getElementById("btn-cancel-produto");
const prodMessage = document.getElementById("prod-message");
const produtosTbody = document.getElementById("produtos-tbody");

// formas
const fpDescInput = document.getElementById("fp-desc");
const saveFormaButton = document.getElementById("btn-save-forma");
const cancelFormaButton = document.getElementById("btn-cancel-forma");
const fpMessage = document.getElementById("fp-message");
const formasTbody = document.getElementById("formas-tbody");

// Mapas em memória
const clientesMap = {};
const produtosMap = {};
const formasMap = {};

// Cache de últimas vendas
let ultimasVendasCache = [];

// Estados de edição
let editingClienteId = null;
let editingProdutoId = null;
let editingFormaId = null;

// ===== Funções auxiliares =====
function setActiveSection(section) {
  // esconde tudo
  sectionVenda.classList.add("hidden");
  sectionExtrato.classList.add("hidden");
  sectionClientes.classList.add("hidden");
  sectionProdutos.classList.add("hidden");
  sectionFormas.classList.add("hidden");

  // limpa abas
  tabVenda.classList.remove("active-tab");
  tabExtrato.classList.remove("active-tab");
  tabClientes.classList.remove("active-tab");
  tabProdutos.classList.remove("active-tab");
  tabFormas.classList.remove("active-tab");

  if (section === "venda") {
    sectionVenda.classList.remove("hidden");
    tabVenda.classList.add("active-tab");
  } else if (section === "extrato") {
    sectionExtrato.classList.remove("hidden");
    tabExtrato.classList.add("active-tab");
  } else if (section === "clientes") {
    sectionClientes.classList.remove("hidden");
    tabClientes.classList.add("active-tab");
  } else if (section === "produtos") {
    sectionProdutos.classList.remove("hidden");
    tabProdutos.classList.add("active-tab");
  } else if (section === "formas") {
    sectionFormas.classList.remove("hidden");
    tabFormas.classList.add("active-tab");
  }
}

function updateUI(user) {
  if (user) {
    loginCard.classList.add("hidden");
    appCard.classList.remove("hidden");
    logoutButton.style.display = "inline-block";
    userEmailSpan.textContent = user.email;

    if (!saleDateInput.value) {
      const hoje = new Date().toISOString().substring(0, 10);
      saleDateInput.value = hoje;
    }

    carregarClientes();
    carregarProdutos();
    carregarFormasPagamento();
    carregarUltimasVendas();
  } else {
    loginCard.classList.remove("hidden");
    appCard.classList.add("hidden");
    logoutButton.style.display = "none";
    userEmailSpan.textContent = "";
  }
}

// ===== RENDERIZAÇÃO TABELAS DE CADASTRO =====
function renderClientesTable() {
  if (!clientesTbody) return;
  clientesTbody.innerHTML = "";

  const entries = Object.entries(clientesMap).map(([id, data]) => ({
    id,
    nome: data.nome || "",
    cidade: data.cidade || ""
  })).sort((a, b) => a.nome.localeCompare(b.nome));

  if (entries.length === 0) {
    clientesTbody.innerHTML = '<tr><td colspan="3">Nenhum cliente cadastrado.</td></tr>';
    return;
  }

  entries.forEach(c => {
    const tr = document.createElement("tr");

    const tdNome = document.createElement("td");
    tdNome.textContent = c.nome;
    tr.appendChild(tdNome);

    const tdCidade = document.createElement("td");
    tdCidade.textContent = c.cidade;
    tr.appendChild(tdCidade);

    const tdAcoes = document.createElement("td");

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.className = "btn-small";
    btnEditar.addEventListener("click", () => iniciarEdicaoCliente(c.id));
    tdAcoes.appendChild(btnEditar);

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir";
    btnExcluir.className = "btn-small btn-danger";
    btnExcluir.addEventListener("click", () => excluirCliente(c.id));
    tdAcoes.appendChild(btnExcluir);

    tr.appendChild(tdAcoes);
    clientesTbody.appendChild(tr);
  });
}

function renderProdutosTable() {
  if (!produtosTbody) return;
  produtosTbody.innerHTML = "";

  const entries = Object.entries(produtosMap).map(([id, data]) => ({
    id,
    descricao: data.descricao || "",
    peso: data.pesoGramas || 0,
    preco: data.precoUnitario || 0
  })).sort((a, b) => a.descricao.localeCompare(b.descricao));

  if (entries.length === 0) {
    produtosTbody.innerHTML = '<tr><td colspan="4">Nenhum produto cadastrado.</td></tr>';
    return;
  }

  entries.forEach(p => {
    const tr = document.createElement("tr");

    const tdDesc = document.createElement("td");
    tdDesc.textContent = p.descricao;
    tr.appendChild(tdDesc);

    const tdPeso = document.createElement("td");
    tdPeso.textContent = p.peso ? p.peso : "";
    tr.appendChild(tdPeso);

    const tdPreco = document.createElement("td");
    tdPreco.textContent = p.preco ? p.preco.toFixed(2) : "";
    tr.appendChild(tdPreco);

    const tdAcoes = document.createElement("td");

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.className = "btn-small";
    btnEditar.addEventListener("click", () => iniciarEdicaoProduto(p.id));
    tdAcoes.appendChild(btnEditar);

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir";
    btnExcluir.className = "btn-small btn-danger";
    btnExcluir.addEventListener("click", () => excluirProduto(p.id));
    tdAcoes.appendChild(btnExcluir);

    tr.appendChild(tdAcoes);
    produtosTbody.appendChild(tr);
  });
}

function renderFormasTable() {
  if (!formasTbody) return;
  formasTbody.innerHTML = "";

  const entries = Object.entries(formasMap).map(([id, data]) => ({
    id,
    descricao: data.descricao || ""
  })).sort((a, b) => a.descricao.localeCompare(b.descricao));

  if (entries.length === 0) {
    formasTbody.innerHTML = '<tr><td colspan="2">Nenhuma forma cadastrada.</td></tr>';
    return;
  }

  entries.forEach(f => {
    const tr = document.createElement("tr");

    const tdDesc = document.createElement("td");
    tdDesc.textContent = f.descricao;
    tr.appendChild(tdDesc);

    const tdAcoes = document.createElement("td");

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.className = "btn-small";
    btnEditar.addEventListener("click", () => iniciarEdicaoForma(f.id));
    tdAcoes.appendChild(btnEditar);

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir";
    btnExcluir.className = "btn-small btn-danger";
    btnExcluir.addEventListener("click", () => excluirForma(f.id));
    tdAcoes.appendChild(btnExcluir);

    tr.appendChild(tdAcoes);
    formasTbody.appendChild(tr);
  });
}

// ===== Carregamento de cadastros =====
async function carregarClientes() {
  try {
    saleClientSelect.innerHTML = '<option value="">Selecione um cliente</option>';
    filterClientSelect.innerHTML = '<option value="">Todos os clientes</option>';

    Object.keys(clientesMap).forEach(id => delete clientesMap[id]);

    const snapshot = await db.collection("clientes").orderBy("nome").get();
    snapshot.forEach(doc => {
      const data = doc.data();
      clientesMap[doc.id] = data;

      const opt1 = document.createElement("option");
      opt1.value = doc.id;
      opt1.textContent = data.nome || "(sem nome)";
      saleClientSelect.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = doc.id;
      opt2.textContent = data.nome || "(sem nome)";
      filterClientSelect.appendChild(opt2);
    });

    if (snapshot.empty) {
      saleClientSelect.innerHTML = '<option value="">Nenhum cliente cadastrado</option>';
      filterClientSelect.innerHTML = '<option value="">Nenhum cliente cadastrado</option>';
    }

    renderClientesTable();
  } catch (e) {
    console.error("Erro ao carregar clientes:", e);
    saleClientSelect.innerHTML = '<option value="">Erro ao carregar clientes</option>';
    filterClientSelect.innerHTML = '<option value="">Erro ao carregar clientes</option>';
    clientesTbody.innerHTML = '<tr><td colspan="3">Erro ao carregar clientes.</td></tr>';
  }
}

async function carregarProdutos() {
  try {
    saleProductSelect.innerHTML = '<option value="">Selecione um produto</option>';
    filterProductSelect.innerHTML = '<option value="">Todos os produtos</option>';
    Object.keys(produtosMap).forEach(id => delete produtosMap[id]);

    const snapshot = await db.collection("produtos").orderBy("descricao").get();
    snapshot.forEach(doc => {
      const data = doc.data();
      produtosMap[doc.id] = data;

      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.textContent = data.descricao || "(sem descrição)";
      saleProductSelect.appendChild(opt);

      const opt2 = document.createElement("option");
      opt2.value = doc.id;
      opt2.textContent = data.descricao || "(sem descrição)";
      filterProductSelect.appendChild(opt2);
    });

    if (snapshot.empty) {
      saleProductSelect.innerHTML = '<option value="">Nenhum produto cadastrado</option>';
      filterProductSelect.innerHTML = '<option value="">Nenhum produto cadastrado</option>';
    }

    renderProdutosTable();
  } catch (e) {
    console.error("Erro ao carregar produtos:", e);
    saleProductSelect.innerHTML = '<option value="">Erro ao carregar produtos</option>';
    filterProductSelect.innerHTML = '<option value="">Erro ao carregar produtos</option>';
    produtosTbody.innerHTML = '<tr><td colspan="4">Erro ao carregar produtos.</td></tr>';
  }
}

async function carregarFormasPagamento() {
  try {
    salePaymentSelect.innerHTML = '<option value="">Selecione a forma de pagamento</option>';
    filterFormaSelect.innerHTML = '<option value="">Todas as formas</option>';

    Object.keys(formasMap).forEach(id => delete formasMap[id]);

    const snapshot = await db.collection("formasPagamento").orderBy("descricao").get();
    snapshot.forEach(doc => {
      const data = doc.data();
      formasMap[doc.id] = data;

      const opt1 = document.createElement("option");
      opt1.value = doc.id;
      opt1.textContent = data.descricao || "(sem descrição)";
      salePaymentSelect.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = doc.id;
      opt2.textContent = data.descricao || "(sem descrição)";
      filterFormaSelect.appendChild(opt2);
    });

    if (snapshot.empty) {
      salePaymentSelect.innerHTML = '<option value="">Nenhuma forma cadastrada</option>';
      filterFormaSelect.innerHTML = '<option value="">Nenhuma forma cadastrada</option>';
    }

    renderFormasTable();
  } catch (e) {
    console.error("Erro ao carregar formas de pagamento:", e);
    salePaymentSelect.innerHTML = '<option value="">Erro ao carregar formas</option>';
    filterFormaSelect.innerHTML = '<option value="">Erro ao carregar formas</option>';
    formasTbody.innerHTML = '<tr><td colspan="2">Erro ao carregar formas de pagamento.</td></tr>';
  }
}

function atualizarTotal() {
  const qtd = Number(saleQuantityInput.value || 0);
  const unit = Number(saleUnitPriceInput.value || 0);
  if (qtd > 0 && unit >= 0) {
    saleTotalInput.value = (qtd * unit).toFixed(2);
  } else {
    saleTotalInput.value = "";
  }
}

async function carregarUltimasVendas() {
  salesTbody.innerHTML = '<tr><td colspan="11">Carregando...</td></tr>';
  salesTotalLabel.textContent = "";
  ultimasVendasCache = [];

  try {
    const snapshot = await db.collection("vendas")
      .orderBy("dataTimestamp", "desc")
      .limit(100)
      .get();

    if (snapshot.empty) {
      salesTbody.innerHTML = '<tr><td colspan="11">Nenhuma venda encontrada.</td></tr>';
      atualizarKPIsVazios();
      return;
    }

    snapshot.forEach(doc => {
      const v = doc.data();
      ultimasVendasCache.push({
        id: doc.id,
        ...v
      });
    });

    renderizarVendasFiltradas();
  } catch (e) {
    console.error("Erro ao carregar vendas:", e);
    salesTbody.innerHTML = '<tr><td colspan="11">Erro ao carregar vendas.</td></tr>';
    atualizarKPIsVazios();
  }
}

function atualizarKPIsVazios() {
  kpiTotalVendas.textContent = "R$ 0,00";
  kpiQtdVendida.textContent = "0";
  kpiNumVendas.textContent = "0";
  kpiTopCliente.textContent = "—";
  kpiTopProduto.textContent = "—";
  kpiTopCidade.textContent = "—";
  salesTotalLabel.textContent = "";
  kpiProdutosBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  kpiFormasBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  kpiCidadesBody.innerHTML = '<tr><td colspan="2">Sem dados.</td></tr>';
}

function atualizarTabelasDetalhe(mapaProdutoQtd, mapaProdutoValor, mapaFormaValor, mapaCidadeValor, totalValor) {
  // Produtos
  const prodEntries = Object.keys(mapaProdutoQtd).map(desc => ({
    desc,
    qtd: mapaProdutoQtd[desc],
    valor: mapaProdutoValor[desc] || 0
  })).sort((a, b) => b.qtd - a.qtd);

  if (prodEntries.length === 0) {
    kpiProdutosBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  } else {
    kpiProdutosBody.innerHTML = "";
    prodEntries.forEach(p => {
      const tr = document.createElement("tr");
      const tdDesc = document.createElement("td");
      tdDesc.textContent = p.desc;
      const tdQtd = document.createElement("td");
      tdQtd.textContent = p.qtd;
      const tdVal = document.createElement("td");
      tdVal.textContent = p.valor.toFixed(2);
      tr.appendChild(tdDesc);
      tr.appendChild(tdQtd);
      tr.appendChild(tdVal);
      kpiProdutosBody.appendChild(tr);
    });
  }

  // Formas de pagamento
  const formaEntries = Object.keys(mapaFormaValor).map(desc => {
    const valor = mapaFormaValor[desc] || 0;
    const perc = totalValor > 0 ? (valor / totalValor) * 100 : 0;
    return { desc, valor, perc };
  }).sort((a, b) => b.valor - a.valor);

  if (formaEntries.length === 0) {
    kpiFormasBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  } else {
    kpiFormasBody.innerHTML = "";
    formaEntries.forEach(f => {
      const tr = document.createElement("tr");
      const tdDesc = document.createElement("td");
      tdDesc.textContent = f.desc;
      const tdVal = document.createElement("td");
      tdVal.textContent = f.valor.toFixed(2);
      const tdPerc = document.createElement("td");
      tdPerc.textContent = f.perc.toFixed(1) + "%";
      tr.appendChild(tdDesc);
      tr.appendChild(tdVal);
      tr.appendChild(tdPerc);
      kpiFormasBody.appendChild(tr);
    });
  }

  // Cidades
  const cidadeEntries = Object.keys(mapaCidadeValor).map(cidade => ({
    cidade,
    valor: mapaCidadeValor[cidade] || 0
  })).sort((a, b) => b.valor - a.valor);

  if (cidadeEntries.length === 0) {
    kpiCidadesBody.innerHTML = '<tr><td colspan="2">Sem dados.</td></tr>';
  } else {
    kpiCidadesBody.innerHTML = "";
    cidadeEntries.forEach(c => {
      const tr = document.createElement("tr");
      const tdCidade = document.createElement("td");
      tdCidade.textContent = c.cidade;
      const tdVal = document.createElement("td");
      tdVal.textContent = c.valor.toFixed(2);
      tr.appendChild(tdCidade);
      tr.appendChild(tdVal);
      kpiCidadesBody.appendChild(tr);
    });
  }
}

function renderizarVendasFiltradas() {
  salesTbody.innerHTML = "";

  const start = filterStartInput.value;
  const end = filterEndInput.value;
  const clienteFiltro = filterClientSelect.value;
  const produtoFiltro = filterProductSelect.value;
  const formaFiltro = filterFormaSelect.value;

  let totalValor = 0;
  let totalQtd = 0;
  let count = 0;

  const mapaClienteValor = {};
  const mapaProdutoQtd = {};
  const mapaProdutoValor = {};
  const mapaFormaValor = {};
  const mapaCidadeValor = {};

  ultimasVendasCache.forEach(v => {
    if (start && v.data && v.data < start) return;
    if (end && v.data && v.data > end) return;
    if (clienteFiltro && v.clienteId !== clienteFiltro) return;
    if (produtoFiltro && v.produtoId !== produtoFiltro) return;
    if (formaFiltro && v.formaId !== formaFiltro) return;

    const tr = document.createElement("tr");

    const dataTd = document.createElement("td");
    dataTd.textContent = v.data || "";
    tr.appendChild(dataTd);

    const clienteTd = document.createElement("td");
    clienteTd.textContent = v.clienteNome || "";
    tr.appendChild(clienteTd);

    const produtoTd = document.createElement("td");
    produtoTd.textContent = v.produtoDescricao || "";
    tr.appendChild(produtoTd);

    const qtdNum = Number(v.quantidade || 0);
    const qtdTd = document.createElement("td");
    qtdTd.textContent = v.quantidade != null ? v.quantidade : "";
    tr.appendChild(qtdTd);

    const unitTd = document.createElement("td");
    if (v.valorUnitario != null) {
      unitTd.textContent = Number(v.valorUnitario).toFixed(2);
    } else {
      unitTd.textContent = "";
    }
    tr.appendChild(unitTd);

    const valorTotal = Number(v.valorTotal || 0);
    const totalTd = document.createElement("td");
    totalTd.textContent = valorTotal.toFixed(2);
    tr.appendChild(totalTd);

    const loteTd = document.createElement("td");
    loteTd.textContent = v.lote || "";
    tr.appendChild(loteTd);

    const nfTd = document.createElement("td");
    nfTd.textContent = v.numeroNota || "";
    tr.appendChild(nfTd);

    const serieTd = document.createElement("td");
    serieTd.textContent = v.serieNota || "";
    tr.appendChild(serieTd);

    const formaTd = document.createElement("td");
    formaTd.textContent = v.formaDescricao || "";
    tr.appendChild(formaTd);

    const acaoTd = document.createElement("td");
    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir";
    btnExcluir.className = "btn-small btn-danger";
    btnExcluir.addEventListener("click", () => {
      excluirVenda(v.id);
    });
    acaoTd.appendChild(btnExcluir);
    tr.appendChild(acaoTd);

    salesTbody.appendChild(tr);

    // Acumula para KPIs
    totalValor += valorTotal;
    totalQtd += qtdNum;
    count++;

    if (v.clienteNome) {
      mapaClienteValor[v.clienteNome] = (mapaClienteValor[v.clienteNome] || 0) + valorTotal;
    }
    if (v.produtoDescricao) {
      mapaProdutoQtd[v.produtoDescricao] = (mapaProdutoQtd[v.produtoDescricao] || 0) + qtdNum;
      mapaProdutoValor[v.produtoDescricao] = (mapaProdutoValor[v.produtoDescricao] || 0) + valorTotal;
    }
    if (v.formaDescricao) {
      mapaFormaValor[v.formaDescricao] = (mapaFormaValor[v.formaDescricao] || 0) + valorTotal;
    }

    const cidade = clientesMap[v.clienteId]?.cidade || "Sem cidade cadastrada";
    mapaCidadeValor[cidade] = (mapaCidadeValor[cidade] || 0) + valorTotal;
  });

  if (count === 0) {
    salesTbody.innerHTML = '<tr><td colspan="11">Nenhuma venda encontrada com esses filtros.</td></tr>';
    atualizarKPIsVazios();
  } else {
    salesTotalLabel.textContent = "Total dessas vendas: R$ " + totalValor.toFixed(2);

    kpiTotalVendas.textContent = "R$ " + totalValor.toFixed(2);
    kpiQtdVendida.textContent = String(totalQtd);
    kpiNumVendas.textContent = String(count);

    let topCliente = "—";
    let topClienteValor = 0;
    for (const nome in mapaClienteValor) {
      if (mapaClienteValor[nome] > topClienteValor) {
        topClienteValor = mapaClienteValor[nome];
        topCliente = nome;
      }
    }
    kpiTopCliente.textContent = topCliente === "—"
      ? "—"
      : `${topCliente} (R$ ${topClienteValor.toFixed(2)})`;

    let topProduto = "—";
    let topProdutoQtd = 0;
    for (const desc in mapaProdutoQtd) {
      if (mapaProdutoQtd[desc] > topProdutoQtd) {
        topProdutoQtd = mapaProdutoQtd[desc];
        topProduto = desc;
      }
    }
    kpiTopProduto.textContent = topProduto === "—"
      ? "—"
      : `${topProduto} (${topProdutoQtd} un.)`;

    let topCidade = "—";
    let topCidadeValor = 0;
    for (const cid in mapaCidadeValor) {
      if (mapaCidadeValor[cid] > topCidadeValor) {
        topCidadeValor = mapaCidadeValor[cid];
        topCidade = cid;
      }
    }
    kpiTopCidade.textContent = topCidade === "—"
      ? "—"
      : `${topCidade} (R$ ${topCidadeValor.toFixed(2)})`;

    atualizarTabelasDetalhe(
      mapaProdutoQtd,
      mapaProdutoValor,
      mapaFormaValor,
      mapaCidadeValor,
      totalValor
    );
  }
}

async function excluirVenda(vendaId) {
  const confirmar = window.confirm("Tem certeza que deseja excluir esta venda?");
  if (!confirmar) return;

  try {
    await db.collection("vendas").doc(vendaId).delete();
    await carregarUltimasVendas();
  } catch (e) {
    console.error("Erro ao excluir venda:", e);
    alert("Erro ao excluir venda.");
  }
}

// ===== Funções CSV =====
function csvValue(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function aplicarFiltrosEmMemoria() {
  const start = filterStartInput.value;
  const end = filterEndInput.value;
  const clienteFiltro = filterClientSelect.value;
  const produtoFiltro = filterProductSelect.value;
  const formaFiltro = filterFormaSelect.value;

  return ultimasVendasCache.filter(v => {
    if (start && v.data && v.data < start) return false;
    if (end && v.data && v.data > end) return false;
    if (clienteFiltro && v.clienteId !== clienteFiltro) return false;
    if (produtoFiltro && v.produtoId !== produtoFiltro) return false;
    if (formaFiltro && v.formaId !== formaFiltro) return false;
    return true;
  });
}

// ===== CRUD CLIENTES =====
function iniciarEdicaoCliente(id) {
  const atual = clientesMap[id];
  if (!atual) return;

  cliNomeInput.value = atual.nome || "";
  cliCidadeInput.value = atual.cidade || "";
  editingClienteId = id;
  saveClienteButton.textContent = "Atualizar cliente";
  cancelClienteButton.classList.remove("hidden");
  cliMessage.textContent = "Editando cliente. Faça as alterações e clique em Atualizar.";
  cliMessage.className = "msg";
  setActiveSection("clientes");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoCliente() {
  editingClienteId = null;
  cliNomeInput.value = "";
  cliCidadeInput.value = "";
  saveClienteButton.textContent = "Salvar cliente";
  cancelClienteButton.classList.add("hidden");
  cliMessage.textContent = "";
  cliMessage.className = "msg";
}

async function excluirCliente(id) {
  const atual = clientesMap[id];
  const nome = atual?.nome || "este cliente";
  const confirmar = window.confirm(`Tem certeza que deseja excluir ${nome}?`);
  if (!confirmar) return;

  try {
    await db.collection("clientes").doc(id).delete();
    await carregarClientes();
  } catch (e) {
    console.error("Erro ao excluir cliente:", e);
    alert("Erro ao excluir cliente.");
  }
}

// ===== CRUD PRODUTOS =====
function iniciarEdicaoProduto(id) {
  const atual = produtosMap[id];
  if (!atual) return;

  prodDescInput.value = atual.descricao || "";
  prodPesoInput.value = atual.pesoGramas != null ? atual.pesoGramas : "";
  prodPrecoInput.value = atual.precoUnitario != null ? atual.precoUnitario : "";
  editingProdutoId = id;
  saveProdutoButton.textContent = "Atualizar produto";
  cancelProdutoButton.classList.remove("hidden");
  prodMessage.textContent = "Editando produto. Faça as alterações e clique em Atualizar.";
  prodMessage.className = "msg";
  setActiveSection("produtos");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoProduto() {
  editingProdutoId = null;
  prodDescInput.value = "";
  prodPesoInput.value = "";
  prodPrecoInput.value = "";
  saveProdutoButton.textContent = "Salvar produto";
  cancelProdutoButton.classList.add("hidden");
  prodMessage.textContent = "";
  prodMessage.className = "msg";
}

async function excluirProduto(id) {
  const atual = produtosMap[id];
  const desc = atual?.descricao || "este produto";
  const confirmar = window.confirm(`Tem certeza que deseja excluir ${desc}?`);
  if (!confirmar) return;

  try {
    await db.collection("produtos").doc(id).delete();
    await carregarProdutos();
  } catch (e) {
    console.error("Erro ao excluir produto:", e);
    alert("Erro ao excluir produto.");
  }
}

// ===== CRUD FORMAS =====
function iniciarEdicaoForma(id) {
  const atual = formasMap[id];
  if (!atual) return;

  fpDescInput.value = atual.descricao || "";
  editingFormaId = id;
  saveFormaButton.textContent = "Atualizar forma";
  cancelFormaButton.classList.remove("hidden");
  fpMessage.textContent = "Editando forma de pagamento. Faça as alterações e clique em Atualizar.";
  fpMessage.className = "msg";
  setActiveSection("formas");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoForma() {
  editingFormaId = null;
  fpDescInput.value = "";
  saveFormaButton.textContent = "Salvar forma de pagamento";
  cancelFormaButton.classList.add("hidden");
  fpMessage.textContent = "";
  fpMessage.className = "msg";
}

async function excluirForma(id) {
  const atual = formasMap[id];
  const desc = atual?.descricao || "esta forma de pagamento";
  const confirmar = window.confirm(`Tem certeza que deseja excluir ${desc}?`);
  if (!confirmar) return;

  try {
    await db.collection("formasPagamento").doc(id).delete();
    await carregarFormasPagamento();
  } catch (e) {
    console.error("Erro ao excluir forma de pagamento:", e);
    alert("Erro ao excluir forma de pagamento.");
  }
}

// ===== Auth =====
auth.onAuthStateChanged((user) => {
  updateUI(user);
});

loginButton.addEventListener("click", async () => {
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;

  loginError.textContent = "";
  saleMessage.textContent = "";
  saleMessage.className = "msg";
  loadingLabel.classList.remove("hidden");

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    console.error(error);
    let msg = "Erro ao fazer login.";
    if (error.code === "auth/user-not-found") msg = "Usuário não encontrado.";
    else if (error.code === "auth/wrong-password") msg = "Senha incorreta.";
    else if (error.code === "auth/invalid-email") msg = "E-mail inválido.";
    loginError.textContent = msg;
  } finally {
    loadingLabel.classList.add("hidden");
  }
});

logoutButton.addEventListener("click", async () => {
  await auth.signOut();
});

// ===== Abas =====
tabVenda.addEventListener("click", () => setActiveSection("venda"));
tabExtrato.addEventListener("click", () => setActiveSection("extrato"));
tabClientes.addEventListener("click", () => setActiveSection("clientes"));
tabProdutos.addEventListener("click", () => setActiveSection("produtos"));
tabFormas.addEventListener("click", () => setActiveSection("formas"));

// ===== Lógica da venda =====
saleProductSelect.addEventListener("change", () => {
  const id = saleProductSelect.value;
  if (id && produtosMap[id] && typeof produtosMap[id].precoUnitario === "number") {
    saleUnitPriceInput.value = produtosMap[id].precoUnitario.toFixed(2);
  }
  atualizarTotal();
});

saleQuantityInput.addEventListener("input", atualizarTotal);
saleUnitPriceInput.addEventListener("input", atualizarTotal);

saveSaleButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    saleMessage.textContent = "Você precisa estar logado para salvar.";
    saleMessage.className = "msg error";
    return;
  }

  const dataStr = saleDateInput.value;
  const lote = saleLoteInput.value.trim();
  const numeroNota = saleNfNumberInput.value.trim();
  const serieNota = saleNfSeriesInput.value.trim();
  const clienteId = saleClientSelect.value;
  const produtoId = saleProductSelect.value;
  const formaId = salePaymentSelect.value;
  const quantidade = Number(saleQuantityInput.value || 0);
  const valorUnitario = Number(saleUnitPriceInput.value || 0);
  const valorTotal = Number(saleTotalInput.value || 0);

  saleMessage.textContent = "";
  saleMessage.className = "msg";

  if (!dataStr || !clienteId || !produtoId || !formaId ||
      quantidade <= 0 || valorUnitario <= 0 || valorTotal <= 0) {
    saleMessage.textContent = "Preencha data, cliente, produto, forma, quantidade e valor unitário.";
    saleMessage.className = "msg error";
    return;
  }

  const clienteNome = clientesMap[clienteId]?.nome || "";
  const produtoDescricao = produtosMap[produtoId]?.descricao || "";
  const formaDescricao = formasMap[formaId]?.descricao || "";

  try {
    const dataVenda = new Date(dataStr + "T00:00:00");

    await db.collection("vendas").add({
      data: dataStr,
      dataTimestamp: firebase.firestore.Timestamp.fromDate(dataVenda),
      lote,
      numeroNota,
      serieNota,
      clienteId,
      clienteNome,
      produtoId,
      produtoDescricao,
      formaId,
      formaDescricao,
      quantidade,
      valorUnitario,
      valorTotal,
      usuarioId: user.uid,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    saleMessage.textContent = "Venda salva com sucesso!";
    saleMessage.className = "msg ok";

    saleQuantityInput.value = "1";
    saleLoteInput.value = "";
    saleNfNumberInput.value = "";
    saleNfSeriesInput.value = "";
    atualizarTotal();
    await carregarUltimasVendas();
  } catch (e) {
    console.error("Erro ao salvar venda:", e);
    saleMessage.textContent = "Erro ao salvar venda.";
    saleMessage.className = "msg error";
  }
});

// ===== Cadastro de clientes =====
saveClienteButton.addEventListener("click", async () => {
  const nome = cliNomeInput.value.trim();
  const cidade = cliCidadeInput.value.trim();

  cliMessage.textContent = "";
  cliMessage.className = "msg";

  if (!nome) {
    cliMessage.textContent = "Informe o nome do cliente.";
    cliMessage.className = "msg error";
    return;
  }

  try {
    if (editingClienteId) {
      await db.collection("clientes").doc(editingClienteId).update({
        nome,
        cidade
      });
      cliMessage.textContent = "Cliente atualizado com sucesso!";
      cliMessage.className = "msg ok";
      cancelarEdicaoCliente();
    } else {
      await db.collection("clientes").add({
        nome,
        cidade,
        ativo: true,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      cliMessage.textContent = "Cliente salvo com sucesso!";
      cliMessage.className = "msg ok";

      cliNomeInput.value = "";
      cliCidadeInput.value = "";
    }
    await carregarClientes();
  } catch (e) {
    console.error("Erro ao salvar cliente:", e);
    cliMessage.textContent = "Erro ao salvar cliente.";
    cliMessage.className = "msg error";
  }
});

cancelClienteButton.addEventListener("click", cancelarEdicaoCliente);

// ===== Cadastro de produtos =====
saveProdutoButton.addEventListener("click", async () => {
  const desc = prodDescInput.value.trim();
  const peso = Number(prodPesoInput.value || 0);
  const preco = Number(prodPrecoInput.value || 0);

  prodMessage.textContent = "";
  prodMessage.className = "msg";

  if (!desc || preco <= 0) {
    prodMessage.textContent = "Informe descrição e valor unitário (>0).";
    prodMessage.className = "msg error";
    return;
  }

  try {
    if (editingProdutoId) {
      await db.collection("produtos").doc(editingProdutoId).update({
        descricao: desc,
        pesoGramas: peso,
        precoUnitario: preco
      });
      prodMessage.textContent = "Produto atualizado com sucesso!";
      prodMessage.className = "msg ok";
      cancelarEdicaoProduto();
    } else {
      await db.collection("produtos").add({
        descricao: desc,
        pesoGramas: peso,
        precoUnitario: preco,
        ativo: true,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      prodMessage.textContent = "Produto salvo com sucesso!";
      prodMessage.className = "msg ok";

      prodDescInput.value = "";
      prodPesoInput.value = "";
      prodPrecoInput.value = "";
    }
    await carregarProdutos();
  } catch (e) {
    console.error("Erro ao salvar produto:", e);
    prodMessage.textContent = "Erro ao salvar produto.";
    prodMessage.className = "msg error";
  }
});

cancelProdutoButton.addEventListener("click", cancelarEdicaoProduto);

// ===== Cadastro de formas de pagamento =====
saveFormaButton.addEventListener("click", async () => {
  const desc = fpDescInput.value.trim();

  fpMessage.textContent = "";
  fpMessage.className = "msg";

  if (!desc) {
    fpMessage.textContent = "Informe a descrição da forma de pagamento.";
    fpMessage.className = "msg error";
    return;
  }

  try {
    if (editingFormaId) {
      await db.collection("formasPagamento").doc(editingFormaId).update({
        descricao: desc
      });
      fpMessage.textContent = "Forma de pagamento atualizada com sucesso!";
      fpMessage.className = "msg ok";
      cancelarEdicaoForma();
    } else {
      await db.collection("formasPagamento").add({
        descricao: desc,
        ativo: true,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      fpMessage.textContent = "Forma de pagamento salva com sucesso!";
      fpMessage.className = "msg ok";

      fpDescInput.value = "";
    }
    await carregarFormasPagamento();
  } catch (e) {
    console.error("Erro ao salvar forma de pagamento:", e);
    fpMessage.textContent = "Erro ao salvar forma de pagamento.";
    fpMessage.className = "msg error";
  }
});

cancelFormaButton.addEventListener("click", cancelarEdicaoForma);

// ===== Filtros de vendas =====
applyFilterButton.addEventListener("click", () => {
  renderizarVendasFiltradas();
});

clearFilterButton.addEventListener("click", () => {
  filterStartInput.value = "";
  filterEndInput.value = "";
  filterClientSelect.value = "";
  filterProductSelect.value = "";
  filterFormaSelect.value = "";
  renderizarVendasFiltradas();
});

// ===== Exportar CSV (vendas filtradas) =====
exportCsvButton.addEventListener("click", () => {
  if (!ultimasVendasCache || ultimasVendasCache.length === 0) {
    alert("Não há vendas carregadas para exportar.");
    return;
  }

  const filtradas = aplicarFiltrosEmMemoria();

  if (filtradas.length === 0) {
    alert("Nenhuma venda encontrada com esses filtros para exportar.");
    return;
  }

  const linhas = [];

  // Cabeçalho
  linhas.push([
    "data",
    "clienteNome",
    "clienteId",
    "produtoDescricao",
    "produtoId",
    "formaDescricao",
    "formaId",
    "quantidade",
    "valorUnitario",
    "valorTotal",
    "lote",
    "numeroNota",
    "serieNota"
  ].join(";"));

  // Linhas de dados
  filtradas.forEach(v => {
    const linha = [
      csvValue(v.data || ""),
      csvValue(v.clienteNome || ""),
      csvValue(v.clienteId || ""),
      csvValue(v.produtoDescricao || ""),
      csvValue(v.produtoId || ""),
      csvValue(v.formaDescricao || ""),
      csvValue(v.formaId || ""),
      csvValue(v.quantidade != null ? v.quantidade : ""),
      csvValue(v.valorUnitario != null ? v.valorUnitario.toFixed(2) : ""),
      csvValue(v.valorTotal != null ? v.valorTotal.toFixed(2) : ""),
      csvValue(v.lote || ""),
      csvValue(v.numeroNota || ""),
      csvValue(v.serieNota || "")
    ].join(";");
    linhas.push(linha);
  });

  const csvContent = linhas.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  const hoje = new Date().toISOString().slice(0, 10);
  const fileName = `vendas_filtradas_${hoje}.csv`;

  if (navigator.msSaveBlob) {
    // IE 10+
    navigator.msSaveBlob(blob, fileName);
  } else {
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
});

// começa com aba de venda ativa
setActiveSection("venda");
