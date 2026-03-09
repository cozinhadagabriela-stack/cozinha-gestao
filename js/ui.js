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
const tabLancamentoDespesas = document.getElementById("tab-lancamento-despesas");
const tabExtrato = document.getElementById("tab-extrato");
const tabEstoque = document.getElementById("tab-estoque");
const tabCadastros = document.getElementById("tab-cadastros");
const tabCaixa = document.getElementById("tab-caixa");

const sectionVenda = document.getElementById("section-venda");
const sectionLancamentoDespesas = document.getElementById("section-lancamento-despesas");
const sectionExtrato = document.getElementById("section-extrato");
const subtabExtratoVendas = document.getElementById("subtab-extrato-vendas");
const subtabExtratoDespesas = document.getElementById("subtab-extrato-despesas");
const subtabExtratoRelatorio = document.getElementById("subtab-extrato-relatorio");
const extratoVendasWrap = document.getElementById("extrato-vendas-wrap");
const extratoDespesasWrap = document.getElementById("extrato-despesas-wrap");
const extratoRelatorioWrap = document.getElementById("extrato-relatorio-wrap");
const sectionEstoque = document.getElementById("section-estoque");
const sectionCadastros = document.getElementById("section-cadastros");
const subtabCadClientes = document.getElementById("subtab-cad-clientes");
const subtabCadFornecedores = document.getElementById("subtab-cad-fornecedores");
const subtabCadProdutos = document.getElementById("subtab-cad-produtos");
const subtabCadFormas = document.getElementById("subtab-cad-formas");

const sectionFornecedores = document.getElementById("section-fornecedores");
const sectionClientes = document.getElementById("section-clientes");
const sectionProdutos = document.getElementById("section-produtos");
const sectionFormas = document.getElementById("section-formas");
const sectionCaixa = document.getElementById("section-caixa");

// venda
const saleDateInput = document.getElementById("sale-date");
const saleClientSelect = document.getElementById("sale-client");
const saleProductSelect = document.getElementById("sale-product");
const salePaymentSelect = document.getElementById("sale-payment");
const saleQuantityInput = document.getElementById("sale-quantity");
const saleUnitPriceInput = document.getElementById("sale-unit-price");
const saleTotalInput = document.getElementById("sale-total");
const saleLoteInput = document.getElementById("sale-lote");
const saleNfNumberInput = document.getElementById("sale-nf-number");
const saleNfSeriesInput = document.getElementById("sale-nf-series");
const saveSaleButton = document.getElementById("btn-save-sale");
const saleMessage = document.getElementById("sale-message");

// extrato / filtros
const filterStartInput = document.getElementById("filter-start");
const filterEndInput = document.getElementById("filter-end");
const filterClientSelect = document.getElementById("filter-client");
const filterProductSelect = document.getElementById("filter-product");
const filterFormaSelect = document.getElementById("filter-forma");
const applyFilterButton = document.getElementById("btn-apply-filters");
const clearFilterButton = document.getElementById("btn-clear-filters");
const exportCsvButton = document.getElementById("btn-export-csv");
const salesTbody = document.getElementById("sales-tbody");
const salesTotalLabel = document.getElementById("sales-total");

const kpiTotalVendas = document.getElementById("kpi-total-vendas");
const kpiQtdVendida = document.getElementById("kpi-qtd-vendida");
const kpiNumVendas = document.getElementById("kpi-num-vendas");
const kpiTopCliente = document.getElementById("kpi-top-cliente");
const kpiTopProduto = document.getElementById("kpi-top-produto");
const kpiTopCidade = document.getElementById("kpi-top-cidade");


// KPIs de comparação (mesmas datas do mês anterior)
const kpiCompFaturamento = document.getElementById("kpi-comp-faturamento");
const kpiCompUnidades = document.getElementById("kpi-comp-unidades");
const kpiCompTicketMedio = document.getElementById("kpi-comp-ticket-medio");
const kpiCompPrecoMedio = document.getElementById("kpi-comp-preco-medio");
const kpiCompClientesUnicos = document.getElementById("kpi-comp-clientes-unicos");
const kpiCompTop1Share = document.getElementById("kpi-comp-top1-share");
const kpiCompTop3Share = document.getElementById("kpi-comp-top3-share");
const kpiCompProduto1Share = document.getElementById("kpi-comp-produto1-share");
const kpiCompCidade1Share = document.getElementById("kpi-comp-cidade1-share");


const kpiProdutosBody = document.getElementById("kpi-produtos-tbody");
const kpiFormasBody = document.getElementById("kpi-formas-tbody");
const kpiCidadesBody = document.getElementById("kpi-cidades-tbody");

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

