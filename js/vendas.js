// ====== CONTROLE DE ITENS DO PEDIDO (TELA DE VENDA) ======
let itensPedido = [];

// se não existir, cria o cache de vendas
if (typeof ultimasVendasCache === "undefined") {
  window.ultimasVendasCache = [];
}

const pedidoItensTbody = document.getElementById("pedido-itens-tbody");
const btnAddItem = document.getElementById("btn-add-item");

// NOVO: select de filtro de nota fiscal
const filterNfSelect = document.getElementById("filter-nf");

// ====== GRÁFICOS (Chart.js) ======
let chartFaturamentoMensal = null;
let chartDistribuicaoProdutos = null;

// Plugin para desenhar linhas de chamada e rótulos percentuais no gráfico de pizza
// (Distribuição de vendas por produto)
const pieCalloutPlugin = {
  id: "pieCallout",
  afterDatasetsDraw(chart, args, pluginOptions) {
    if (chart.config.type !== "pie") return;

    const { ctx } = chart;
    const dataset = chart.data.datasets[0];
    if (!dataset) return;

    const data = dataset.data || [];
    const total = data.reduce((acc, val) => acc + Number(val || 0), 0);
    if (total <= 0) return;

    const meta = chart.getDatasetMeta(0);
    const opts = pluginOptions || {};
    const lineColor = opts.color || "#666";
    const lineWidth = opts.lineWidth || 1;
    const font = opts.font || "12px Arial";
    const textColor = opts.textColor || "#333";
    const labelOffset = opts.labelOffset || 4;
    const extraRadius = opts.extraRadius || 15;

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = textColor;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;

    meta.data.forEach((arc, index) => {
      const value = Number(data[index] || 0);
      if (!arc || !isFinite(value) || value <= 0) return;

      const percent = ((value / total) * 100).toFixed(1) + "%";
      const angle = (arc.startAngle + arc.endAngle) / 2;

      const xCenter = arc.x;
      const yCenter = arc.y;
      const rOuter = arc.outerRadius;

      // Ponto inicial na borda da fatia
      const xFrom = xCenter + Math.cos(angle) * rOuter;
      const yFrom = yCenter + Math.sin(angle) * rOuter;

      // Ponto final (fora da pizza)
      const xTo = xCenter + Math.cos(angle) * (rOuter + extraRadius);
      const yTo = yCenter + Math.sin(angle) * (rOuter + extraRadius);

      ctx.beginPath();
      ctx.moveTo(xFrom, yFrom);
      ctx.lineTo(xTo, yTo);
      ctx.stroke();

      const label = percent;

      // Decide se o texto fica à direita ou à esquerda
      const textWidth = ctx.measureText(label).width;
      const isRightSide = Math.cos(angle) >= 0;
      const textX = isRightSide
        ? xTo + labelOffset
        : xTo - textWidth - labelOffset;
      const textY = yTo + 4; // pequeno ajuste vertical

      ctx.fillText(label, textX, textY);
    });

    ctx.restore();
  }
};

// registra o plugin globalmente (Chart.js já está carregado no index.html)
if (typeof Chart !== "undefined") {
  Chart.register(pieCalloutPlugin);
}

// ====== FUNÇÕES AUXILIARES (GERAIS) ======

// Formata "aaaa-mm-dd" -> "dd/mm/aaaa"
function formatarDataBrasil(dataIso) {
  if (!dataIso) return "";
  const partes = dataIso.split("-");
  if (partes.length !== 3) return dataIso;
  const [ano, mes, dia] = partes;
  return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
}

// ====== NOVO: PERÍODO PADRÃO (MÊS ATUAL) ======
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toISODateLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Se o usuário não escolher datas, o extrato já abre no mês atual
function garantirPeriodoMesAtualNoFiltro() {
  if (!filterStartInput || !filterEndInput) return;

  const startAtual = (filterStartInput.value || "").trim();
  const endAtual = (filterEndInput.value || "").trim();

  if (!startAtual && !endAtual) {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    filterStartInput.value = toISODateLocal(primeiroDia);
    filterEndInput.value = toISODateLocal(ultimoDia);
    return;
  }

  // Se preencheu só um, replica no outro (evita “meio filtro”)
  if (startAtual && !endAtual) {
    filterEndInput.value = startAtual;
  } else if (!startAtual && endAtual) {
    filterStartInput.value = endAtual;
  }
}


// ====== COMPARAÇÃO: PERÍODO ANTERIOR EQUIVALENTE (AUTOMÁTICO) ======
function parseISODateLocal(iso) {
  if (!iso || typeof iso !== "string") return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  // Cria como data local (evita deslocamento por fuso)
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function diffDaysInclusive(startIso, endIso) {
  const s = parseISODateLocal(startIso);
  const e = parseISODateLocal(endIso);
  if (!s || !e) return null;
  const ms = e.getTime() - s.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / 86400000) + 1; // inclui o dia inicial e final
}

function addDaysISO(iso, deltaDays) {
  const dt = parseISODateLocal(iso);
  if (!dt) return null;
  dt.setDate(dt.getDate() + Number(deltaDays || 0));
  return toISODateLocal(dt);
}

// Retorna o período anterior equivalente ao período [start, end]
// Ex.: 10/02 a 20/02 (11 dias) -> 30/01 a 09/02
function shiftMonthISO(iso, deltaMonths) {
  if (!iso) return null;
  const parts = String(iso).split("-");
  if (parts.length !== 3) return null;

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);

  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;

  // Começa sempre no 1º dia do mês para evitar “pulos” do Date (ex: 31 -> mês seguinte)
  const base = new Date(y, m - 1, 1);
  const target = new Date(base.getFullYear(), base.getMonth() + deltaMonths, 1);

  // Ajusta o dia para o último dia do mês de destino, se necessário (ex: 31 -> 28/29)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(d, lastDay);

  const finalDate = new Date(target.getFullYear(), target.getMonth(), day);
  return toISODateLocal(finalDate);
}

