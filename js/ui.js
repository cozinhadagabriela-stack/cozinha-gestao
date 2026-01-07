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
const tabEstoque = document.getElementById("tab-estoque");
const tabDespesas = document.getElementById("tab-despesas");
const tabFornecedores = document.getElementById("tab-fornecedores");
const tabClientes = document.getElementById("tab-clientes");
const tabProdutos = document.getElementById("tab-produtos");
const tabFormas = document.getElementById("tab-formas");
const tabCaixa = document.getElementById("tab-caixa");

const sectionVenda = document.getElementById("section-venda");
const sectionExtrato = document.getElementById("section-extrato");
const sectionEstoque = document.getElementById("section-estoque");
const sectionDespesas = document.getElementById("section-despesas");
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
  sectionExtrato.classList.add("hidden");
  sectionEstoque.classList.add("hidden");
  sectionDespesas.classList.add("hidden");
  if (sectionFornecedores) sectionFornecedores.classList.add("hidden");
  sectionClientes.classList.add("hidden");
  sectionProdutos.classList.add("hidden");
  sectionFormas.classList.add("hidden");
  if (sectionCaixa) sectionCaixa.classList.add("hidden");

  // limpa abas
  tabVenda.classList.remove("active-tab");
  tabExtrato.classList.remove("active-tab");
  tabEstoque.classList.remove("active-tab");
  tabDespesas.classList.remove("active-tab");
  if (tabFornecedores) tabFornecedores.classList.remove("active-tab");
  tabClientes.classList.remove("active-tab");
  tabProdutos.classList.remove("active-tab");
  tabFormas.classList.remove("active-tab");
  if (tabCaixa) tabCaixa.classList.remove("active-tab");

  if (section === "venda") {
    sectionVenda.classList.remove("hidden");
    tabVenda.classList.add("active-tab");
  } else if (section === "extrato") {
    sectionExtrato.classList.remove("hidden");
    tabExtrato.classList.add("active-tab");
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
  } else if (section === "despesas") {
    sectionDespesas.classList.remove("hidden");
    tabDespesas.classList.add("active-tab");

    // Ao entrar em despesas, garante fornecedores / formas / despesas
    if (typeof carregarCategoriasDespesas === "function") {
      carregarCategoriasDespesas();
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
  } else if (section === "fornecedores") {
    if (sectionFornecedores) sectionFornecedores.classList.remove("hidden");
    if (tabFornecedores) tabFornecedores.classList.add("active-tab");

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
} else if (section === "clientes") {
    sectionClientes.classList.remove("hidden");
    tabClientes.classList.add("active-tab");
  } else if (section === "produtos") {
    sectionProdutos.classList.remove("hidden");
    tabProdutos.classList.add("active-tab");
  } else if (section === "formas") {
    sectionFormas.classList.remove("hidden");
    tabFormas.classList.add("active-tab");
  } else if (section === "caixa") {
    if (sectionCaixa) sectionCaixa.classList.remove("hidden");
    if (tabCaixa) tabCaixa.classList.add("active-tab");

    // Ao entrar em Caixa, carrega/atualiza os lançamentos e gráficos
    if (typeof initCaixaUI === "function") {
      initCaixaUI();
    }
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
tabExtrato.addEventListener("click", () => setActiveSection("extrato"));
tabEstoque.addEventListener("click", () => setActiveSection("estoque"));
tabDespesas.addEventListener("click", () => setActiveSection("despesas"));
if (tabFornecedores) tabFornecedores.addEventListener("click", () => setActiveSection("fornecedores"));
tabClientes.addEventListener("click", () => setActiveSection("clientes"));
tabProdutos.addEventListener("click", () => setActiveSection("produtos"));
tabFormas.addEventListener("click", () => setActiveSection("formas"));
if (tabCaixa) tabCaixa.addEventListener("click", () => setActiveSection("caixa"));

// começa com aba de venda ativa
setActiveSection("venda");