// ===== Funções auxiliares =====
function setActiveSection(section) {
  // esconde tudo
  sectionVenda.classList.add("hidden");
  if (sectionLancamentoDespesas) sectionLancamentoDespesas.classList.add("hidden");
  sectionExtrato.classList.add("hidden");
  sectionEstoque.classList.add("hidden");
  if (sectionCadastros) sectionCadastros.classList.add("hidden");
  if (sectionCaixa) sectionCaixa.classList.add("hidden");

  // limpa abas
  tabVenda.classList.remove("active-tab");
  if (tabLancamentoDespesas) tabLancamentoDespesas.classList.remove("active-tab");
  tabExtrato.classList.remove("active-tab");
  tabEstoque.classList.remove("active-tab");
  if (tabCadastros) tabCadastros.classList.remove("active-tab");
  if (tabCaixa) tabCaixa.classList.remove("active-tab");

  if (section === "venda") {
    sectionVenda.classList.remove("hidden");
    tabVenda.classList.add("active-tab");

  } else if (section === "lancamento-despesas") {
    if (sectionLancamentoDespesas) sectionLancamentoDespesas.classList.remove("hidden");
    if (tabLancamentoDespesas) tabLancamentoDespesas.classList.add("active-tab");

  } else if (section === "extrato") {
    sectionExtrato.classList.remove("hidden");
    tabExtrato.classList.add("active-tab");

    // Ao entrar em Extrato/Relatório, abre "Vendas" por padrão
    if (typeof setExtratoSubtab === "function") {
      setExtratoSubtab("vendas");
    }

  } else if (section === "estoque") {
    sectionEstoque.classList.remove("hidden");
    tabEstoque.classList.add("active-tab");

    // Ao entrar na aba estoque, garante produtos e saldos
    if (typeof preencherProdutosEstoque === "function") {
      preencherProdutosEstoque();
    }
    if (typeof carregarEstoqueSaldos === "function") {
      carregarEstoqueSaldos();
    }

    // Estoque de insumos
    if (typeof preencherItensEstoqueInsumos === "function") {
      preencherItensEstoqueInsumos();
    }
    if (typeof carregarEstoqueInsumosSaldos === "function") {
      carregarEstoqueInsumosSaldos();
    }

  } else if (section === "cadastros") {
    if (sectionCadastros) sectionCadastros.classList.remove("hidden");
    if (tabCadastros) tabCadastros.classList.add("active-tab");

    // Ao entrar em Cadastros, abre "Clientes" por padrão
    if (typeof setCadastrosSubtab === "function") {
      setCadastrosSubtab("clientes");
    }

  } else if (section === "caixa") {
    if (sectionCaixa) sectionCaixa.classList.remove("hidden");
    if (tabCaixa) tabCaixa.classList.add("active-tab");

    // Ao entrar em Caixa, carrega/atualiza os lançamentos e gráficos
    if (typeof initCaixaUI === "function") {
      initCaixaUI();
    }
  }
}

// ===== Sub-abas (Extrato / Relatório) =====
function setExtratoSubtab(subtab) {
  if (!extratoVendasWrap || !extratoDespesasWrap || !subtabExtratoVendas || !subtabExtratoDespesas) return;

  // esconde todas
  extratoVendasWrap.classList.add("hidden");
  extratoDespesasWrap.classList.add("hidden");
  if (extratoRelatorioWrap) extratoRelatorioWrap.classList.add("hidden");

  // limpa estilo
  subtabExtratoVendas.classList.remove("active-tab");
  subtabExtratoDespesas.classList.remove("active-tab");
  if (subtabExtratoRelatorio) subtabExtratoRelatorio.classList.remove("active-tab");

  if (subtab === "despesas") {
    extratoDespesasWrap.classList.remove("hidden");
    subtabExtratoDespesas.classList.add("active-tab");

    // carrega dados de despesas
    if (typeof carregarFornecedores === "function") {
      carregarFornecedores();
    }
    if (typeof preencherFormasPagamentoDespesas === "function") {
      preencherFormasPagamentoDespesas();
    }
    if (typeof carregarDespesas === "function") {
      carregarDespesas();
    }

  } else if (subtab === "relatorio") {
    if (extratoRelatorioWrap) extratoRelatorioWrap.classList.remove("hidden");
    if (subtabExtratoRelatorio) subtabExtratoRelatorio.classList.add("active-tab");

    // inicializa/atualiza relatório geral
    if (typeof initRelatorioGeral === "function") {
      initRelatorioGeral();
    }

  } else {
    // padrão: vendas
    extratoVendasWrap.classList.remove("hidden");
    subtabExtratoVendas.classList.add("active-tab");
  }
}