// ✅ Período anterior: MESMAS DATAS do MÊS ANTERIOR
// Ex: 01/01 a 10/01 => 01/12 a 10/12
function obterPeriodoAnteriorEquivalente(startIso, endIso) {
  const dias = diffDaysInclusive(startIso, endIso);
  if (!dias) return { prevStart: null, prevEnd: null, dias: null };

  const prevStart = shiftMonthISO(startIso, -1);
  const prevEnd = shiftMonthISO(endIso, -1);

  if (!prevStart || !prevEnd) return { prevStart: null, prevEnd: null, dias: null };

  return { prevStart, prevEnd, dias };
}

// ====== FORMATAÇÃO para KPIs de comparação ======
function formatarMoedaSimples(valor) {
  const num = Number(valor || 0);
  if (!isFinite(num)) return "R$ 0.00";
  return "R$ " + num.toFixed(2);
}

function formatarNumeroSimples(valor, casas = 0) {
  const num = Number(valor || 0);
  if (!isFinite(num)) return "0";
  return num.toFixed(casas);
}

function formatarDelta(curr, prev, isMoney = false, casas = 0) {
  const c = Number(curr || 0);
  const p = Number(prev || 0);

  if (!isFinite(c) || !isFinite(p)) return "—";

  const delta = c - p;

  let percTxt = "—";
  if (p !== 0) {
    const perc = (delta / p) * 100;
    percTxt = (perc >= 0 ? "+" : "") + perc.toFixed(1) + "%";
  }

  const deltaTxt = isMoney
    ? (delta >= 0 ? "+" : "") + formatarMoedaSimples(delta).replace("R$ ", "R$ ")
    : (delta >= 0 ? "+" : "") + formatarNumeroSimples(delta, casas);

  return `${deltaTxt} (${percTxt})`;
}

function formatarPontosPercentuais(currPerc, prevPerc) {
  const c = Number(currPerc || 0);
  const p = Number(prevPerc || 0);
  if (!isFinite(c) || !isFinite(p)) return "—";
  const dp = c - p;
  const dpTxt = (dp >= 0 ? "+" : "") + dp.toFixed(1) + " p.p.";
  return dpTxt;
}

// ====== FUNÇÕES AUXILIARES (VENDA) ======

// Atualiza o campo "Total do pedido (R$)"
function atualizarTotal() {
  if (!saleTotalInput) return;

  // Se já há itens na tabela, soma todos
  if (itensPedido.length > 0) {
    const total = itensPedido.reduce((acc, item) => {
      const qtd = Number(item.quantidade || 0);
      const unit = Number(item.valorUnitario || 0);
      return acc + (qtd > 0 && unit >= 0 ? qtd * unit : 0);
    }, 0);
    saleTotalInput.value = total > 0 ? total.toFixed(2) : "";
    return;
  }

  // Sem itens: usa o que está digitado nos campos (prévia)
  const qtd = Number(saleQuantityInput.value || 0);
  const unit = Number(saleUnitPriceInput.value || 0);
  if (qtd > 0 && unit >= 0) {
    saleTotalInput.value = (qtd * unit).toFixed(2);
  } else {
    saleTotalInput.value = "";
  }
}

// Renderiza a tabela de itens do pedido
function renderizarItensPedido() {
  if (!pedidoItensTbody) return;

  if (!itensPedido || itensPedido.length === 0) {
    pedidoItensTbody.innerHTML =
      '<tr><td colspan="6">Nenhum item adicionado.</td></tr>';
    atualizarTotal();
    return;
  }

  pedidoItensTbody.innerHTML = "";
  let totalPedido = 0;

  itensPedido.forEach((item, index) => {
    const tr = document.createElement("tr");

    const tdProduto = document.createElement("td");
    tdProduto.textContent = item.produtoDescricao || "";
    tr.appendChild(tdProduto);

    const tdLote = document.createElement("td");
    tdLote.textContent = item.lote || "";
    tr.appendChild(tdLote);

    const tdQtd = document.createElement("td");
    tdQtd.textContent = item.quantidade != null ? item.quantidade : "";
    tr.appendChild(tdQtd);

    const tdValorUnit = document.createElement("td");
    tdValorUnit.textContent =
      item.valorUnitario != null
        ? Number(item.valorUnitario).toFixed(2)
        : "";
    tr.appendChild(tdValorUnit);

    const valorItem =
      Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
    totalPedido += valorItem;

    const tdTotal = document.createElement("td");
    tdTotal.textContent = valorItem.toFixed(2);
    tr.appendChild(tdTotal);

    const tdAcoes = document.createElement("td");
    const btnRemover = document.createElement("button");
    btnRemover.textContent = "Remover";
    btnRemover.className = "btn-small btn-danger";
    btnRemover.addEventListener("click", () => {
      itensPedido.splice(index, 1);
      renderizarItensPedido();
    });
    tdAcoes.appendChild(btnRemover);
    tr.appendChild(tdAcoes);

    pedidoItensTbody.appendChild(tr);
  });

  saleTotalInput.value = totalPedido > 0 ? totalPedido.toFixed(2) : "";
}

// Limpa apenas os campos do item
function limparCamposItem() {
  if (saleProductSelect) saleProductSelect.value = "";
  if (saleLoteInput) saleLoteInput.value = "";
  if (saleQuantityInput) saleQuantityInput.value = "1";
  if (saleUnitPriceInput) saleUnitPriceInput.value = "";
  atualizarTotal();
}

// Quando mudar o produto, puxa o preço padrão
saleProductSelect.addEventListener("change", () => {
  const id = saleProductSelect.value;
  if (
    id &&
    produtosMap[id] &&
    typeof produtosMap[id].precoUnitario === "number"
  ) {
    saleUnitPriceInput.value = produtosMap[id].precoUnitario.toFixed(2);
  }
  atualizarTotal();
});

// Atualiza prévia do total enquanto digita
saleQuantityInput.addEventListener("input", atualizarTotal);
saleUnitPriceInput.addEventListener("input", atualizarTotal);

