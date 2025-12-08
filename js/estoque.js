// js/estoque.js

// Saldos em memória (opcional)
let estoqueSaldosCache = [];

// Gráfico de estoque por produto (Chart.js)
let estoqueChart = null;

// Referências de estoque
const estProdutoSelect   = document.getElementById("est-produto");
const estLoteInput       = document.getElementById("est-lote");
const estValidadeInput   = document.getElementById("est-validade");
const estCodBarrasInput  = document.getElementById("est-cod-barras");
const estQuantidadeInput = document.getElementById("est-quantidade");
const estTipoSelect      = document.getElementById("est-tipo");
const estDataInput       = document.getElementById("est-data");
const estSaveButton      = document.getElementById("btn-save-estoque");
const estCancelButton    = document.getElementById("btn-cancel-estoque");
const estMessage         = document.getElementById("est-message");
const estoqueSaldosTbody = document.getElementById("estoque-saldos-tbody");

// ===== CONTROLE DE EDIÇÃO (igual clientes/produtos) =====
let editingEstoqueId = null;    // id do doc na coleção "estoque"
let editingEstoqueData = null;  // dados atuais do saldo

// =============================
// Helper para formatar data no padrão brasileiro (dd/mm/aaaa)
// =============================
function formatarDataBrasil(dataIso) {
  if (!dataIso) return "";
  const partes = dataIso.split("-");
  if (partes.length !== 3) return dataIso;
  const [ano, mes, dia] = partes;
  return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
}

// =============================
// Preencher produtos no select de estoque
// =============================
function preencherProdutosEstoque() {
  if (!estProdutoSelect) return;
  if (typeof produtosMap === "undefined" || !produtosMap) return;

  let html = '<option value="">Selecione um produto</option>';

  Object.keys(produtosMap).forEach((id) => {
    const p = produtosMap[id] || {};
    const desc = p.descricao || "Produto";
    html += `<option value="${id}">${desc}</option>`;
  });

  estProdutoSelect.innerHTML = html;
}

// =============================
// Auto-preencher código de barras ao selecionar produto
// =============================
function configurarAutoPreenchimentoCodigoBarras() {
  if (!estProdutoSelect || !estCodBarrasInput) return;

  estProdutoSelect.addEventListener("change", () => {
    const produtoId = estProdutoSelect.value;

    if (!produtoId || !produtosMap || !produtosMap[produtoId]) {
      // se limpar o select, limpa o campo também
      estCodBarrasInput.value = "";
      return;
    }

    const produto = produtosMap[produtoId] || {};
    estCodBarrasInput.value = produto.codigoBarras || "";
  });
}

// chama logo ao carregar o arquivo
configurarAutoPreenchimentoCodigoBarras();

// =============================
// Helpers de saldo no Firestore
// coleção: "estoque"
// docId = produtoId__LOTE ou produtoId__SEMLOTE
// =============================
async function obterSaldoEstoque(produtoId, lote) {
  const docId = `${produtoId}__${lote || "SEMLOTE"}`;
  const ref = db.collection("estoque").doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return 0;
  const dados = snap.data();
  return Number(dados.quantidade || 0);
}

async function ajustarSaldoEstoque(
  produtoId,
  lote,
  produtoDescricao,
  deltaQuantidade,
  dataValidade,
  codigoBarras
) {
  const docId = `${produtoId}__${lote || "SEMLOTE"}`;
  const ref = db.collection("estoque").doc(docId);

  const snap = await ref.get();
  const dadosAtuais = snap.exists ? snap.data() : {};
  const atual = snap.exists ? Number(dadosAtuais.quantidade || 0) : 0;
  const novo  = atual + deltaQuantidade;

  // Se zerar ou ficar negativo, remove o documento -> some da listagem
  if (novo <= 0) {
    if (snap.exists) {
      await ref.delete();
    }
    return;
  }

  // Se não vier validade/código novos, mantém os antigos
  const novaValidade = dataValidade || dadosAtuais.dataValidade || "";
  const novoCodigo   = codigoBarras || dadosAtuais.codigoBarras || "";

  // Atualiza / cria com o novo saldo
  await ref.set(
    {
      produtoId,
      produtoDescricao: produtoDescricao || "",
      lote: lote || "",
      dataValidade: novaValidade,    // continua salvo em ISO (aaaa-mm-dd)
      codigoBarras: novoCodigo,
      quantidade: novo,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

// Disponibiliza globalmente para vendas.js / ui.js
window.preencherProdutosEstoque = preencherProdutosEstoque;
window.obterSaldoEstoque        = obterSaldoEstoque;
window.ajustarSaldoEstoque      = ajustarSaldoEstoque;

// =============================
// GRÁFICO: Estoque total por produto (somando todos os lotes)
// =============================
function atualizarGraficoEstoque() {
  // Se Chart.js não estiver carregado ou não houver canvas, não faz nada
  if (typeof Chart === "undefined") return;
  const canvas = document.getElementById("chart-estoque-produtos");
  if (!canvas) return;

  // Monta mapa Produto -> soma das quantidades
  const mapa = {};
  (estoqueSaldosCache || []).forEach((reg) => {
    if (!reg) return;
    const nome = (reg.produtoDescricao || "").trim();
    const qtd = Number(reg.quantidade || 0);
    if (!nome || isNaN(qtd) || qtd <= 0) return;
    mapa[nome] = (mapa[nome] || 0) + qtd;
  });

  const labels = Object.keys(mapa);
  const valores = labels.map((nome) => mapa[nome]);

  // Se não tem dados, limpa o gráfico se existir
  if (!labels.length) {
    if (estoqueChart) {
      estoqueChart.destroy();
      estoqueChart = null;
    }
    return;
  }

  const ctx = canvas.getContext("2d");

  if (estoqueChart) {
    // Atualiza gráfico existente
    estoqueChart.data.labels = labels;
    estoqueChart.data.datasets[0].data = valores;
    estoqueChart.update();
  } else {
    // Cria gráfico novo
    estoqueChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Quantidade em estoque (unidades)",
            data: valores,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Produto",
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Quantidade",
            },
          },
        },
      },
    });
  }
}

