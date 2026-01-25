// js/cadastros.js

// Campo extra de código de barras do produto (input da aba Produtos)
const prodCodBarrasInput = document.getElementById("prod-cod-barras");

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
    preco: data.precoUnitario || 0,
    codigoBarras: data.codigoBarras || "" // NOVO CAMPO
  })).sort((a, b) => a.descricao.localeCompare(b.descricao));

  if (entries.length === 0) {
    // agora são 5 colunas: descrição, peso, preço, código, ações
    produtosTbody.innerHTML = '<tr><td colspan="5">Nenhum produto cadastrado.</td></tr>';
    return;
  }

  entries.forEach(p => {
    const tr = document.createElement("tr");

    const tdDesc = document.createElement("td");
    tdDesc.textContent = p.descricao;
    tr.appendChild(tdDesc);

    const tdPeso = document.createElement("td");
    tdPeso.textContent = p.peso;
    tr.appendChild(tdPeso);

    const tdPreco = document.createElement("td");
    tdPreco.textContent = p.preco.toFixed(2);
    tr.appendChild(tdPreco);

    // coluna de código de barras
    const tdCod = document.createElement("td");
    tdCod.textContent = p.codigoBarras || "";
    tr.appendChild(tdCod);

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

    // garante que o select do estoque seja atualizado com os produtos carregados
    if (typeof preencherProdutosEstoque === "function") {
      preencherProdutosEstoque();
    }
  } catch (e) {
    console.error("Erro ao carregar produtos:", e);
    saleProductSelect.innerHTML = '<option value="">Erro ao carregar produtos</option>';
    filterProductSelect.innerHTML = '<option value="">Erro ao carregar produtos</option>';
    produtosTbody.innerHTML = '<tr><td colspan="5">Erro ao carregar produtos.</td></tr>';
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

    // ✅ Mantém o select de "Lançamento de despesas" sempre sincronizado
    // (ele usa o mesmo formasMap; ao recarregar as formas aqui,
    // atualiza automaticamente o select da tela de despesas.)
    if (typeof preencherFormasPagamentoDespesas === "function") {
      preencherFormasPagamentoDespesas();
    }
  } catch (e) {
    console.error("Erro ao carregar formas de pagamento:", e);
    salePaymentSelect.innerHTML = '<option value="">Erro ao carregar formas</option>';
    filterFormaSelect.innerHTML = '<option value="">Erro ao carregar formas</option>';
    formasTbody.innerHTML = '<tr><td colspan="2">Erro ao carregar formas de pagamento.</td></tr>';
  }
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
  // Após o agrupamento em "Cadastros", editar precisa manter a aba principal
  // "Cadastros" ativa e selecionar a sub-aba correta.
  setActiveSection("cadastros");
  if (typeof setCadastrosSubtab === "function") {
    setCadastrosSubtab("clientes");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoCliente() {
  editingClienteId = null;
  cliNomeInput.value = "";
  cliCidadeInput.value = "";
  saveClienteButton.textContent = "Salvar cliente";
  cancelClienteButton.classList.add("hidden");
  cliMessage.textContent = "";
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
  if (prodCodBarrasInput) {
    prodCodBarrasInput.value = atual.codigoBarras || "";
  }

  editingProdutoId = id;
  saveProdutoButton.textContent = "Atualizar produto";
  cancelProdutoButton.classList.remove("hidden");
  prodMessage.textContent = "Editando produto. Faça as alterações e clique em Atualizar.";
  prodMessage.className = "msg";
  setActiveSection("cadastros");
  if (typeof setCadastrosSubtab === "function") {
    setCadastrosSubtab("produtos");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoProduto() {
  editingProdutoId = null;
  prodDescInput.value = "";
  prodPesoInput.value = "";
  prodPrecoInput.value = "";
  if (prodCodBarrasInput) {
    prodCodBarrasInput.value = "";
  }
  saveProdutoButton.textContent = "Salvar produto";
  cancelProdutoButton.classList.add("hidden");
  prodMessage.textContent = "";
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
  setActiveSection("cadastros");
  if (typeof setCadastrosSubtab === "function") {
    setCadastrosSubtab("formas");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoForma() {
  editingFormaId = null;
  fpDescInput.value = "";
  saveFormaButton.textContent = "Salvar forma de pagamento";
  cancelFormaButton.classList.add("hidden");
  fpMessage.textContent = "";
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
  const descricao = prodDescInput.value.trim();
  const peso = Number(prodPesoInput.value || 0);
  const preco = Number(prodPrecoInput.value || 0);
  const codBarras = prodCodBarrasInput ? prodCodBarrasInput.value.trim() : "";

  prodMessage.textContent = "";
  prodMessage.className = "msg";

  if (!descricao) {
    prodMessage.textContent = "Informe a descrição do produto.";
    prodMessage.className = "msg error";
    return;
  }
  if (peso <= 0) {
    prodMessage.textContent = "Informe um peso maior que zero.";
    prodMessage.className = "msg error";
    return;
  }
  if (preco <= 0) {
    prodMessage.textContent = "Informe um preço unitário maior que zero.";
    prodMessage.className = "msg error";
    return;
  }

  try {
    if (editingProdutoId) {
      await db.collection("produtos").doc(editingProdutoId).update({
        descricao,
        pesoGramas: peso,
        precoUnitario: preco,
        codigoBarras: codBarras || null
      });
      prodMessage.textContent = "Produto atualizado com sucesso!";
      prodMessage.className = "msg ok";
      cancelarEdicaoProduto();
    } else {
      await db.collection("produtos").add({
        descricao,
        pesoGramas: peso,
        precoUnitario: preco,
        codigoBarras: codBarras || null,
        ativo: true,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      prodMessage.textContent = "Produto salvo com sucesso!";
      prodMessage.className = "msg ok";

      prodDescInput.value = "";
      prodPesoInput.value = "";
      prodPrecoInput.value = "";
      if (prodCodBarrasInput) prodCodBarrasInput.value = "";
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