// Botão "Adicionar item" (só cuida do item; não grava no banco ainda)
if (btnAddItem) {
  btnAddItem.addEventListener("click", () => {
    if (saleMessage) {
      saleMessage.textContent = "";
      saleMessage.className = "msg";
    }

    const produtoId = saleProductSelect.value;
    const quantidade = Number(saleQuantityInput.value || 0);
    const valorUnitario = Number(saleUnitPriceInput.value || 0);
    let lote = (saleLoteInput.value || "").trim();

    // Validações básicas
    if (!produtoId) {
      saleMessage.textContent =
        "Selecione um produto para adicionar ao pedido.";
      saleMessage.className = "msg error";
      return;
    }

    if (quantidade <= 0 || valorUnitario <= 0) {
      saleMessage.textContent =
        "Informe quantidade e valor unitário maiores que zero para adicionar o item.";
      saleMessage.className = "msg error";
      return;
    }

    // Limite de caracteres do lote (8)
    if (lote.length > 8) {
      lote = lote.slice(0, 8);
      saleLoteInput.value = lote;
    }

    const produto = produtosMap[produtoId] || {};
    const produtoDescricao = produto.descricao || "Produto";

    itensPedido.push({
      produtoId,
      produtoDescricao,
      lote,
      quantidade,
      valorUnitario
    });

    limparCamposItem();
    renderizarItensPedido();
  });
}

// ====== CARREGAR / EXTRATO / KPIs ======
// >>> AJUSTADO: por padrão mês atual + paginação (lotes de 1000) <<<

async function carregarUltimasVendas() {
  salesTbody.innerHTML = '<tr><td colspan="10">Carregando...</td></tr>';
  salesTotalLabel.textContent = "";
  ultimasVendasCache = [];

  try {
    garantirPeriodoMesAtualNoFiltro();

    const start = filterStartInput.value;
    const end = filterEndInput.value;

    // Para comparar com o período anterior equivalente, carregamos também esse período no cache
    const periodoPrev = obterPeriodoAnteriorEquivalente(start, end);
    const fetchStart = periodoPrev.prevStart || start;

    const PAGE_SIZE = 1000;  // tamanho do lote
    const MAX_TOTAL = 50000; // trava de segurança (ajuste se quiser)

    let lastDoc = null;
    let totalCarregado = 0;

    while (true) {
      let query = db
        .collection("vendas")
        .where("data", ">=", fetchStart)
        .where("data", "<=", end)
        .orderBy("data", "desc")
        .limit(PAGE_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) break;

      snapshot.forEach((doc) => {
        const v = doc.data() || {};

        // Garante dataTimestamp para ordenação interna
        if ((!v.dataTimestamp || !isFinite(Number(v.dataTimestamp))) && v.data) {
          v.dataTimestamp = new Date(v.data).getTime();
        }

        ultimasVendasCache.push({
          id: doc.id,
          ...v
        });
      });

      totalCarregado += snapshot.size;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // feedback simples enquanto carrega
      salesTbody.innerHTML = `<tr><td colspan="10">Carregando... (${totalCarregado})</td></tr>`;

      // trava de segurança
      if (ultimasVendasCache.length >= MAX_TOTAL) break;

      // se veio menos que o PAGE_SIZE, acabou
      if (snapshot.size < PAGE_SIZE) break;
    }

    if (ultimasVendasCache.length === 0) {
      salesTbody.innerHTML =
        '<tr><td colspan="10">Nenhuma venda encontrada no período.</td></tr>';
      atualizarKPIsVazios();
      atualizarGraficoFaturamentoMensal([]);
      atualizarGraficoDistribuicaoProdutos({});
      return;
    }

    renderizarVendasFiltradas();
  } catch (e) {
    console.error("Erro ao carregar vendas:", e);
    salesTbody.innerHTML =
      '<tr><td colspan="10">Erro ao carregar vendas.</td></tr>';
    atualizarKPIsVazios();
    atualizarGraficoFaturamentoMensal([]);
    atualizarGraficoDistribuicaoProdutos({});
  }
}

function atualizarKPIsVazios() {
  kpiTotalVendas.textContent = "R$ 0,00";
  kpiQtdVendida.textContent = "0";
  kpiNumVendas.textContent = "0";
  kpiTopCliente.textContent = "—";
  kpiTopProduto.textContent = "—";
  kpiTopCidade.textContent = "—";

  // agora produtos têm 4 colunas (inclui %)
  kpiProdutosBody.innerHTML =
    '<tr><td colspan="4">Sem dados.</td></tr>';
  // formas continuam com 3 colunas
  kpiFormasBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  // cidades agora têm 3 colunas (inclui %)
  kpiCidadesBody.innerHTML =
    '<tr><td colspan="3">Sem dados.</td></tr>';
  limparKPIsComparacao();
}