// =============================
// ENTRAR EM MODO EDIÇÃO (quando clica em "Editar" na tabela)
// =============================
function entrarModoEdicaoEstoque(reg) {
  editingEstoqueId = reg.id;
  editingEstoqueData = reg;

  if (estProdutoSelect) {
    estProdutoSelect.value = reg.produtoId || "";
    estProdutoSelect.disabled = true; // não muda produto na edição
  }
  if (estLoteInput) {
    estLoteInput.value = reg.lote || "";
    estLoteInput.disabled = true;    // não muda lote na edição
  }
  if (estValidadeInput) {
    estValidadeInput.value = reg.dataValidade || "";
  }
  if (estCodBarrasInput) {
    estCodBarrasInput.value = reg.codigoBarras || "";
  }
  if (estQuantidadeInput) {
    estQuantidadeInput.value = Number(reg.quantidade || 0);
  }
  if (estTipoSelect) {
    estTipoSelect.value = "ENTRADA";
    estTipoSelect.disabled = true; // edição ignora tipo (vamos ajustar direto o saldo)
  }

  if (estMessage) {
    estMessage.textContent =
      'Editando saldo. Faça as alterações e clique em "Atualizar estoque" ou em "Cancelar edição".';
    estMessage.className = "msg";
  }

  if (estSaveButton) {
    estSaveButton.textContent = "Atualizar estoque";
  }
  if (estCancelButton) {
    estCancelButton.classList.remove("hidden");
  }
}

// =============================
// CANCELAR EDIÇÃO
// =============================
function cancelarEdicaoEstoque() {
  editingEstoqueId = null;
  editingEstoqueData = null;

  if (estProdutoSelect) {
    estProdutoSelect.disabled = false;
    estProdutoSelect.value = "";
  }
  if (estLoteInput) {
    estLoteInput.disabled = false;
    estLoteInput.value = "";
  }
  if (estValidadeInput) estValidadeInput.value = "";
  if (estCodBarrasInput) estCodBarrasInput.value = "";
  if (estQuantidadeInput) estQuantidadeInput.value = "1";

  if (estTipoSelect) {
    estTipoSelect.disabled = false;
    estTipoSelect.value = "ENTRADA";
  }

  if (estDataInput && !estDataInput.value) {
    estDataInput.value = new Date().toISOString().substring(0, 10);
  }

  if (estSaveButton) {
    estSaveButton.textContent = "Salvar movimento";
  }
  if (estCancelButton) {
    estCancelButton.classList.add("hidden");
  }

  if (estMessage) {
    estMessage.textContent = "";
    estMessage.className = "msg";
  }
}

if (estCancelButton) {
  estCancelButton.addEventListener("click", cancelarEdicaoEstoque);
}

// =============================
// EXCLUIR SALDO (botão Excluir na tabela)
// =============================
async function excluirSaldoEstoque(reg) {
  const confirmar = window.confirm(
    `Deseja realmente excluir o estoque de "${reg.produtoDescricao || ""}" lote "${reg.lote || ""}"?`
  );
  if (!confirmar) return;

  try {
    await db.collection("estoque").doc(reg.id).delete();
    if (editingEstoqueId === reg.id) {
      cancelarEdicaoEstoque();
    }
    await carregarEstoqueSaldos();
  } catch (e) {
    console.error("Erro ao excluir estoque:", e);
    if (estMessage) {
      estMessage.textContent = "Erro ao excluir estoque.";
      estMessage.className = "msg error";
    }
  }
}

