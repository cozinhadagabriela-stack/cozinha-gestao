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


// Formato compacto para evitar rótulos longos embolarem no gráfico
// Ex.: R$ 10k, R$ 1,2M
function caixaFormatarMoedaBRCompacta(valor) {
  const n = Number(valor || 0);
  const abs = Math.abs(n);

  // < 1.000: mantém o formato completo (já é curto)
  if (abs < 1000) return caixaFormatarMoedaBR(n);

  const sinal = n < 0 ? "-" : "";
  if (abs < 1000000) {
    // milhares
    const k = abs / 1000;
    const v = (k < 10 ? k.toFixed(1) : k.toFixed(0)).replace(".", ",");
    return `${sinal}R$ ${v}k`;
  }
  // milhões
  const m = abs / 1000000;
  const v = (m < 10 ? m.toFixed(1) : m.toFixed(0)).replace(".", ",");
  return `${sinal}R$ ${v}M`;
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

  // Dados (Banco)
  const saldos = lista.map((r) => Number(r.valor || 0));

  // Estoque (insumos) fechado no "Resultado do mês" (estoqueFinal) do mesmo mês do lançamento de caixa
  // Chave: YYYY-MM
  const estoqueMap = new Map();
  (resultadosFechadosCache || []).forEach((r) => {
    const k = String(r.mesRef || r.id || "").trim();
    if (!k) return;
    estoqueMap.set(k, Number(r.estoqueFinal || 0));
  });

  const estoques = lista.map((r) => {
    const mesRef = String(r.dataIso || "").slice(0, 7); // YYYY-MM
    return estoqueMap.has(mesRef) ? Number(estoqueMap.get(mesRef) || 0) : 0;
  });

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

  // ---- Chart Capital Operacional (barras empilhadas) ----
  if (chartCaixaSaldo) {
    chartCaixaSaldo.data.labels = labels;
    chartCaixaSaldo.data.datasets[0].data = saldos;
    chartCaixaSaldo.data.datasets[1].data = estoques;
    chartCaixaSaldo.update();
  } else {
    const ctx = canvasSaldo.getContext("2d");

    // Plugin: escreve o total (Banco + Estoque) no topo de cada barra.
    // Melhorias:
    // - usa formato compacto quando o gráfico está "apertado" (evita embolar)
    // - tenta reposicionar verticalmente quando 2 rótulos colidem
    const totalLabelPlugin = {
      id: "totalLabelPlugin",
      afterDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        const yScale = scales?.y;
        if (!ctx || !yScale || !chartArea) return;

        const len = chart.data.labels?.length || 0;
        const larguraPorBarra = chartArea.width / Math.max(1, len);
        const usarCompacto = larguraPorBarra < 70; // limiar prático

        const fontSize = usarCompacto ? 10 : 12;
        ctx.save();
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "#111";

        const meta0 = chart.getDatasetMeta(0);
        const boxes = []; // bounding boxes já desenhadas

        for (let i = 0; i < len; i++) {
          const banco = Number(chart.data.datasets?.[0]?.data?.[i] || 0);
          const est = Number(chart.data.datasets?.[1]?.data?.[i] || 0);
          const total = banco + est;

          const elem = meta0?.data?.[i];
          if (!elem) continue;

          const x = elem.x;
          let yPos = yScale.getPixelForValue(total) - 6;

          const texto = usarCompacto ? caixaFormatarMoedaBRCompacta(total) : caixaFormatarMoedaBR(total);
          const w = ctx.measureText(texto).width;
          const h = fontSize;

          // tenta subir o texto se colidir com outro rótulo
          let tentativas = 0;
          while (tentativas < 8) {
            const left = x - w / 2 - 2;
            const right = x + w / 2 + 2;
            const top = yPos - h - 2;
            const bottom = yPos + 2;

            // não deixa sair do topo do gráfico
            if (top < chartArea.top + 2) {
              yPos = chartArea.top + h + 6;
            }

            const colisao = boxes.some(b => !(right < b.left || left > b.right || bottom < b.top || top > b.bottom));
            if (!colisao) {
              boxes.push({ left, right, top, bottom });
              ctx.fillText(texto, x, yPos);
              break;
            }

            yPos -= (h + 3);
            tentativas++;
          }
        }

        ctx.restore();
      }
    };

    chartCaixaSaldo = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Banco (R$)",
            data: saldos,
            backgroundColor: "rgba(54, 162, 235, 0.7)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1
          },
          {
            label: "Estoque (insumos) (R$)",
            data: estoques,
            backgroundColor: "rgba(144, 238, 144, 0.7)",
            borderColor: "rgba(144, 238, 144, 1)",
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 28, right: 8, left: 8 } },
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              label: function (context) {
                const v = Number(context.parsed?.y ?? 0);
                const nome = context.dataset?.label || "";
                return `${nome}: ${caixaFormatarMoedaBR(v)}`;
              },
              footer: function (items) {
                const total = (items || []).reduce((s, it) => s + Number(it.parsed?.y ?? 0), 0);
                return `Total: ${caixaFormatarMoedaBR(total)}`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { autoSkip: false, maxRotation: 35, minRotation: 35 } },
          y: { beginAtZero: true, stacked: true }
        }
      },
      plugins: [totalLabelPlugin]
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

  // Resultado do mês (novo)
  if (typeof initResultadoMensalUI === "function") {
    initResultadoMensalUI();
  }
}