// Tabelas de resumo (produto, forma, cidade)
function atualizarTabelasDetalhe(
  mapaProdutoQtd,
  mapaProdutoValor,
  mapaFormaValor,
  mapaCidadeValor,
  totalValor
) {
  // Produtos
  const produtoEntries = Object.keys(mapaProdutoQtd).map((desc) => ({
    descricao: desc,
    qtd: mapaProdutoQtd[desc] || 0,
    valor: mapaProdutoValor[desc] || 0,
    perc:
      totalValor > 0
        ? (mapaProdutoValor[desc] / totalValor) * 100
        : 0
  })).sort((a, b) => b.valor - a.valor);

  if (produtoEntries.length === 0) {
    kpiProdutosBody.innerHTML =
      '<tr><td colspan="4">Sem dados.</td></tr>';
  } else {
    kpiProdutosBody.innerHTML = "";
    produtoEntries.forEach((p) => {
      const tr = document.createElement("tr");

      const tdDesc = document.createElement("td");
      tdDesc.textContent = p.descricao;

      const tdQtd = document.createElement("td");
      tdQtd.textContent = p.qtd;

      const tdVal = document.createElement("td");
      tdVal.textContent = p.valor.toFixed(2);

      const tdPerc = document.createElement("td");
      tdPerc.textContent =
        totalValor > 0 ? p.perc.toFixed(1) + "%" : "0,0%";

      tr.appendChild(tdDesc);
      tr.appendChild(tdQtd);
      tr.appendChild(tdVal);
      tr.appendChild(tdPerc);

      kpiProdutosBody.appendChild(tr);
    });
  }

  // Formas de pagamento
  const formaEntries = Object.keys(mapaFormaValor).map((desc) => ({
    descricao: desc,
    valor: mapaFormaValor[desc] || 0
  })).sort((a, b) => b.valor - a.valor);

  if (formaEntries.length === 0) {
    kpiFormasBody.innerHTML =
      '<tr><td colspan="3">Sem dados.</td></tr>';
  } else {
    kpiFormasBody.innerHTML = "";
    formaEntries.forEach((f) => {
      const tr = document.createElement("tr");

      const tdDesc = document.createElement("td");
      tdDesc.textContent = f.descricao;

      const tdVal = document.createElement("td");
      tdVal.textContent = f.valor.toFixed(2);

      const tdPerc = document.createElement("td");
      tdPerc.textContent =
        totalValor > 0
          ? ((f.valor / totalValor) * 100).toFixed(1) + "%"
          : "0,0%";

      tr.appendChild(tdDesc);
      tr.appendChild(tdVal);
      tr.appendChild(tdPerc);

      kpiFormasBody.appendChild(tr);
    });
  }

  // Cidades
  const cidadeEntries = Object.keys(mapaCidadeValor).map((cidade) => ({
    cidade,
    valor: mapaCidadeValor[cidade] || 0,
    perc:
      totalValor > 0
        ? (mapaCidadeValor[cidade] / totalValor) * 100
        : 0
  })).sort((a, b) => b.valor - a.valor);

  if (cidadeEntries.length === 0) {
    kpiCidadesBody.innerHTML =
      '<tr><td colspan="3">Sem dados.</td></tr>';
  } else {
    kpiCidadesBody.innerHTML = "";
    cidadeEntries.forEach((c) => {
      const tr = document.createElement("tr");

      const tdCidade = document.createElement("td");
      tdCidade.textContent = c.cidade;

      const tdVal = document.createElement("td");
      tdVal.textContent = c.valor.toFixed(2);

      const tdPerc = document.createElement("td");
      tdPerc.textContent =
        totalValor > 0 ? c.perc.toFixed(1) + "%" : "0,0%";

      tr.appendChild(tdCidade);
      tr.appendChild(tdVal);
      tr.appendChild(tdPerc);

      kpiCidadesBody.appendChild(tr);
    });
  }
}


// ====== KPIs DE COMPARAÇÃO (período anterior equivalente) ======
function calcularMetricasComparacao(lista) {
  const vendas = Array.isArray(lista) ? lista : [];

  let totalValor = 0;
  let totalQtd = 0;
  let totalPedidos = 0;
  const pedidosSet = new Set();
  const clientesSet = new Set();

  const mapaClienteValor = {};
  const mapaProdutoValor = {};
  const mapaCidadeValor = {};

  vendas.forEach((v) => {
    const valor = Number(v.valorTotal || 0);
    const qtd = Number(v.quantidade || 0);

    if (isFinite(valor)) totalValor += valor;
    if (isFinite(qtd)) totalQtd += qtd;

    const clienteId = v.clienteId || "";
    if (clienteId) clientesSet.add(clienteId);

    const chavePedido =
      v.pedidoChave ||
      [v.data || "", v.clienteId || "", v.formaId || "", v.numeroNota || ""].join("|");

    if (!pedidosSet.has(chavePedido)) {
      pedidosSet.add(chavePedido);
      totalPedidos += 1;
    }

    const clienteNome = (v.clienteNome || "—").trim() || "—";
    mapaClienteValor[clienteNome] = (mapaClienteValor[clienteNome] || 0) + (isFinite(valor) ? valor : 0);

    const produtoDesc = (v.produtoDescricao || "—").trim() || "—";
    mapaProdutoValor[produtoDesc] = (mapaProdutoValor[produtoDesc] || 0) + (isFinite(valor) ? valor : 0);

    const cidade = (v.clienteCidade || "—").trim() || "—";
    mapaCidadeValor[cidade] = (mapaCidadeValor[cidade] || 0) + (isFinite(valor) ? valor : 0);
  });

  // Ticket médio por pedido
  const ticketMedio = totalPedidos > 0 ? totalValor / totalPedidos : 0;
  // Preço médio por unidade
  const precoMedio = totalQtd > 0 ? totalValor / totalQtd : 0;

  // Concentração por cliente (Top1 / Top3)
  const clientesOrdenados = Object.entries(mapaClienteValor).sort((a, b) => b[1] - a[1]);
  const top1Valor = clientesOrdenados.length ? clientesOrdenados[0][1] : 0;
  const top3Valor = clientesOrdenados.slice(0, 3).reduce((acc, [, v]) => acc + Number(v || 0), 0);

  const top1Share = totalValor > 0 ? (top1Valor / totalValor) * 100 : 0;
  const top3Share = totalValor > 0 ? (top3Valor / totalValor) * 100 : 0;

  // Produto #1 (por faturamento)
  let topProdutoNome = "—";
  let topProdutoValor = 0;
  Object.entries(mapaProdutoValor).forEach(([nome, v]) => {
    if (v > topProdutoValor) {
      topProdutoValor = v;
      topProdutoNome = nome;
    }
  });
  const topProdutoShare = totalValor > 0 ? (topProdutoValor / totalValor) * 100 : 0;

  // Cidade #1 (por faturamento)
  let topCidadeNome = "—";
  let topCidadeValor = 0;
  Object.entries(mapaCidadeValor).forEach(([nome, v]) => {
    if (v > topCidadeValor) {
      topCidadeValor = v;
      topCidadeNome = nome;
    }
  });
  const topCidadeShare = totalValor > 0 ? (topCidadeValor / totalValor) * 100 : 0;

  return {
    totalValor,
    totalQtd,
    totalPedidos,
    clientesUnicos: clientesSet.size,
    ticketMedio,
    precoMedio,
    // shares
    top1Share,
    top3Share,
    topProdutoNome,
    topProdutoShare,
    topCidadeNome,
    topCidadeShare,
    // maps (para lookup de share no período anterior)
    mapaProdutoValor,
    mapaCidadeValor
  };
}