// ===== Sub-abas (Cadastros) =====
function setCadastrosSubtab(subtab) {
  if (!sectionClientes || !sectionProdutos || !sectionFormas || !subtabCadClientes || !subtabCadFornecedores || !subtabCadProdutos || !subtabCadFormas) return;

  // esconde todos
  sectionClientes.classList.add("hidden");
  if (sectionFornecedores) sectionFornecedores.classList.add("hidden");
  sectionProdutos.classList.add("hidden");
  sectionFormas.classList.add("hidden");

  // limpa estilo
  subtabCadClientes.classList.remove("active-tab");
  subtabCadFornecedores.classList.remove("active-tab");
  subtabCadProdutos.classList.remove("active-tab");
  subtabCadFormas.classList.remove("active-tab");

  if (subtab === "fornecedores") {
    if (sectionFornecedores) sectionFornecedores.classList.remove("hidden");
    subtabCadFornecedores.classList.add("active-tab");

    // Ao entrar em Fornecedores, carrega categorias / fornecedores / itens
    if (typeof carregarCategoriasDespesas === "function") {
      carregarCategoriasDespesas();
    }
    if (typeof carregarFornecedores === "function") {
      carregarFornecedores();
    }
    if (typeof carregarItensDespesas === "function") {
      carregarItensDespesas();
    }

  } else if (subtab === "produtos") {
    sectionProdutos.classList.remove("hidden");
    subtabCadProdutos.classList.add("active-tab");

  } else if (subtab === "formas") {
    sectionFormas.classList.remove("hidden");
    subtabCadFormas.classList.add("active-tab");

  } else {
    // padrão: clientes
    sectionClientes.classList.remove("hidden");
    subtabCadClientes.classList.add("active-tab");
  }
}

function updateUI(user) {
  if (user) {
    loginCard.classList.add("hidden");
    appCard.classList.remove("hidden");
    logoutButton.style.display = "inline-block";
    userEmailSpan.textContent = user.email;

    if (saleDateInput && !saleDateInput.value) {
      const hoje = new Date().toISOString().substring(0, 10);
      saleDateInput.value = hoje;
    }

    // carrega dados principais
    carregarClientes();
    carregarProdutos();
    carregarFormasPagamento();
    carregarUltimasVendas();

    // dados para estoque e despesas (se funções existirem)
    if (typeof preencherProdutosEstoque === "function") {
      preencherProdutosEstoque();
    }
    if (typeof carregarEstoqueSaldos === "function") {
      carregarEstoqueSaldos();
    }

    // Estoque de insumos (novo)
    if (typeof preencherItensEstoqueInsumos === "function") {
      preencherItensEstoqueInsumos();
    }
    if (typeof carregarEstoqueInsumosSaldos === "function") {
      carregarEstoqueInsumosSaldos();
    }
    if (typeof carregarFornecedores === "function") {
      carregarFornecedores();
    }
    if (typeof preencherFormasPagamentoDespesas === "function") {
      preencherFormasPagamentoDespesas();
    }
    if (typeof carregarDespesas === "function") {
      carregarDespesas();
    }
  } else {
    loginCard.classList.remove("hidden");
    appCard.classList.add("hidden");
    logoutButton.style.display = "none";
    userEmailSpan.textContent = "";
  }
}

// ===== Abas =====
tabVenda.addEventListener("click", () => setActiveSection("venda"));
if (tabLancamentoDespesas) tabLancamentoDespesas.addEventListener("click", () => setActiveSection("lancamento-despesas"));
tabExtrato.addEventListener("click", () => setActiveSection("extrato"));
if (subtabExtratoVendas) subtabExtratoVendas.addEventListener("click", () => setExtratoSubtab("vendas"));
if (subtabExtratoDespesas) subtabExtratoDespesas.addEventListener("click", () => setExtratoSubtab("despesas"));
if (subtabExtratoRelatorio) subtabExtratoRelatorio.addEventListener("click", () => setExtratoSubtab("relatorio"));
tabEstoque.addEventListener("click", () => setActiveSection("estoque"));
if (tabCadastros) tabCadastros.addEventListener("click", () => setActiveSection("cadastros"));

// Sub-abas de Cadastros
if (subtabCadClientes) subtabCadClientes.addEventListener("click", () => setCadastrosSubtab("clientes"));
if (subtabCadFornecedores) subtabCadFornecedores.addEventListener("click", () => setCadastrosSubtab("fornecedores"));
if (subtabCadProdutos) subtabCadProdutos.addEventListener("click", () => setCadastrosSubtab("produtos"));
if (subtabCadFormas) subtabCadFormas.addEventListener("click", () => setCadastrosSubtab("formas"));

if (tabCaixa) tabCaixa.addEventListener("click", () => setActiveSection("caixa"));

// começa com aba de venda ativa
setActiveSection("venda");
