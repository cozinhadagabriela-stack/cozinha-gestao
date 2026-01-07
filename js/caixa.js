// js/caixa.js
// Aba Caixa (manual, independente de vendas)
// - Lançamento mensal do saldo total (manual)
// - Variação automática (diferença para o lançamento anterior)
// - Filtro por ano (2025/2026/...) para tabela e gráficos
// - Validação para impedir data repetida

// ----------------------
// Referências da interface (Caixa)
// ----------------------
const caixaFilterAnoSelect = document.getElementById("caixa-filter-ano");

const caixaDataInput  = document.getElementById("caixa-data");
const caixaValorInput = document.getElementById("caixa-valor");
const caixaObsInput   = document.getElementById("caixa-obs");

const btnSaveCaixa   = document.getElementById("btn-save-caixa");
const btnCancelCaixa = document.getElementById("btn-cancel-caixa");

const caixaMessage = document.getElementById("caixa-message");
const caixaTbody   = document.getElementById("caixa-tbody");

// Charts
let chartCaixaVariacao = null;
let chartCaixaSaldo = null;

// ----------------------
// Estado
// ----------------------
let caixaCache = [];           // [{ id, dataIso, valor, obs }]
let editingCaixaId = null;     // docId (dataIso)
let caixaInitDone = false;

// ----------------------
// Utils
// ----------------------
function caixaPad2(n) {
  return String(n).padStart(2, "0");
}

// Formata "aaaa-mm-dd" -> "dd/mm/aaaa"
function caixaFormatarDataBR(dataIso) {
  if (!dataIso || typeof dataIso !== "string") return "";
  const partes = dataIso.split("-");
  if (partes.length !== 3) return dataIso;
  const [ano, mes, dia] = partes;
  return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
}

function caixaFormatarMoedaBR(valor) {
  const num = Number(valor || 0);
  // mantém padrão do app (R$ 0,00)
  return "R$ " + num.toFixed(2).replace(".", ",");
}

function caixaShowMsg(texto, tipo) {
  if (!caixaMessage) return;
  caixaMessage.textContent = texto || "";
  caixaMessage.className = "msg";
  if (tipo === "ok") caixaMessage.classList.add("ok");
  if (tipo === "error") caixaMessage.classList.add("error");
}

function caixaClearMsg() {
  caixaShowMsg("", "");
}

function caixaGetSelectedAno() {
  if (!caixaFilterAnoSelect) return "all";
  return (caixaFilterAnoSelect.value || "all").trim();
}

function caixaSetDefaultDateIfEmpty() {
  if (!caixaDataInput) return;
  if (caixaDataInput.value) return;
  const hoje = new Date();
  const iso = `${hoje.getFullYear()}-${caixaPad2(hoje.getMonth() + 1)}-${caixaPad2(hoje.getDate())}`;
  caixaDataInput.value = iso;
}

// ----------------------
// Carregar / Renderizar
// ----------------------
async function carregarCaixa() {
  try {
    caixaCache = [];
    const snap = await db.collection("caixa").orderBy("dataIso").get();
    snap.forEach((doc) => {
      const d = doc.data() || {};
      caixaCache.push({
        id: doc.id,
        dataIso: d.dataIso || doc.id,
        valor: Number(d.valor || 0),
        obs: d.obs || ""
      });
    });

    // Ordena por data
    caixaCache.sort((a, b) => (a.dataIso || "").localeCompare(b.dataIso || ""));

    preencherFiltroAnoCaixa();
    renderCaixaTable();
    renderCaixaCharts();
  } catch (e) {
    console.error("Erro ao carregar Caixa:", e);
    caixaShowMsg("Erro ao carregar os lançamentos do Caixa.", "error");
  }
}

function preencherFiltroAnoCaixa() {
  if (!caixaFilterAnoSelect) return;

  const prevValue = caixaFilterAnoSelect.value || "all";

  const anos = Array.from(
    new Set(
      (caixaCache || [])
        .map((r) => String(r.dataIso || "").slice(0, 4))
        .filter((y) => y && y.length === 4)
    )
  ).sort();

  // Recria options
  caixaFilterAnoSelect.innerHTML = '<option value="all">Todos</option>';
  anos.forEach((ano) => {
    const opt = document.createElement("option");
    opt.value = ano;
    opt.textContent = ano;
    caixaFilterAnoSelect.appendChild(opt);
  });

  // Mantém seleção anterior se ainda existir
  if (prevValue && (prevValue === "all" || anos.includes(prevValue))) {
    caixaFilterAnoSelect.value = prevValue;
  } else {
    // Default: ano atual se existir, senão "Todos"
    const anoAtual = String(new Date().getFullYear());
    caixaFilterAnoSelect.value = anos.includes(anoAtual) ? anoAtual : "all";
  }
}

function getCaixaFiltradoOrdenado() {
  const anoSel = caixaGetSelectedAno();
  const lista = (caixaCache || []).filter((r) => {
    if (anoSel === "all") return true;
    return String(r.dataIso || "").startsWith(anoSel + "-");
  });

  lista.sort((a, b) => (a.dataIso || "").localeCompare(b.dataIso || ""));
  return lista;
}