function obterShareNoPeriodo(mapaValor, totalValor, chave) {
  if (!mapaValor || !totalValor || totalValor <= 0) return 0;
  const v = Number(mapaValor[chave] || 0);
  if (!isFinite(v) || v <= 0) return 0;
  return (v / totalValor) * 100;
}

function atualizarKPIsComparacao(metricAtual, metricAnterior) {
  if (typeof kpiCompFaturamento === "undefined") return; // ui.js não tem (evita quebrar)

  const a = metricAtual || {};
  const p = metricAnterior || {};

  // Faturamento
  if (kpiCompFaturamento) {
    const deltaTxt = formatarDelta(a.totalValor, p.totalValor, true, 2);
    kpiCompFaturamento.textContent = `${formatarMoedaSimples(a.totalValor)} • ${deltaTxt}`;
  }

  // Unidades
  if (kpiCompUnidades) {
    const deltaTxt = formatarDelta(a.totalQtd, p.totalQtd, false, 0);
    kpiCompUnidades.textContent = `${formatarNumeroSimples(a.totalQtd, 0)} • ${deltaTxt}`;
  }

  // Ticket médio
  if (kpiCompTicketMedio) {
    const deltaTxt = formatarDelta(a.ticketMedio, p.ticketMedio, true, 2);
    kpiCompTicketMedio.textContent = `${formatarMoedaSimples(a.ticketMedio)} • ${deltaTxt}`;
  }

  // Preço médio por unidade
  if (kpiCompPrecoMedio) {
    const deltaTxt = formatarDelta(a.precoMedio, p.precoMedio, true, 2);
    kpiCompPrecoMedio.textContent = `${formatarMoedaSimples(a.precoMedio)} • ${deltaTxt}`;
  }

  // Clientes únicos
  if (kpiCompClientesUnicos) {
    const deltaTxt = formatarDelta(a.clientesUnicos, p.clientesUnicos, false, 0);
    kpiCompClientesUnicos.textContent = `${formatarNumeroSimples(a.clientesUnicos, 0)} • ${deltaTxt}`;
  }

  // Concentração Top 1
  if (kpiCompTop1Share) {
    const dp = formatarPontosPercentuais(a.top1Share, p.top1Share);
    kpiCompTop1Share.textContent = `${a.top1Share.toFixed(1)}% • ${dp}`;
  }

  // Concentração Top 3
  if (kpiCompTop3Share) {
    const dp = formatarPontosPercentuais(a.top3Share, p.top3Share);
    kpiCompTop3Share.textContent = `${a.top3Share.toFixed(1)}% • ${dp}`;
  }

  // Produto #1 (share no anterior do MESMO produto)
  if (kpiCompProduto1Share) {
    const sharePrevMesmoProduto = obterShareNoPeriodo(
      p.mapaProdutoValor,
      p.totalValor,
      a.topProdutoNome
    );
    const dp = formatarPontosPercentuais(a.topProdutoShare, sharePrevMesmoProduto);
    kpiCompProduto1Share.textContent = `${a.topProdutoNome}: ${a.topProdutoShare.toFixed(1)}% • ${dp}`;
  }

  // Cidade #1 (share no anterior da MESMA cidade)
  if (kpiCompCidade1Share) {
    const sharePrevMesmaCidade = obterShareNoPeriodo(
      p.mapaCidadeValor,
      p.totalValor,
      a.topCidadeNome
    );
    const dp = formatarPontosPercentuais(a.topCidadeShare, sharePrevMesmaCidade);
    kpiCompCidade1Share.textContent = `${a.topCidadeNome}: ${a.topCidadeShare.toFixed(1)}% • ${dp}`;
  }
}

function limparKPIsComparacao() {
  if (typeof kpiCompFaturamento === "undefined") return;
  if (kpiCompFaturamento) kpiCompFaturamento.textContent = "—";
  if (kpiCompUnidades) kpiCompUnidades.textContent = "—";
  if (kpiCompTicketMedio) kpiCompTicketMedio.textContent = "—";
  if (kpiCompPrecoMedio) kpiCompPrecoMedio.textContent = "—";
  if (kpiCompClientesUnicos) kpiCompClientesUnicos.textContent = "—";
  if (kpiCompTop1Share) kpiCompTop1Share.textContent = "—";
  if (kpiCompTop3Share) kpiCompTop3Share.textContent = "—";
  if (kpiCompProduto1Share) kpiCompProduto1Share.textContent = "—";
  if (kpiCompCidade1Share) kpiCompCidade1Share.textContent = "—";
}

// ====== GRÁFICOS (FUNÇÕES) ======

// Evolução do faturamento mensal (line chart)
function atualizarGraficoFaturamentoMensal(vendasFiltradas) {
  const canvas = document.getElementById("chart-faturamento-mensal");
  if (!canvas || typeof Chart === "undefined") return;

  // Se não há vendas, só destrói o gráfico atual
  if (!vendasFiltradas || vendasFiltradas.length === 0) {
    if (chartFaturamentoMensal) {
      chartFaturamentoMensal.destroy();
      chartFaturamentoMensal = null;
    }
    return;
  }

  const mapaMesValor = {};

  vendasFiltradas.forEach((v) => {
    const dataIso = v.data || "";
    if (!dataIso || dataIso.length < 7) return;
    const anoMes = dataIso.slice(0, 7); // "aaaa-mm"
    const valor = Number(v.valorTotal || 0);
    if (!mapaMesValor[anoMes]) mapaMesValor[anoMes] = 0;
    mapaMesValor[anoMes] += valor;
  });

  const chavesOrdenadas = Object.keys(mapaMesValor).sort(); // 2025-01, 2025-02...
  if (chavesOrdenadas.length === 0) {
    if (chartFaturamentoMensal) {
      chartFaturamentoMensal.destroy();
      chartFaturamentoMensal = null;
    }
    return;
  }

  const labels = chavesOrdenadas.map((ym) => {
    const [ano, mes] = ym.split("-");
    return `${mes}/${ano}`;
  });
  const valores = chavesOrdenadas.map((ym) => mapaMesValor[ym]);

  if (chartFaturamentoMensal) {
    chartFaturamentoMensal.data.labels = labels;
    chartFaturamentoMensal.data.datasets[0].data = valores;
    chartFaturamentoMensal.update();
  } else {
    const ctx = canvas.getContext("2d");
    chartFaturamentoMensal = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Faturamento (R$)",
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
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            ticks: {
              beginAtZero: true
            }
          }
        }
      }
    });
  }
}