// =========================================================
// Financeiro: Resultado do mês (CMV + Despesas + Retiradas)
// =========================================================

// Referências da interface (Resultado do mês)
const resultadoMesRefInput = document.getElementById("resultado-mesref");
const resultadoEstoqueInicialInput = document.getElementById("resultado-estoque-inicial");
const btnFecharResultado = document.getElementById("btn-fechar-resultado");
const resultadoMessage = document.getElementById("resultado-message");

const resVendasEl = document.getElementById("res-vendas");
const resCmvEl = document.getElementById("res-cmv");
const resDespesasEl = document.getElementById("res-despesas");
const resRetiradasEl = document.getElementById("res-retiradas");
const resLucroEl = document.getElementById("res-lucro");
const resMargemEl = document.getElementById("res-margem");

const resDetalhesExtraEl = document.getElementById("res-detalhes-extra");
const resultadoTbody = document.getElementById("resultado-tbody");

let resultadoInitDone = false;
let resultadosFechadosCache = []; // [{mesRef, ...}]

function resultadoShowMsg(texto, tipo) {
  if (!resultadoMessage) return;
  resultadoMessage.textContent = texto || "";
  resultadoMessage.className = "msg";
  if (tipo === "ok") resultadoMessage.classList.add("ok");
  if (tipo === "error") resultadoMessage.classList.add("error");
}

function resultadoClearMsg() {
  resultadoShowMsg("", "");
}

function resultadoMesRefAtual() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function resultadoMesRefToLabel(mesRef) {
  if (!mesRef || typeof mesRef !== "string" || mesRef.length < 7) return mesRef || "";
  const [y, m] = mesRef.split("-");
  return `${m}/${y}`;
}