function renderCaixaTable() {
  if (!caixaTbody) return;

  const lista = getCaixaFiltradoOrdenado();

  if (!lista.length) {
    caixaTbody.innerHTML = '<tr><td colspan="5">Nenhum lançamento ainda.</td></tr>';
    return;
  }

  caixaTbody.innerHTML = "";

  // variação (diferença para o lançamento anterior dentro do filtro)
  let prevValor = null;

  lista.forEach((row, idx) => {
    const tr = document.createElement("tr");

    const tdData = document.createElement("td");
    tdData.textContent = caixaFormatarDataBR(row.dataIso);
    tr.appendChild(tdData);

    const tdValor = document.createElement("td");
    tdValor.textContent = caixaFormatarMoedaBR(row.valor);
    tr.appendChild(tdValor);

    const tdVar = document.createElement("td");
    if (prevValor === null) {
      tdVar.textContent = "-";
    } else {
      const diff = Number(row.valor || 0) - Number(prevValor || 0);
      const sinal = diff > 0 ? "+" : (diff < 0 ? "-" : "");
      tdVar.textContent = sinal ? (sinal + " " + caixaFormatarMoedaBR(Math.abs(diff))) : caixaFormatarMoedaBR(0);
    }
    tr.appendChild(tdVar);

    const tdObs = document.createElement("td");
    tdObs.textContent = row.obs || "";
    tr.appendChild(tdObs);

    const tdAcoes = document.createElement("td");

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.className = "btn-small";
    btnEditar.addEventListener("click", () => iniciarEdicaoCaixa(row.id));
    tdAcoes.appendChild(btnEditar);

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir";
    btnExcluir.className = "btn-small btn-danger";
    btnExcluir.addEventListener("click", () => excluirCaixa(row.id));
    tdAcoes.appendChild(btnExcluir);

    tr.appendChild(tdAcoes);

    caixaTbody.appendChild(tr);

    prevValor = Number(row.valor || 0);
  });
}

function renderCaixaCharts() {
  const canvasVar = document.getElementById("chart-caixa-variacao");
  const canvasSaldo = document.getElementById("chart-caixa-saldo");
  if (!canvasVar || !canvasSaldo) return;

  const lista = getCaixaFiltradoOrdenado();

  // Labels (dd/mm/aaaa)
  const labels = lista.map((r) => caixaFormatarDataBR(r.dataIso));

  // Dados
  const saldos = lista.map((r) => Number(r.valor || 0));

  // Variações: primeiro ponto = null (sem referência)
  const variacoes = [];
  for (let i = 0; i < lista.length; i++) {
    if (i === 0) {
      variacoes.push(null);
    } else {
      variacoes.push(Number(lista[i].valor || 0) - Number(lista[i - 1].valor || 0));
    }
  }

  // Se não tem dados, limpa gráficos
  if (!labels.length) {
    if (chartCaixaVariacao) { chartCaixaVariacao.destroy(); chartCaixaVariacao = null; }
    if (chartCaixaSaldo) { chartCaixaSaldo.destroy(); chartCaixaSaldo = null; }
    const ctx1 = canvasVar.getContext("2d");
    const ctx2 = canvasSaldo.getContext("2d");
    ctx1 && ctx1.clearRect(0, 0, canvasVar.width, canvasVar.height);
    ctx2 && ctx2.clearRect(0, 0, canvasSaldo.width, canvasSaldo.height);
    return;
  }

  // ---- Chart Variação (linha) ----
  if (chartCaixaVariacao) {
    chartCaixaVariacao.data.labels = labels;
    chartCaixaVariacao.data.datasets[0].data = variacoes;
    chartCaixaVariacao.update();
  } else {
    const ctx = canvasVar.getContext("2d");
    chartCaixaVariacao = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Variação (R$)",
            data: variacoes,
            fill: false,
            tension: 0.2,
            spanGaps: true
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
                const v = Number(context.parsed?.y ?? 0);
                const sinal = v > 0 ? "+" : (v < 0 ? "-" : "");
                return sinal ? (sinal + " " + caixaFormatarMoedaBR(Math.abs(v))) : caixaFormatarMoedaBR(0);
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: false }
        }
      }
    });
  }

  // ---- Chart Saldo (barras) ----
  if (chartCaixaSaldo) {
    chartCaixaSaldo.data.labels = labels;
    chartCaixaSaldo.data.datasets[0].data = saldos;
    chartCaixaSaldo.update();
  } else {
    const ctx = canvasSaldo.getContext("2d");
    chartCaixaSaldo = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Valor em conta (R$)",
            data: saldos
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
                const v = Number(context.parsed?.y ?? 0);
                return caixaFormatarMoedaBR(v);
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}