// Pizza de distribuição de vendas por produto (por quantidade)
function atualizarGraficoDistribuicaoProdutos(mapaProdutoQtd) {
  const canvas = document.getElementById("chart-produtos");
  if (!canvas || typeof Chart === "undefined") return;

  const entries = Object.keys(mapaProdutoQtd || {})
    .map((desc) => ({
      descricao: desc,
      qtd: mapaProdutoQtd[desc] || 0
    }))
    .filter((e) => e.qtd > 0)
    .sort((a, b) => b.qtd - a.qtd);

  if (entries.length === 0) {
    if (chartDistribuicaoProdutos) {
      chartDistribuicaoProdutos.destroy();
      chartDistribuicaoProdutos = null;
    }
    return;
  }

  const labels = entries.map((e) => e.descricao);
  const dados = entries.map((e) => e.qtd);

  // Paleta simples de cores
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
  const cores = labels.map((_, i) => baseColors[i % baseColors.length]);

  if (chartDistribuicaoProdutos) {
    chartDistribuicaoProdutos.data.labels = labels;
    chartDistribuicaoProdutos.data.datasets[0].data = dados;
    chartDistribuicaoProdutos.data.datasets[0].backgroundColor = cores;
    chartDistribuicaoProdutos.update();
  } else {
    const ctx = canvas.getContext("2d");
    chartDistribuicaoProdutos = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: dados,
            backgroundColor: cores,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom"
          },
          tooltip: {
            callbacks: {
              label(context) {
                const label = context.label || "";
                const value = context.parsed;
                const dataArr = context.dataset.data || [];
                const total = dataArr.reduce(
                  (acc, v) => acc + Number(v || 0),
                  0
                );
                const perc =
                  total > 0
                    ? ((value / total) * 100).toFixed(1) + "%"
                    : "0%";
                return `${label}: ${value} un. (${perc})`;
              }
            }
          },
          // opções do plugin de linhas de chamada
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
  }
}

// ====== FILTROS EM MEMÓRIA / EXTRATO ======

// Ordena das datas mais antigas para as mais novas

// Ordena das datas mais antigas para as mais novas
function aplicarFiltrosEmMemoriaPeriodo(start, end) {
  const clienteFiltro = filterClientSelect.value;
  const produtoFiltro = filterProductSelect.value;
  const formaFiltro = filterFormaSelect.value;
  const nfFiltro = filterNfSelect ? filterNfSelect.value : "";

  // 1) cria cópia e ordena por dataTimestamp em ordem crescente
  const baseOrdenada = ultimasVendasCache.slice().sort((a, b) => {
    const ta = a.dataTimestamp || 0;
    const tb = b.dataTimestamp || 0;
    return ta - tb; // mais antigo em cima, mais novo embaixo
  });

  // 2) aplica filtros sobre essa lista ordenada
  return baseOrdenada.filter((v) => {
    if (start && v.data && v.data < start) return false;
    if (end && v.data && v.data > end) return false;
    if (clienteFiltro && v.clienteId !== clienteFiltro) return false;
    if (produtoFiltro && v.produtoId !== produtoFiltro) return false;
    if (formaFiltro && v.formaId !== formaFiltro) return false;

    // Filtro de nota fiscal
    const temNota =
      v.numeroNota != null &&
      String(v.numeroNota).trim() !== "";

    if (nfFiltro === "com" && !temNota) return false;
    if (nfFiltro === "sem" && temNota) return false;

    return true;
  });
}

// Ordena das datas mais antigas para as mais novas (período atual dos filtros)
function aplicarFiltrosEmMemoria() {
  const start = filterStartInput.value;
  const end = filterEndInput.value;
  return aplicarFiltrosEmMemoriaPeriodo(start, end);
}