function resultadoPrevMesRef(mesRef) {
  if (!mesRef || typeof mesRef !== "string" || mesRef.length < 7) return null;
  const [yStr, mStr] = mesRef.split("-");
  let y = Number(yStr);
  let m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  m -= 1;
  if (m <= 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function resultadoNormalize(txt) {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function despesaEhRetirada(d) {
  const grp = resultadoNormalize(d?.itemDespesaGrupo || d?.itemDespesaCategoria || "");
  const desc = resultadoNormalize(d?.descricaoItem || d?.itemDespesaDescricao || "");

  const isProLabore = (grp.includes("PRO") && grp.includes("LABORE")) || (desc.includes("PRO") && desc.includes("LABORE"));
  const isRetirada = grp.includes("RETIRAD") || desc.includes("RETIRAD");

  return isProLabore || isRetirada;
}

function resultadoSetValoresUI(vals) {
  if (!vals) return;

  const fmt = (v) => caixaFormatarMoedaBR(Number(v || 0));

  if (resVendasEl) resVendasEl.textContent = fmt(vals.vendas);
  if (resCmvEl) resCmvEl.textContent = fmt(vals.cmv);
  if (resDespesasEl) resDespesasEl.textContent = fmt(vals.despesas);
  if (resRetiradasEl) resRetiradasEl.textContent = fmt(vals.retiradas);
  if (resLucroEl) resLucroEl.textContent = fmt(vals.lucro);

  if (resMargemEl) {
    if (!vals.vendas || Number(vals.vendas) <= 0) {
      resMargemEl.textContent = "-";
    } else {
      const m = (Number(vals.lucro || 0) / Number(vals.vendas || 1)) * 100;
      resMargemEl.textContent = `${m.toFixed(1).replace('.', ',')}%`;
    }
  }

  if (resDetalhesExtraEl) {
    const warnMsg = vals._cmvNegativo
      ? "⚠️ CMV ficou negativo pelo cálculo (ajustado para R$ 0,00). Revise estoque/compras."
      : "";

    // Layout em cards (sem alterar nenhuma regra de cálculo)
    resDetalhesExtraEl.innerHTML = `
      <div class="resultado-chips">
        <div class="resultado-chip">
          <span class="chip-label">Estoque inicial</span>
          <span class="chip-value">${fmt(vals.estoqueInicial)}</span>
        </div>
        <div class="resultado-chip">
          <span class="chip-label">Compras (insumos)</span>
          <span class="chip-value">${fmt(vals.comprasInsumos)}</span>
        </div>
        <div class="resultado-chip">
          <span class="chip-label">Estoque final</span>
          <span class="chip-value">${fmt(vals.estoqueFinal)}</span>
        </div>
      </div>
      ${warnMsg ? `<div class="resultado-warn">${warnMsg}</div>` : ""}
    `;
  }
}

function resultadoLimparUI() {
  resultadoSetValoresUI({
    vendas: 0,
    cmv: 0,
    despesas: 0,
    retiradas: 0,
    lucro: 0,
    estoqueInicial: 0,
    comprasInsumos: 0,
    estoqueFinal: 0,
    _cmvNegativo: false,
  });
  if (resMargemEl) resMargemEl.textContent = "0,0%";
}

async function obterValorEstoqueInsumosAtual() {
  let total = 0;
  const snap = await db.collection("estoqueInsumos").get();
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const qtd = Number(d.quantidade || 0);
    const custo = Number(d.custoMedio || 0);
    if (Number.isFinite(qtd) && Number.isFinite(custo)) {
      total += (qtd * custo);
    }
  });
  return total;
}

function resultadoRangeMes(mesRef) {
  const [yStr, mStr] = (mesRef || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  // IMPORTANT: timestamps (dataTimestamp / dataPagamentoTimestamp / dataEntradaEstoqueTimestamp)
  // são gerados a partir de inputs type="date" ("YYYY-MM-DD"), que o JS interpreta como UTC.
  // Para evitar o "vazamento" do dia 01 para o mês anterior em timezones negativos (ex.: Brasil),
  // o range do mês precisa ser calculado em UTC também.
  const startMs = Date.UTC(y, m - 1, 1, 0, 0, 0, 0);
  const endMs = Date.UTC(y, m, 1, 0, 0, 0, 0);
  return {
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString().slice(0, 10),
    endIso: new Date(endMs).toISOString().slice(0, 10),
  };
}

async function calcularResultadoDoMes(mesRef) {
  const range = resultadoRangeMes(mesRef);
  if (!range) throw new Error("Mês de referência inválido.");

  // Vendas
  let vendas = 0;
  const vendasSnap = await db
    .collection("vendas")
    .where("dataTimestamp", ">=", range.startMs)
    .where("dataTimestamp", "<", range.endMs)
    .get();

  vendasSnap.forEach((doc) => {
    const v = doc.data() || {};
    vendas += Number(v.valorTotal || 0);
  });

  // Despesas
  let comprasInsumos = 0;
  let despesasOperacionais = 0;
  let retiradas = 0;

  const despesasSnap = await db
    .collection("despesas")
    .where("dataPagamentoTimestamp", ">=", range.startMs)
    .where("dataPagamentoTimestamp", "<", range.endMs)
    .get();

  despesasSnap.forEach((doc) => {
    const d = doc.data() || {};
    const total = Number(d.valorTotal || 0);

    // Retiradas (pro-labore/retirada)
    if (despesaEhRetirada(d)) {
      retiradas += total;
      return;
    }

    // Compras que viraram estoque
    // Regra:
    // - Se existir dataEntradaEstoqueTimestamp (novo campo), a compra entra no mês da *entrada no estoque*
    // - Se não existir (compatibilidade com dados antigos), continua usando a dataPagamentoTimestamp
    const tsEntrada = Number(d.dataEntradaEstoqueTimestamp);
    const temEntrada = Number.isFinite(tsEntrada) && tsEntrada > 0;
    if (d.gerouEstoqueInsumo === true) {
      // Se tem data de entrada, NÃO soma aqui (para não amarrar no pagamento). Será somado pela consulta de entrada.
      if (!temEntrada) {
        comprasInsumos += total;
      }
      return;
    }

    // Despesas do mês (sem compras que viraram estoque)
    despesasOperacionais += total;
  });

  // Compras (insumos) por data de entrada no estoque (novo campo)
  // Isso permite lançar compras parceladas (vários boletos) e ainda assim concentrar a compra no mês da entrada.
  const comprasEntradaSnap = await db
    .collection("despesas")
    .where("dataEntradaEstoqueTimestamp", ">=", range.startMs)
    .where("dataEntradaEstoqueTimestamp", "<", range.endMs)
    .get();

  comprasEntradaSnap.forEach((doc) => {
    const d = doc.data() || {};
    if (d.gerouEstoqueInsumo === true) {
      comprasInsumos += Number(d.valorTotal || 0);
    }
  });

  // Estoques
  const estoqueFinal = await obterValorEstoqueInsumosAtual();

  // Estoque inicial: do último fechamento (mês anterior) ou manual
  const prevMes = resultadoPrevMesRef(mesRef);
  let estoqueInicial = null;

  if (prevMes) {
    const prevSnap = await db.collection("resultadoMensal").doc(prevMes).get();
    if (prevSnap.exists) {
      const prev = prevSnap.data() || {};
      const v = Number(prev.estoqueFinal || 0);
      estoqueInicial = Number.isFinite(v) ? v : 0;
    }
  }

  if (estoqueInicial === null) {
    const manual = Number((resultadoEstoqueInicialInput?.value || "").toString().replace(",", "."));
    if (Number.isFinite(manual) && manual > 0) {
      estoqueInicial = manual;
    }
  }

  // CMV
  let cmv = null;
  let cmvNegativo = false;
  if (estoqueInicial !== null) {
    cmv = Number(estoqueInicial || 0) + Number(comprasInsumos || 0) - Number(estoqueFinal || 0);
    if (cmv < 0) {
      cmvNegativo = true;
      cmv = 0;
    }
  }

  // Lucro
  let lucro = null;
  if (cmv !== null) {
    lucro = Number(vendas || 0) - Number(cmv || 0) - Number(despesasOperacionais || 0) - Number(retiradas || 0);
  }

  return {
    mesRef,
    periodoInicioIso: range.startIso,
    periodoFimIso: range.endIso,
    vendas,
    comprasInsumos,
    despesas: despesasOperacionais,
    retiradas,
    estoqueInicial,
    estoqueFinal,
    cmv,
    lucro,
    _cmvNegativo: cmvNegativo,
  };
}

async function salvarResultadoDoMes(res) {
  if (!res || !res.mesRef) return;

  const payload = {
    mesRef: res.mesRef,
    periodoInicioIso: res.periodoInicioIso || null,
    periodoFimIso: res.periodoFimIso || null,
    vendas: Number(res.vendas || 0),
    comprasInsumos: Number(res.comprasInsumos || 0),
    despesas: Number(res.despesas || 0),
    retiradas: Number(res.retiradas || 0),
    estoqueInicial: Number(res.estoqueInicial || 0),
    estoqueFinal: Number(res.estoqueFinal || 0),
    cmv: Number(res.cmv || 0),
    lucro: Number(res.lucro || 0),
    margem: (res.vendas && Number(res.vendas) > 0) ? (Number(res.lucro || 0) / Number(res.vendas || 1)) : null,
    fechadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("resultadoMensal").doc(res.mesRef).set(payload, { merge: true });
}

async function carregarResultadosFechados() {
  resultadosFechadosCache = [];

  try {
    const snap = await db.collection("resultadoMensal").orderBy("mesRef").get();
    snap.forEach((doc) => {
      const d = doc.data() || {};
      resultadosFechadosCache.push({ id: doc.id, ...d });
    });

    // Ordena por mesRef
    resultadosFechadosCache.sort((a, b) => String(a.mesRef || a.id).localeCompare(String(b.mesRef || b.id)));

    renderResultadosFechadosTable();

    // Re-renderiza o gráfico de Capital Operacional (usa o estoqueFinal fechado do mês)
    // Assim, quando você fecha/atualiza um mês, o gráfico já reflete o estoque daquele mês.
    renderCaixaCharts();
  } catch (e) {
    console.error("Erro ao carregar resultadosMensal:", e);
  }
}

function renderResultadosFechadosTable() {
  if (!resultadoTbody) return;

  if (!resultadosFechadosCache.length) {
    resultadoTbody.innerHTML = '<tr><td colspan="8">Nenhum resultado fechado ainda.</td></tr>';
    return;
  }

  resultadoTbody.innerHTML = "";

  const fmt = (v) => caixaFormatarMoedaBR(Number(v || 0));

  // Mostra do mais recente para o mais antigo
  const lista = [...resultadosFechadosCache].sort((a, b) => String(b.mesRef || b.id).localeCompare(String(a.mesRef || a.id)));

  lista.forEach((r) => {
    const tr = document.createElement("tr");

    const tdMes = document.createElement("td");
    tdMes.textContent = resultadoMesRefToLabel(r.mesRef || r.id);
    tr.appendChild(tdMes);

    const tdV = document.createElement("td");
    tdV.textContent = fmt(r.vendas);
    tr.appendChild(tdV);

    const tdCmv = document.createElement("td");
    tdCmv.textContent = fmt(r.cmv);
    tr.appendChild(tdCmv);

    const tdD = document.createElement("td");
    tdD.textContent = fmt(r.despesas);
    tr.appendChild(tdD);

    const tdR = document.createElement("td");
    tdR.textContent = fmt(r.retiradas);
    tr.appendChild(tdR);

    const tdL = document.createElement("td");
    tdL.textContent = fmt(r.lucro);
    tr.appendChild(tdL);

    const tdM = document.createElement("td");
    if (!r.vendas || Number(r.vendas) <= 0) {
      tdM.textContent = "-";
    } else {
      const m = (Number(r.lucro || 0) / Number(r.vendas || 1)) * 100;
      tdM.textContent = `${m.toFixed(1).replace('.', ',')}%`;
    }
    tr.appendChild(tdM);

    const tdA = document.createElement("td");

    const btnUsar = document.createElement("button");
    btnUsar.textContent = "Ver";
    btnUsar.className = "btn-small";
    btnUsar.addEventListener("click", async () => {
      const mesRef = r.mesRef || r.id;
      if (resultadoMesRefInput) resultadoMesRefInput.value = mesRef;
      // Atualiza os cards com o que foi salvo
      resultadoSetValoresUI({
        vendas: r.vendas,
        cmv: r.cmv,
        despesas: r.despesas,
        retiradas: r.retiradas,
        lucro: r.lucro,
        estoqueInicial: r.estoqueInicial,
        comprasInsumos: r.comprasInsumos,
        estoqueFinal: r.estoqueFinal,
        _cmvNegativo: false,
      });
      resultadoShowMsg(`Mostrando o resultado fechado de ${resultadoMesRefToLabel(mesRef)}.`, "");
    });
    tdA.appendChild(btnUsar);

    const btnDel = document.createElement("button");
    btnDel.textContent = "Excluir";
    btnDel.className = "btn-small btn-danger";
    btnDel.addEventListener("click", async () => {
      const ok = confirm("Excluir este resultado fechado? (Isso não altera vendas, despesas nem estoque.)");
      if (!ok) return;
      try {
        await db.collection("resultadoMensal").doc(r.mesRef || r.id).delete();
        await carregarResultadosFechados();
        resultadoShowMsg("Resultado excluído.", "ok");
      } catch (e) {
        console.error("Erro ao excluir resultadoMensal:", e);
        resultadoShowMsg("Erro ao excluir. Tente novamente.", "error");
      }
    });
    tdA.appendChild(btnDel);

    tr.appendChild(tdA);

    resultadoTbody.appendChild(tr);
  });
}

function initResultadoMensalUI() {
  // Se não existe a UI (arquivo antigo), sai
  if (!resultadoMesRefInput || !btnFecharResultado) return;

  if (!resultadoInitDone) {
    resultadoInitDone = true;

    // mês default
    if (!resultadoMesRefInput.value) {
      resultadoMesRefInput.value = resultadoMesRefAtual();
    }

    btnFecharResultado.addEventListener("click", async () => {
      resultadoClearMsg();

      const mesRef = (resultadoMesRefInput.value || "").trim();
      if (!mesRef) {
        resultadoShowMsg("Selecione o mês de referência.", "error");
        return;
      }

      try {
        resultadoShowMsg("Calculando...", "");

        const res = await calcularResultadoDoMes(mesRef);

        if (res.estoqueInicial === null) {
          resultadoSetValoresUI({
            vendas: res.vendas,
            cmv: 0,
            despesas: res.despesas,
            retiradas: res.retiradas,
            lucro: 0,
            estoqueInicial: 0,
            comprasInsumos: res.comprasInsumos,
            estoqueFinal: res.estoqueFinal,
            _cmvNegativo: false,
          });

          const prev = resultadoPrevMesRef(mesRef);
          const msgPrev = prev ? `feche primeiro o mês anterior (${resultadoMesRefToLabel(prev)})` : "";
          resultadoShowMsg(
            `Para calcular o CMV, preciso do estoque inicial. Informe o campo \"Estoque inicial\" (se for o 1º mês) ou ${msgPrev}.`,
            "error"
          );
          return;
        }

        // Atualiza UI
        resultadoSetValoresUI(res);

        // Salva
        await salvarResultadoDoMes(res);

        resultadoShowMsg(`Resultado fechado e salvo para ${resultadoMesRefToLabel(mesRef)}.`, "ok");
        await carregarResultadosFechados();
      } catch (e) {
        console.error("Erro ao fechar resultado do mês:", e);
        resultadoShowMsg("Erro ao calcular/salvar o resultado do mês. Tente novamente.", "error");
      }
    });

    // Se trocar o mês, apenas limpa mensagem
    resultadoMesRefInput.addEventListener("change", () => {
      resultadoClearMsg();
    });
  }

  // Carrega lista toda vez que entrar na aba
  carregarResultadosFechados();
}