// =============================
// Carregar saldos para a tabela
// =============================
async function carregarEstoqueSaldos() {
  if (!estoqueSaldosTbody || !db) return;

  estoqueSaldosTbody.innerHTML =
    '<tr><td colspan="6">Carregando...</td></tr>';
  estoqueSaldosCache = [];

  try {
    // Ordena pela data de validade (do que vence primeiro para o último)
    const snap = await db.collection("estoque")
      .orderBy("dataValidade")
      .get();

    if (snap.empty) {
      estoqueSaldosTbody.innerHTML =
        '<tr><td colspan="6">Nenhum dado de estoque.</td></tr>';
      estoqueSaldosCache = [];
      atualizarGraficoEstoque();
      return;
    }

    estoqueSaldosTbody.innerHTML = "";

    snap.forEach((doc) => {
      const d = doc.data();
      const qtd = Number(d.quantidade || 0);

      // Se ainda existir registro com 0 ou negativo, não mostra
      if (qtd <= 0) {
        return;
      }

      const reg = { id: doc.id, ...d };
      estoqueSaldosCache.push(reg);

      const tr = document.createElement("tr");

      // Produto
      const tdProd = document.createElement("td");
      tdProd.textContent = d.produtoDescricao || "";
      tr.appendChild(tdProd);

      // Lote
      const tdLote = document.createElement("td");
      tdLote.textContent = d.lote || "";
      tr.appendChild(tdLote);

      // Validade
      const tdVal = document.createElement("td");
      tdVal.textContent = formatarDataBrasil(d.dataValidade || "");
      tr.appendChild(tdVal);

      // Código de barras
      const tdCod = document.createElement("td");
      tdCod.textContent = d.codigoBarras || "";
      tr.appendChild(tdCod);

      // Quantidade
      const tdQtd = document.createElement("td");
      tdQtd.textContent = qtd.toString();
      tr.appendChild(tdQtd);

      // Ações
      const tdAcoes = document.createElement("td");

      const btnEditar = document.createElement("button");
      btnEditar.textContent = "Editar";
      btnEditar.className = "btn-small";
      btnEditar.addEventListener("click", () => entrarModoEdicaoEstoque(reg));
      tdAcoes.appendChild(btnEditar);

      const btnExcluir = document.createElement("button");
      btnExcluir.textContent = "Excluir";
      btnExcluir.className = "btn-small btn-danger";
      btnExcluir.style.marginLeft = "4px";
      btnExcluir.addEventListener("click", () => excluirSaldoEstoque(reg));
      tdAcoes.appendChild(btnExcluir);

      tr.appendChild(tdAcoes);

      estoqueSaldosTbody.appendChild(tr);
    });

    // Se depois de filtrar não sobrou nada, mostra mensagem
    if (!estoqueSaldosTbody.hasChildNodes()) {
      estoqueSaldosTbody.innerHTML =
        '<tr><td colspan="6">Nenhum dado de estoque.</td></tr>';
    }

    // Atualiza gráfico sempre que recarregar saldos
    atualizarGraficoEstoque();
  } catch (e) {
    console.error("Erro ao carregar saldos de estoque:", e);
    estoqueSaldosTbody.innerHTML =
      '<tr><td colspan="6">Erro ao carregar saldos.</td></tr>';
    estoqueSaldosCache = [];
    atualizarGraficoEstoque();
  }
}

window.carregarEstoqueSaldos = carregarEstoqueSaldos;