function renderizarVendasFiltradas() {
  const vendasFiltradas = aplicarFiltrosEmMemoria();

  if (vendasFiltradas.length === 0) {
    salesTbody.innerHTML =
      '<tr><td colspan="10">Nenhuma venda no filtro.</td></tr>';
    salesTotalLabel.textContent = "R$ 0,00";
    atualizarKPIsVazios();
    atualizarGraficoFaturamentoMensal([]);
    atualizarGraficoDistribuicaoProdutos({});
    return;
  }

  salesTbody.innerHTML = "";

  let totalValor = 0;
  let totalQtd = 0;
  let totalPedidos = 0;

  const pedidosSet = new Set();

  const mapaClienteValor = {};
  const mapaProdutoQtd = {};
  const mapaProdutoValor = {};
  const mapaFormaValor = {};
  const mapaCidadeValor = {};

  vendasFiltradas.forEach((v) => {
    const valor = Number(v.valorTotal || 0);
    const qtd = Number(v.quantidade || 0);
    totalValor += valor;
    totalQtd += qtd;

    // conta nº de pedidos (pedidoChave)
    const chavePedido =
      v.pedidoChave ||
      [
        v.data || "",
        v.clienteId || "",
        v.formaId || "",
        v.numeroNota || ""
      ].join("|");

    if (!pedidosSet.has(chavePedido)) {
      pedidosSet.add(chavePedido);
      totalPedidos += 1;
    }

    const clienteNome = v.clienteNome || "";
    if (!mapaClienteValor[clienteNome]) mapaClienteValor[clienteNome] = 0;
    mapaClienteValor[clienteNome] += valor;

    const produtoDesc = v.produtoDescricao || "";
    if (!mapaProdutoQtd[produtoDesc]) mapaProdutoQtd[produtoDesc] = 0;
    mapaProdutoQtd[produtoDesc] += qtd;

    if (!mapaProdutoValor[produtoDesc]) mapaProdutoValor[produtoDesc] = 0;
    mapaProdutoValor[produtoDesc] += valor;

    const formaDesc = v.formaDescricao || "";
    if (!mapaFormaValor[formaDesc]) mapaFormaValor[formaDesc] = 0;
    mapaFormaValor[formaDesc] += valor;

    const cidade = v.clienteCidade || "";
    if (!mapaCidadeValor[cidade]) mapaCidadeValor[cidade] = 0;
    mapaCidadeValor[cidade] += valor;

    const tr = document.createElement("tr");

    const dataTd = document.createElement("td");
    dataTd.textContent = formatarDataBrasil(v.data || "");
    tr.appendChild(dataTd);

    const clienteTd = document.createElement("td");
    clienteTd.textContent = v.clienteNome || "";
    tr.appendChild(clienteTd);

    const produtoTd = document.createElement("td");
    produtoTd.textContent = v.produtoDescricao || "";
    tr.appendChild(produtoTd);

    const qtdTd = document.createElement("td");
    qtdTd.textContent = qtd > 0 ? qtd : "";
    tr.appendChild(qtdTd);

    const unitTd = document.createElement("td");
    if (v.valorUnitario != null) {
      unitTd.textContent = Number(v.valorUnitario).toFixed(2);
    } else {
      unitTd.textContent = "";
    }
    tr.appendChild(unitTd);

    const totalTd = document.createElement("td");
    totalTd.textContent = valor.toFixed(2);
    tr.appendChild(totalTd);

    const loteTd = document.createElement("td");
    loteTd.textContent = v.lote || "";
    tr.appendChild(loteTd);

    const nfTd = document.createElement("td");
    nfTd.textContent = v.numeroNota || "";
    tr.appendChild(nfTd);

    const formaTd = document.createElement("td");
    formaTd.textContent = v.formaDescricao || "";
    tr.appendChild(formaTd);

    const acaoTd = document.createElement("td");
    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir";
    btnExcluir.className = "btn-small btn-danger";
    btnExcluir.addEventListener("click", () => excluirVenda(v.id));
    acaoTd.appendChild(btnExcluir);
    tr.appendChild(acaoTd);

    salesTbody.appendChild(tr);
  });

  salesTotalLabel.textContent = `R$ ${totalValor.toFixed(2)}`;

  kpiTotalVendas.textContent = `R$ ${totalValor.toFixed(2)}`;
  kpiQtdVendida.textContent = String(totalQtd);
  kpiNumVendas.textContent = String(totalPedidos);

  let topCliente = "—";
  let topClienteValor = 0;
  for (const nome in mapaClienteValor) {
    if (mapaClienteValor[nome] > topClienteValor) {
      topClienteValor = mapaClienteValor[nome];
      topCliente = nome;
    }
  }
  kpiTopCliente.textContent =
    topCliente === "—"
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
  kpiTopProduto.textContent =
    topProduto === "—"
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
  kpiTopCidade.textContent =
    topCidade === "—"
      ? "—"
      : `${topCidade} (R$ ${topCidadeValor.toFixed(2)})`;

  atualizarTabelasDetalhe(
    mapaProdutoQtd,
    mapaProdutoValor,
    mapaFormaValor,
    mapaCidadeValor,
    totalValor
  );

  // ====== KPIs de comparação (período anterior equivalente) ======
  const startAtual = filterStartInput.value;
  const endAtual = filterEndInput.value;
  const periodoPrevComp = obterPeriodoAnteriorEquivalente(startAtual, endAtual);

  if (periodoPrevComp.prevStart && periodoPrevComp.prevEnd) {
    const vendasPrev = aplicarFiltrosEmMemoriaPeriodo(
      periodoPrevComp.prevStart,
      periodoPrevComp.prevEnd
    );

    const metAtual = calcularMetricasComparacao(vendasFiltradas);
    const metPrev = calcularMetricasComparacao(vendasPrev);

    atualizarKPIsComparacao(metAtual, metPrev);
  } else {
    limparKPIsComparacao();
  }

  // Atualiza os gráficos com base nas vendas filtradas
  atualizarGraficoFaturamentoMensal(vendasFiltradas);
  atualizarGraficoDistribuicaoProdutos(mapaProdutoQtd);
}

async function excluirVenda(vendaId) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir esta venda?"
  );
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

