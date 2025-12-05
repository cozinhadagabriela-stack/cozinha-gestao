// ====== CONTROLE DE ITENS DO PEDIDO (TELA DE VENDA) ======
let itensPedido = [];

// se não existir, cria o cache de vendas
if (typeof ultimasVendasCache === "undefined") {
  window.ultimasVendasCache = [];
}

const pedidoItensTbody = document.getElementById("pedido-itens-tbody");
const btnAddItem = document.getElementById("btn-add-item");

// ====== FUNÇÕES AUXILIARES (GERAIS) ======

// Formata "aaaa-mm-dd" -> "dd/mm/aaaa"
function formatarDataBrasil(dataIso) {
  if (!dataIso) return "";
  const partes = dataIso.split("-");
  if (partes.length !== 3) return dataIso;
  const [ano, mes, dia] = partes;
  return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
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
    tdQtd.textContent =
      item.quantidade != null ? item.quantidade : "";
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
  if (id && produtosMap[id] && typeof produtosMap[id].precoUnitario === "number") {
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

  kpiProdutosBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  kpiFormasBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  kpiCidadesBody.innerHTML = '<tr><td colspan="2">Sem dados.</td></tr>';
}

function atualizarTabelasDetalhe(
  mapaProdutoQtd,
  mapaProdutoValor,
  mapaFormaValor,
  mapaCidadeValor,
  totalValor
) {
  // Produtos
  const produtoEntries = Object.keys(mapaProdutoQtd).map(desc => ({
    descricao: desc,
    qtd: mapaProdutoQtd[desc] || 0,
    valor: mapaProdutoValor[desc] || 0
  })).sort((a, b) => b.valor - a.valor);

  if (produtoEntries.length === 0) {
    kpiProdutosBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  } else {
    kpiProdutosBody.innerHTML = "";
    produtoEntries.forEach(p => {
      const tr = document.createElement("tr");
      const tdDesc = document.createElement("td");
      tdDesc.textContent = p.descricao;
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
  const formaEntries = Object.keys(mapaFormaValor).map(desc => ({
    descricao: desc,
    valor: mapaFormaValor[desc] || 0
  })).sort((a, b) => b.valor - a.valor);

  if (formaEntries.length === 0) {
    kpiFormasBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
  } else {
    kpiFormasBody.innerHTML = "";
    formaEntries.forEach(f => {
      const tr = document.createElement("tr");
      const tdDesc = document.createElement("td");
      tdDesc.textContent = f.descricao;
      const tdVal = document.createElement("td");
      tdVal.textContent = f.valor.toFixed(2);
      const tdPerc = document.createElement("td");
      tdPerc.textContent = totalValor > 0
        ? ((f.valor / totalValor) * 100).toFixed(1) + "%"
        : "0,0%";
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

// ====== FILTROS EM MEMÓRIA / EXTRATO ======

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

function renderizarVendasFiltradas() {
  // <<< CORREÇÃO AQUI: só chama a função normalmente >>>
  const vendasFiltradas = aplicarFiltrosEmMemoria();

  if (vendasFiltradas.length === 0) {
    salesTbody.innerHTML = '<tr><td colspan="11">Nenhuma venda no filtro.</td></tr>';
    salesTotalLabel.textContent = "R$ 0,00";
    atualizarKPIsVazios();
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

  vendasFiltradas.forEach(v => {
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
        v.numeroNota || "",
        v.serieNota || ""
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
    // EXIBIÇÃO EM FORMATO BRASILEIRO
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
    "SerieNota",
    "PedidoChave"
  ].join(";");
  linhas.push(cabecalho);

  filtradas.forEach(v => {
    const linha = [
      // Data em formato brasileiro no CSV
      csvValue(formatarDataBrasil(v.data || "")),
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
      csvValue(v.serieNota || ""),
      csvValue(v.pedidoChave || "")
    ].join(";");
    linhas.push(linha);
  });

  const csvContent = linhas.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

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
  let serieNota = (saleNfSeriesInput.value || "").trim();

  // Limites de tamanho
  if (numeroNota.length > 10) numeroNota = numeroNota.slice(0, 10);
  if (serieNota.length > 5) serieNota = serieNota.slice(0, 5);
  saleNfNumberInput.value = numeroNota;
  saleNfSeriesInput.value = serieNota;

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
    numeroNota || "",
    serieNota || ""
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
        data: dataStr,              // continua salvo em ISO (aaaa-mm-dd)
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
        serieNota,
        formaId,
        formaDescricao: forma.descricao || "",
        pedidoChave,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 2) Integração com estoque
      if (lote && typeof obterSaldoEstoque === "function" && typeof ajustarSaldoEstoque === "function") {
        try {
          const saldoAtual = await obterSaldoEstoque(item.produtoId, lote);
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
    saleNfSeriesInput.value = "";
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
        console.error("Erro ao atualizar saldos de estoque após venda:", e);
      }
    }
  } catch (e) {
    console.error("Erro ao salvar venda:", e);
    saleMessage.textContent = "Erro ao salvar venda.";
    saleMessage.className = "msg error";
  }
});
