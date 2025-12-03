// js/despesas.js

// Map global de fornecedores
window.fornecedoresMap = window.fornecedoresMap || {};
let despesasCache = [];

// Referências da parte de fornecedores
const fornNomeInput        = document.getElementById("forn-nome");
const btnSaveFornecedor    = document.getElementById("btn-save-fornecedor");
const fornMessage          = document.getElementById("forn-message");
const fornecedoresTbody    = document.getElementById("fornecedores-tbody");

// Referências da parte de despesas
const despFornecedorSelect = document.getElementById("desp-fornecedor");
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
// Util: atualizar total da despesa (qtd x valor unitário)
// ----------------------
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
// Formas de pagamento no select de despesas
// Usa o mesmo formasMap já usado nas vendas
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
// Despesas
// ----------------------
async function carregarDespesas() {
  if (!despesasTbody || !db) return;

  despesasTbody.innerHTML =
    '<tr><td colspan="9">Carregando...</td></tr>';
  despesasCache = [];

  try {
    const snap = await db
      .collection("despesas")
      .orderBy("dataPagamentoTimestamp", "desc")
      .limit(100)
      .get();

    if (snap.empty) {
      despesasTbody.innerHTML =
        '<tr><td colspan="9">Nenhuma despesa lançada.</td></tr>';
      return;
    }

    snap.forEach((doc) => {
      const d = doc.data();
      despesasCache.push({ id: doc.id, ...d });
    });

    renderizarDespesas();
  } catch (e) {
    console.error("Erro ao carregar despesas:", e);
    despesasTbody.innerHTML =
      '<tr><td colspan="9">Erro ao carregar despesas.</td></tr>';
  }
}

function renderizarDespesas() {
  if (!despesasTbody) return;

  if (!despesasCache || despesasCache.length === 0) {
    despesasTbody.innerHTML =
      '<tr><td colspan="9">Nenhuma despesa lançada.</td></tr>';
    return;
  }

  despesasTbody.innerHTML = "";

  despesasCache.forEach((d) => {
    const tr = document.createElement("tr");

    const tdData = document.createElement("td");
    tdData.textContent = d.dataPagamento || "";
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
    tdVTotal.textContent =
      d.valorTotal != null
        ? Number(d.valorTotal).toFixed(2)
        : "";
    tr.appendChild(tdVTotal);

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
}

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
    !marca ||
    !dataPag ||
    quantidade <= 0 ||
    valorUnit <= 0 ||
    valorTotal <= 0 ||
    !formaId
  ) {
    if (despMessage) {
      despMessage.textContent =
        "Preencha fornecedor, quantidade, descrição, marca, data, valores e forma de pagamento.";
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
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (despMessage) {
      despMessage.textContent = "Despesa salva com sucesso!";
      despMessage.className = "msg ok";
    }

    // limpa campos
    despFornecedorSelect.value = "";
    if (despQtdInput) despQtdInput.value = "1";
    if (despDescInput) despDescInput.value = "";
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