// =============================
// Salvar movimento de estoque / Atualizar saldo (edição)
// =============================
async function salvarMovimentoEstoqueManual() {
  if (!estProdutoSelect || !db) return;

  const user = auth?.currentUser;
  if (!user) {
    if (estMessage) {
      estMessage.textContent = "Você precisa estar logado para salvar.";
      estMessage.className = "msg error";
    }
    return;
  }

  const produtoId    = estProdutoSelect.value;
  let lote           = (estLoteInput?.value || "").trim();
  const dataValidade = estValidadeInput?.value || "";
  const codigoBarras = (estCodBarrasInput?.value || "").trim();
  const quantidade   = Number(estQuantidadeInput?.value || 0);
  const tipo         = estTipoSelect?.value || "ENTRADA";
  let dataStr        = estDataInput?.value || "";

  if (!dataStr) {
    dataStr = new Date().toISOString().substring(0, 10);
    if (estDataInput) estDataInput.value = dataStr;
  }

  // Limita lote em 8 caracteres (mesma regra da venda)
  if (lote.length > 8) {
    lote = lote.slice(0, 8);
    if (estLoteInput) estLoteInput.value = lote;
  }

  if (estMessage) {
    estMessage.textContent = "";
    estMessage.className = "msg";
  }

  if (!produtoId || quantidade <= 0) {
    if (estMessage) {
      estMessage.textContent =
        "Selecione o produto e informe quantidade maior que zero.";
      estMessage.className = "msg error";
    }
    return;
  }

  const produto = produtosMap[produtoId] || {};
  const produtoDescricao = produto.descricao || "Produto";

  const emEdicao = !!editingEstoqueId;

  try {
    if (emEdicao && editingEstoqueData) {
      // ======== ATUALIZANDO UM SALDO EXISTENTE ========
      const produtoIdOrig = editingEstoqueData.produtoId;
      const loteOrig      = editingEstoqueData.lote || "";

      const saldoAtual = await obterSaldoEstoque(produtoIdOrig, loteOrig);
      const novaQtd    = quantidade;
      const delta      = novaQtd - saldoAtual; // ajusta direto pro novo valor

      await ajustarSaldoEstoque(
        produtoIdOrig,
        loteOrig,
        editingEstoqueData.produtoDescricao || produtoDescricao,
        delta,
        dataValidade || editingEstoqueData.dataValidade || "",
        codigoBarras || editingEstoqueData.codigoBarras || ""
      );

      if (estMessage) {
        estMessage.textContent = "Saldo de estoque atualizado com sucesso!";
        estMessage.className = "msg ok";
      }

      cancelarEdicaoEstoque();
      await carregarEstoqueSaldos();
    } else {
      // ======== NOVO MOVIMENTO (ENTRADA / SAÍDA) ========
      const dataTimestamp = new Date(dataStr).getTime();

      // Define o sinal do movimento (agora só ENTRADA ou SAIDA)
      let delta = quantidade;
      if (tipo === "SAIDA") {
        delta = -quantidade;
      }

      // Para movimentos negativos, valida se não vai ficar negativo
      if (delta < 0) {
        try {
          const saldoAtual = await obterSaldoEstoque(produtoId, lote);
          if (saldoAtual + delta < 0) {
            if (estMessage) {
              estMessage.textContent =
                `Movimento deixaria o estoque negativo (saldo atual: ${saldoAtual}).`;
              estMessage.className = "msg error";
            }
            return;
          }
        } catch (e) {
          console.error("Erro ao verificar saldo antes do ajuste:", e);
          if (estMessage) {
            estMessage.textContent =
              "Erro ao verificar saldo de estoque para ajuste.";
            estMessage.className = "msg error";
          }
          return;
        }
      }

      // Ajusta saldo principal (e apaga doc se zerar)
      await ajustarSaldoEstoque(
        produtoId,
        lote,
        produtoDescricao,
        delta,
        dataValidade,
        codigoBarras
      );

      // (Opcional) registrar log de movimento em uma coleção separada
      // await db.collection("estoque_movimentos").add({
      //   usuarioId: user.uid,
      //   produtoId,
      //   produtoDescricao,
      //   lote,
      //   dataValidade,
      //   codigoBarras,
      //   quantidade,
      //   tipo,
      //   data: dataStr,
      //   dataTimestamp,
      //   criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      // });

      if (estMessage) {
        estMessage.textContent = "Movimento de estoque salvo com sucesso!";
        estMessage.className = "msg ok";
      }

      // Limpa campos básicos
      estProdutoSelect.value = "";
      if (estLoteInput) estLoteInput.value = "";
      if (estValidadeInput) estValidadeInput.value = "";
      if (estCodBarrasInput) estCodBarrasInput.value = "";
      if (estQuantidadeInput) estQuantidadeInput.value = "1";
      if (estTipoSelect) estTipoSelect.value = "ENTRADA";

      await carregarEstoqueSaldos();
    }
  } catch (e) {
    console.error("Erro ao salvar movimento de estoque:", e);
    if (estMessage) {
      estMessage.textContent = "Erro ao salvar movimento de estoque.";
      estMessage.className = "msg error";
    }
  }
}

if (estSaveButton) {
  estSaveButton.addEventListener("click", salvarMovimentoEstoqueManual);
}

// Ajusta data padrão ao carregar
if (estDataInput && !estDataInput.value) {
  estDataInput.value = new Date().toISOString().substring(0, 10);
}

// Ao carregar o arquivo, se já existirem produtos no mapa, preenche o select
if (estProdutoSelect && typeof produtosMap !== "undefined" && produtosMap) {
  preencherProdutosEstoque();
}
