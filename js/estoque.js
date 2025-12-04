// js/estoque.js

// Saldos em memória (opcional)
let estoqueSaldosCache = [];

// Referências de estoque
const estProdutoSelect   = document.getElementById("est-produto");
const estLoteInput       = document.getElementById("est-lote");
const estQuantidadeInput = document.getElementById("est-quantidade");
const estTipoSelect      = document.getElementById("est-tipo");
const estDataInput       = document.getElementById("est-data");
const estSaveButton      = document.getElementById("btn-save-estoque");
const estMessage         = document.getElementById("est-message");
const estoqueSaldosTbody = document.getElementById("estoque-saldos-tbody");

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

async function ajustarSaldoEstoque(produtoId, lote, produtoDescricao, deltaQuantidade) {
  const docId = `${produtoId}__${lote || "SEMLOTE"}`;
  const ref = db.collection("estoque").doc(docId);

  const snap = await ref.get();
  const atual = snap.exists ? Number(snap.data().quantidade || 0) : 0;
  const novo  = atual + deltaQuantidade;

  // Se zerar ou ficar negativo, remove o documento -> some da listagem
  if (novo <= 0) {
    if (snap.exists) {
      await ref.delete();
    }
    return;
  }

  // Caso contrário, atualiza / cria com o novo saldo
  await ref.set(
    {
      produtoId,
      produtoDescricao: produtoDescricao || "",
      lote: lote || "",
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
// Carregar saldos para a tabela
// =============================
async function carregarEstoqueSaldos() {
  if (!estoqueSaldosTbody || !db) return;

  estoqueSaldosTbody.innerHTML =
    '<tr><td colspan="3">Carregando...</td></tr>';
  estoqueSaldosCache = [];

  try {
    const snap = await db.collection("estoque")
      .orderBy("produtoDescricao")
      .get();

    if (snap.empty) {
      estoqueSaldosTbody.innerHTML =
        '<tr><td colspan="3">Nenhum dado de estoque.</td></tr>';
      return;
    }

    estoqueSaldosTbody.innerHTML = "";

    snap.forEach((doc) => {
      const d = doc.data();
      const qtd = Number(d.quantidade || 0);

      // Se por algum motivo ainda existir registro com 0 ou negativo,
      // não mostra na tabela
      if (qtd <= 0) {
        return;
      }

      estoqueSaldosCache.push({ id: doc.id, ...d });

      const tr = document.createElement("tr");

      const tdProd = document.createElement("td");
      tdProd.textContent = d.produtoDescricao || "";
      tr.appendChild(tdProd);

      const tdLote = document.createElement("td");
      tdLote.textContent = d.lote || "";
      tr.appendChild(tdLote);

      const tdQtd = document.createElement("td");
      tdQtd.textContent = qtd.toString();
      tr.appendChild(tdQtd);

      estoqueSaldosTbody.appendChild(tr);
    });

    // Se depois de filtrar não sobrou nada, mostra mensagem
    if (!estoqueSaldosTbody.hasChildNodes()) {
      estoqueSaldosTbody.innerHTML =
        '<tr><td colspan="3">Nenhum dado de estoque.</td></tr>';
    }
  } catch (e) {
    console.error("Erro ao carregar saldos de estoque:", e);
    estoqueSaldosTbody.innerHTML =
      '<tr><td colspan="3">Erro ao carregar saldos.</td></tr>';
  }
}

window.carregarEstoqueSaldos = carregarEstoqueSaldos;

// =============================
// Salvar movimento manual de estoque
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

  const produtoId  = estProdutoSelect.value;
  let lote         = (estLoteInput?.value || "").trim();
  const quantidade = Number(estQuantidadeInput?.value || 0);
  const tipo       = estTipoSelect?.value || "ENTRADA";
  let dataStr      = estDataInput?.value || "";

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
  const dataTimestamp = new Date(dataStr).getTime();

  // Define o sinal do movimento
  let delta = quantidade;
  if (tipo === "SAIDA" || tipo === "AJUSTE_NEGATIVO") {
    delta = -quantidade;
  } else {
    // ENTRADA ou AJUSTE_POSITIVO
    delta = quantidade;
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

  try {
    // Ajusta saldo principal (e apaga doc se zerar)
    await ajustarSaldoEstoque(produtoId, lote, produtoDescricao, delta);

    // (Opcional) registrar log de movimento em uma coleção
    // await db.collection("estoque_movimentos").add({
    //   usuarioId: user.uid,
    //   produtoId,
    //   produtoDescricao,
    //   lote,
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
    if (estQuantidadeInput) estQuantidadeInput.value = "1";

    await carregarEstoqueSaldos();
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