// ===== Exportar CSV (vendas filtradas) =====
exportCsvButton.addEventListener("click", () => {
  const filtradas = aplicarFiltrosEmMemoria();

  if (filtradas.length === 0) {
    alert("Não há vendas filtradas para exportar.");
    return;
  }

  const linhas = [];

  const cabecalho = [
    "Data",
    "Cliente",
    "ClienteId",
    "Produto",
    "ProdutoId",
    "FormaPagamento",
    "FormaId",
    "Quantidade",
    "ValorUnitario",
    "ValorTotal",
    "Lote",
    "NumeroNota",
    "PedidoChave"
  ].join(";");
  linhas.push(cabecalho);

  filtradas.forEach((v) => {
    const linha = [
      csvValue(formatarDataBrasil(v.data || "")),
      csvValue(v.clienteNome || ""),
      csvValue(v.clienteId || ""),
      csvValue(v.produtoDescricao || ""),
      csvValue(v.produtoId || ""),
      csvValue(v.formaDescricao || ""),
      csvValue(v.formaId || ""),
      csvValue(v.quantidade != null ? v.quantidade : ""),
      csvValue(
        v.valorUnitario != null ? v.valorUnitario.toFixed(2) : ""
      ),
      csvValue(
        v.valorTotal != null ? v.valorTotal.toFixed(2) : ""
      ),
      csvValue(v.lote || ""),
      csvValue(v.numeroNota || ""),
      csvValue(v.pedidoChave || "")
    ].join(";");
    linhas.push(linha);
  });

  const csvContent = linhas.join("\n");
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;"
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const fileName = `vendas_filtradas_${hoje}.csv`;

  if (navigator.msSaveBlob) {
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

// ===== Filtros de vendas =====
applyFilterButton.addEventListener("click", async () => {
  // Agora: ao aplicar, rebusca do Firebase (garante pegar tudo do período)
  await carregarUltimasVendas();
});

clearFilterButton.addEventListener("click", async () => {
  // Limpa filtros e volta ao mês atual automaticamente
  filterStartInput.value = "";
  filterEndInput.value = "";
  filterClientSelect.value = "";
  filterProductSelect.value = "";
  filterFormaSelect.value = "";
  if (filterNfSelect) filterNfSelect.value = "";

  await carregarUltimasVendas();
});

// ===== Salvar venda (grava TODOS os itens do pedido) =====
saveSaleButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    saleMessage.textContent = "Você precisa estar logado para salvar.";
    saleMessage.className = "msg error";
    return;
  }

  const dataStr = saleDateInput.value;
  const clienteId = saleClientSelect.value;
  const formaId = salePaymentSelect.value;

  let numeroNota = (saleNfNumberInput.value || "").trim();

  // Limite de tamanho
  if (numeroNota.length > 10) numeroNota = numeroNota.slice(0, 10);
  saleNfNumberInput.value = numeroNota;

  saleMessage.textContent = "";
  saleMessage.className = "msg";

  if (!dataStr || !clienteId || !formaId) {
    saleMessage.textContent =
      "Informe data, cliente e forma de pagamento.";
    saleMessage.className = "msg error";
    return;
  }

  // Garante pelo menos um item: se não tiver na lista, tenta pegar o que está nos campos
  let itensParaSalvar = [...itensPedido];

  if (itensParaSalvar.length === 0) {
    const produtoId = saleProductSelect.value;
    const quantidade = Number(saleQuantityInput.value || 0);
    const valorUnitario = Number(saleUnitPriceInput.value || 0);
    let lote = (saleLoteInput.value || "").trim();

    if (produtoId && quantidade > 0 && valorUnitario > 0) {
      if (lote.length > 8) {
        lote = lote.slice(0, 8);
        saleLoteInput.value = lote;
      }

      const produto = produtosMap[produtoId] || {};
      itensParaSalvar.push({
        produtoId,
        produtoDescricao: produto.descricao || "Produto",
        lote,
        quantidade,
        valorUnitario
      });
    }
  }

  if (itensParaSalvar.length === 0) {
    saleMessage.textContent =
      "Adicione pelo menos um item ao pedido antes de salvar.";
    saleMessage.className = "msg error";
    return;
  }

  const cliente = clientesMap[clienteId] || {};
  const forma = formasMap[formaId] || {};

  const pedidoChave = [
    dataStr || "",
    clienteId || "",
    formaId || "",
    numeroNota || ""
  ].join("|");

  try {
    const dataTimestamp = new Date(dataStr).getTime();

    // Salva cada item e, se tiver lote com estoque, dá baixa
    for (const item of itensParaSalvar) {
      const produto = produtosMap[item.produtoId] || {};
      const quantidade = Number(item.quantidade || 0);
      const valorUnitario = Number(item.valorUnitario || 0);
      const valorTotal = quantidade * valorUnitario;
      const lote = item.lote || "";

      // 1) Salva a venda do item
      await db.collection("vendas").add({
        usuarioId: user.uid,
        data: dataStr, // continua salvo em ISO (aaaa-mm-dd)
        dataTimestamp,
        clienteId,
        clienteNome: cliente.nome || "",
        clienteCidade: cliente.cidade || "",
        produtoId: item.produtoId,
        produtoDescricao: produto.descricao || "",
        quantidade,
        valorUnitario,
        valorTotal,
        lote,
        numeroNota,
        formaId,
        formaDescricao: forma.descricao || "",
        pedidoChave,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 2) Integração com estoque:
      //    se existir o lote em estoque, faz SAÍDA automática
      if (
        lote &&
        typeof obterSaldoEstoque === "function" &&
        typeof ajustarSaldoEstoque === "function"
      ) {
        try {
          const saldoAtual = await obterSaldoEstoque(
            item.produtoId,
            lote
          );

          // só tenta baixar se tiver saldo positivo
          if (saldoAtual > 0) {
            await ajustarSaldoEstoque(
              item.produtoId,
              lote,
              produto.descricao || "",
              -quantidade
            );
          }
        } catch (e) {
          console.error("Erro ao atualizar estoque na venda:", e);
        }
      }
    }

    saleMessage.textContent = "Venda salva com sucesso!";
    saleMessage.className = "msg ok";

    // Limpa tudo para próximo pedido
    itensPedido = [];
    renderizarItensPedido();

    saleDateInput.value = "";
    saleClientSelect.value = "";
    salePaymentSelect.value = "";
    saleNfNumberInput.value = "";
    saleProductSelect.value = "";
    saleLoteInput.value = "";
    saleQuantityInput.value = "1";
    saleUnitPriceInput.value = "";
    saleTotalInput.value = "";

    await carregarUltimasVendas();

    // Atualiza a tela de estoque, se a função existir
    if (typeof carregarEstoqueSaldos === "function") {
      try {
        await carregarEstoqueSaldos();
      } catch (e) {
        console.error(
          "Erro ao atualizar saldos de estoque após venda:",
          e
        );
      }
    }
  } catch (e) {
    console.error("Erro ao salvar venda:", e);
    saleMessage.textContent = "Erro ao salvar venda.";
    saleMessage.className = "msg error";
  }
});