// ----------------------
// CRUD
// ----------------------
function resetFormCaixa() {
  if (caixaDataInput) caixaDataInput.value = "";
  if (caixaValorInput) caixaValorInput.value = "";
  if (caixaObsInput) caixaObsInput.value = "";
  editingCaixaId = null;
  if (btnCancelCaixa) btnCancelCaixa.classList.add("hidden");
  caixaSetDefaultDateIfEmpty();
}

function iniciarEdicaoCaixa(docId) {
  const item = (caixaCache || []).find((r) => r.id === docId);
  if (!item) return;

  editingCaixaId = item.id;

  if (caixaDataInput) caixaDataInput.value = item.dataIso || "";
  if (caixaValorInput) caixaValorInput.value = Number(item.valor || 0).toFixed(2);
  if (caixaObsInput) caixaObsInput.value = item.obs || "";

  if (btnCancelCaixa) btnCancelCaixa.classList.remove("hidden");
  caixaShowMsg("Editando lançamento. Para mudar a data, salve e o sistema moverá o registro.", "");
}

function cancelarEdicaoCaixa() {
  resetFormCaixa();
  caixaClearMsg();
}

async function salvarCaixa() {
  caixaClearMsg();

  const dataIso = (caixaDataInput?.value || "").trim();
  const valorStr = (caixaValorInput?.value || "").toString().trim();
  const obs = (caixaObsInput?.value || "").trim();

  if (!dataIso) {
    caixaShowMsg("Preencha a data.", "error");
    return;
  }

  const valor = Number(valorStr.replace(",", "."));
  if (isNaN(valor)) {
    caixaShowMsg("Preencha um valor válido.", "error");
    return;
  }
  if (valor < 0) {
    caixaShowMsg("O valor não pode ser negativo.", "error");
    return;
  }

  // Validação: impedir data repetida
  const jaExiste = (caixaCache || []).some((r) => r.id === dataIso);

  // Se não está editando, não pode existir
  if (!editingCaixaId && jaExiste) {
    caixaShowMsg("Já existe um lançamento para esta data. Edite o existente ou escolha outra data.", "error");
    return;
  }

  // Se está editando e mudou a data, precisa validar duplicidade
  if (editingCaixaId && editingCaixaId !== dataIso && jaExiste) {
    caixaShowMsg("Já existe um lançamento para esta data. Escolha outra data.", "error");
    return;
  }

  try {
    const payload = {
      dataIso,
      valor: Number(valor),
      obs: obs || ""
    };

    // Se está editando e a data não mudou: apenas atualiza
    if (editingCaixaId && editingCaixaId === dataIso) {
      await db.collection("caixa").doc(dataIso).set(payload, { merge: true });
      caixaShowMsg("Lançamento atualizado com sucesso.", "ok");
      await carregarCaixa();
      resetFormCaixa();
      return;
    }

    // Se está editando e a data mudou: cria novo doc e remove o antigo
    if (editingCaixaId && editingCaixaId !== dataIso) {
      await db.collection("caixa").doc(dataIso).set(payload, { merge: false });
      await db.collection("caixa").doc(editingCaixaId).delete();
      caixaShowMsg("Lançamento movido/atualizado com sucesso.", "ok");
      await carregarCaixa();
      resetFormCaixa();
      return;
    }

    // Novo lançamento (docId = dataIso)
    await db.collection("caixa").doc(dataIso).set(payload, { merge: false });
    caixaShowMsg("Lançamento salvo com sucesso.", "ok");
    await carregarCaixa();
    resetFormCaixa();
  } catch (e) {
    console.error("Erro ao salvar Caixa:", e);
    caixaShowMsg("Erro ao salvar. Tente novamente.", "error");
  }
}

async function excluirCaixa(docId) {
  if (!docId) return;

  const ok = confirm("Excluir este lançamento do Caixa?");
  if (!ok) return;

  try {
    await db.collection("caixa").doc(docId).delete();
    if (editingCaixaId === docId) {
      resetFormCaixa();
    }
    caixaShowMsg("Lançamento excluído.", "ok");
    await carregarCaixa();
  } catch (e) {
    console.error("Erro ao excluir Caixa:", e);
    caixaShowMsg("Erro ao excluir. Tente novamente.", "error");
  }
}

// ----------------------
// Inicialização (chamada pela ui.js ao entrar na aba)
// ----------------------
function initCaixaUI() {
  // Se não existe a seção (ex: arquivo antigo), sai sem quebrar o app
  if (!document.getElementById("section-caixa")) return;

  // Liga eventos apenas uma vez
  if (!caixaInitDone) {
    caixaInitDone = true;

    if (btnSaveCaixa) btnSaveCaixa.addEventListener("click", salvarCaixa);
    if (btnCancelCaixa) btnCancelCaixa.addEventListener("click", cancelarEdicaoCaixa);

    if (caixaFilterAnoSelect) {
      caixaFilterAnoSelect.addEventListener("change", () => {
        renderCaixaTable();
        renderCaixaCharts();
      });
    }
  }

  // Data padrão
  caixaSetDefaultDateIfEmpty();

  // Atualiza do Firestore sempre que entrar na aba
  carregarCaixa();
}
