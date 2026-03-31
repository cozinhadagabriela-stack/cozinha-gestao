(function () {
  const btnAtualizar = document.getElementById("btn-custos-atualizar");
  const statusEl = document.getElementById("custos-status");
  const filtroProdutoEl = document.getElementById("custos-produto-filter");

  const kpiCustoMedioEl = document.getElementById("custos-kpi-custo-medio");
  const kpiMargemMediaEl = document.getElementById("custos-kpi-margem-media");
  const kpiAtualizacaoEl = document.getElementById("custos-kpi-atualizacao");

  const produtosTbody = document.getElementById("custos-produtos-tbody");
  const insumosTbody = document.getElementById("custos-insumos-tbody");
  const naoIdentificadosWrap = document.getElementById("custos-nao-identificados-wrap");
  const naoIdentificadosList = document.getElementById("custos-nao-identificados-list");

  const chartProdutosCanvas = document.getElementById("chart-custos-produtos");
  const chartHistoricoCanvas = document.getElementById("chart-custos-variacao");
  const chartInsumosCanvas = document.getElementById("chart-custos-insumos");

  let chartProdutos = null;
  let chartHistorico = null;
  let chartInsumos = null;
  let custosInitDone = false;
  let ultimoResultado = null;
  let historicoFechadoCache = [];

  const FALLBACK_SALE_PRICE = 10;
  const COLHER_PEQUENA_LITROS = 0.005;

  const BASE_INGREDIENTS = {
    margarina: {
      label: "Margarina",
      baseUnit: "kg",
      patterns: ["margarina"],
      aliases: ["margarina (1kg)"],
    },
    gordura_vegetal: {
      label: "Gordura vegetal",
      baseUnit: "kg",
      patterns: ["gordura vegetal"],
      aliases: ["gordura vegetal (500g)"],
    },
    acucar: {
      label: "Açúcar",
      baseUnit: "kg",
      patterns: ["acucar cristal", "açucar cristal", "acucar", "açucar"],
      aliases: ["açucar cristal (2kg)", "açucar cristal (5kg)"],
    },
    farinha_trigo: {
      label: "Farinha de trigo",
      baseUnit: "kg",
      patterns: ["farinha de trigo", "farinha", "trigo"],
      aliases: ["farinha de trigo (1kg)", "farinha de trigo (25kg)"],
    },
    fermento_po: {
      label: "Fermento em pó",
      baseUnit: "kg",
      patterns: ["fermento quimico em po", "fermento químico em pó", "fermento quimico", "fermento"],
      aliases: ["fermento quimico em pó(100g)", "fermento quimico em pó(200g0"],
    },
    amido_milho: {
      label: "Amido de milho",
      baseUnit: "kg",
      patterns: ["amido de milho", "amido", "maizena"],
      aliases: ["amido de milho (25kg)"],
    },
    polvilho_doce: {
      label: "Polvilho doce",
      baseUnit: "kg",
      patterns: ["polvilho doce", "polvilho"],
      aliases: ["polvilho doce (1kg)", "polvilho doce(400g)"],
    },
    sal: {
      label: "Sal",
      baseUnit: "kg",
      patterns: [" sal ", "sal refinado", "sal"],
      aliases: [],
    },
    goiabada: {
      label: "Goiabada",
      baseUnit: "kg",
      patterns: ["goiabada"],
      aliases: ["goiabada ( 1,01kg)", "goiabada(300g)"],
    },
    leite: {
      label: "Leite",
      baseUnit: "l",
      patterns: ["leite integral longa vida", "leite integral", " leite ", "leite"],
      aliases: ["leite integral longa vida(1l)"],
    },
    ovos: {
      label: "Ovos",
      baseUnit: "kg",
      patterns: ["ovo branco", "ovos", "ovo"],
      aliases: ["ovo branco(un)"],
    },
    leite_condensado: {
      label: "Leite condensado",
      baseUnit: "kg",
      patterns: ["leite condensado", "condensado"],
      aliases: ["leite condensado(395g)", "leite condensado(5kg)"],
    },
    baunilha_essencia: {
      label: "Essência de baunilha",
      baseUnit: "l",
      patterns: ["essencia de baunilha", "essência de baunilha", "baunilha"],
      aliases: ["essencia de baunilha 500ml"],
    },
    embalagem: {
      label: "Embalagem",
      baseUnit: "un",
      patterns: ["embalagem ga 90", "embalagem", "bandeja", "bandejinha", "saquinho", "saco", "pote"],
      aliases: ["embalagem ga 90"],
    },
    adesivo: {
      label: "Adesivo",
      baseUnit: "un",
      patterns: ["adesivo"],
      aliases: [
        "adesivo biscoito de coco 200g",
        "adesivo biscoito de goiabada 200g",
        "adesivo bolacha de polvilho doce 150g",
        "adesivo sequilho de leite condensado 150g",
        "adesivo sequilho de limão 150g",
      ],
    },
    etiqueta: {
      label: "Etiqueta",
      baseUnit: "un",
      patterns: ["fitas x full", "fita x full", "etiquetadora", "fita", "etiqueta"],
      aliases: ["fitas x-full m-k231(etiquetadora)"],
    },
    coco_ralado: {
      label: "Coco ralado",
      baseUnit: "kg",
      patterns: ["coco ralado", "coco"],
      aliases: [],
    },
  };

  const IGNORED_STOCK_ITEMS = [
    "gas glp",
    "gás glp",
  ];

  const MANUAL_PACKAGE_SIZES = {
    "fitas x full m k231 etiquetadora": { amount: 190, unit: "un" },
    "fitasxfullmk231etiquetadora": { amount: 190, unit: "un" },
    "fermento quimico em po 200g0": { amount: 200, unit: "g" },
    "fermentoquimicoempo200g0": { amount: 200, unit: "g" },
    "fermento quimico em po 100g": { amount: 100, unit: "g" },
    "fermentoquimicoempo100g": { amount: 100, unit: "g" },
    "leite condensado 395g": { amount: 395, unit: "g" },
    "leitecondensado395g": { amount: 395, unit: "g" },
    "leite condensado 5kg": { amount: 5, unit: "kg" },
    "leitecondensado5kg": { amount: 5, unit: "kg" },
    "adesivo biscoito de coco 200g": { amount: 1, unit: "un" },
    "adesivobiscoitodecoco200g": { amount: 1, unit: "un" },
    "adesivo biscoito de goiabada 200g": { amount: 1, unit: "un" },
    "adesivobiscoitodegoiabada200g": { amount: 1, unit: "un" },
    "adesivo bolacha de polvilho doce 150g": { amount: 1, unit: "un" },
    "adesivobolachadepolvilhodoce150g": { amount: 1, unit: "un" },
    "adesivo sequilho de leite condensado 150g": { amount: 1, unit: "un" },
    "adesivosequilhodeleitecondensado150g": { amount: 1, unit: "un" },
    "adesivo sequilho de limao 150g": { amount: 1, unit: "un" },
    "adesivosequilhodelimao150g": { amount: 1, unit: "un" },
    "embalagem ga 90": { amount: 1, unit: "un" },
    "embalagemga90": { amount: 1, unit: "un" },
  };

  const REFERENCE_COSTS = {
    margarina: 20.00,
    gordura_vegetal: 24.00,
    acucar: 3.10,
    farinha_trigo: 3.80,
    fermento_po: 40.00,
    amido_milho: 5.00,
    polvilho_doce: 4.00,
    sal: 2.00,
    goiabada: 12.00,
    leite: 5.20,
    ovos: 10.00,
    leite_condensado: 6.00 / 0.395,
    embalagem: 1.05,
    adesivo: 0.49,
    etiqueta: 3.65 / 190,
    coco_ralado: 0,
  };

  const PRODUCT_RECIPES = [
    {
      id: "sequilho_leite_condensado",
      label: "Sequilho de Leite Condensado",
      patterns: ["sequilho de leite condensado", "sequilho leite condensado", "leite condensado"],
      referenceSalePrice: 10,
      components: [
        { baseKey: "margarina", quantity: 0.150 / 5 },
        { baseKey: "leite_condensado", quantity: 0.295 / 5 },
        { baseKey: "baunilha_essencia", quantity: COLHER_PEQUENA_LITROS / 5 },
        { baseKey: "fermento_po", quantity: 0.005 / 5 },
        { baseKey: "amido_milho", quantity: 0.500 / 5 },
        { baseKey: "embalagem", quantity: 1 },
        { baseKey: "adesivo", quantity: 1 },
        { baseKey: "etiqueta", quantity: 1 },
      ],
    },
    {
      id: "biscoito_coco",
      label: "Biscoito de Coco",
      patterns: ["biscoito de coco", "coco"],
      referenceSalePrice: 10,
      components: [
        { baseKey: "acucar", quantity: 1.000 / 20 },
        { baseKey: "ovos", quantity: 1.000 / 20 },
        { baseKey: "farinha_trigo", quantity: 2.000 / 20 },
        { baseKey: "fermento_po", quantity: 0.050 / 20 },
        { baseKey: "coco_ralado", quantity: 0 },
        { baseKey: "embalagem", quantity: 1 },
        { baseKey: "adesivo", quantity: 1 },
        { baseKey: "etiqueta", quantity: 1 },
      ],
    },
    {
      id: "biscoito_goiabada",
      label: "Biscoito de Goiabada",
      patterns: ["biscoito de goiabada", "goiabada"],
      referenceSalePrice: 10,
      components: [
        { baseKey: "gordura_vegetal", quantity: 0.500 / 10 },
        { baseKey: "acucar", quantity: 0.082 / 10 },
        { baseKey: "goiabada", quantity: 0.760 / 10 },
        { baseKey: "farinha_trigo", quantity: 1.058 / 10 },
        { baseKey: "fermento_po", quantity: 0.025 / 10 },
        { baseKey: "leite", quantity: 0.5 / 10 },
        { baseKey: "sal", quantity: 0.011 / 10 },
        { baseKey: "ovos", quantity: 0.113 / 10 },
        { baseKey: "embalagem", quantity: 1 },
        { baseKey: "adesivo", quantity: 1 },
        { baseKey: "etiqueta", quantity: 1 },
      ],
    },
    {
      id: "sequilho_limao",
      label: "Sequilho de Limão",
      patterns: ["sequilho de limao", "sequilho de limão", "sequilho limao", "sequilho limão"],
      referenceSalePrice: 10,
      components: [
        { baseKey: "margarina", quantity: 0.150 / 5 },
        { baseKey: "leite_condensado", quantity: 0.295 / 5 },
        { baseKey: "fermento_po", quantity: 0.005 / 5 },
        { baseKey: "amido_milho", quantity: 0.500 / 5 },
        { baseKey: "embalagem", quantity: 1 },
        { baseKey: "adesivo", quantity: 1 },
        { baseKey: "etiqueta", quantity: 1 },
      ],
    },
    {
      id: "polvilho_doce",
      label: "Bolacha de Polvilho Doce",
      patterns: ["bolacha de polvilho doce", "polvilho doce", "bolacha de polvilho"],
      referenceSalePrice: 10,
      components: [
        { baseKey: "margarina", quantity: 0.500 / 11.81 },
        { baseKey: "polvilho_doce", quantity: 0.500 / 11.81 },
        { baseKey: "acucar", quantity: 0.110 / 11.81 },
        { baseKey: "leite_condensado", quantity: 0.395 / 11.81 },
        { baseKey: "ovos", quantity: 0.050 / 11.81 },
        { baseKey: "coco_ralado", quantity: 0.100 / 11.81 },
        { baseKey: "fermento_po", quantity: 0.015 / 11.81 },
        { baseKey: "embalagem", quantity: 1 },
        { baseKey: "adesivo", quantity: 1 },
        { baseKey: "etiqueta", quantity: 1 },
      ],
    },
  ];

  function normalizarTexto(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function moeda(valor) {
    const num = Number(valor || 0);
    if (!Number.isFinite(num)) return "—";
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function percentual(valor, casas = 1) {
    const num = Number(valor || 0);
    if (!Number.isFinite(num)) return "—";
    return `${num.toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    })}%`;
  }

  function numero(valor, casas = 2) {
    const num = Number(valor || 0);
    if (!Number.isFinite(num)) return "—";
    return num.toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });
  }

  function setStatus(msg, tipo = "") {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = "msg" + (tipo ? ` ${tipo}` : "");
  }

  function formatarDataCurta(timestamp) {
    const ms = Number(timestamp || 0);
    if (!Number.isFinite(ms) || ms <= 0) return "—";
    return new Date(ms).toLocaleDateString("pt-BR");
  }

  function getLastTimestamp(record) {
    const ts = Number(record?.ultimaEntradaDataTimestamp || record?.updatedAt || record?.atualizadoEm?.seconds * 1000 || 0);
    return Number.isFinite(ts) ? ts : 0;
  }

  function normalizarUnidade(unidade) {
    const n = normalizarTexto(unidade);
    if (["kg", "quilo", "quilos"].includes(n)) return "kg";
    if (["g", "gr", "grama", "gramas"].includes(n)) return "g";
    if (["l", "lt", "litro", "litros"].includes(n)) return "l";
    if (["ml", "mililitro", "mililitros"].includes(n)) return "ml";
    if (["un", "und", "unid", "unidade", "unidades"].includes(n)) return "un";
    return n;
  }

  function deveIgnorarItem(descricao) {
    const n = normalizarTexto(descricao);
    return IGNORED_STOCK_ITEMS.some((item) => n.includes(normalizarTexto(item)));
  }

  function identificarBaseKey(descricao) {
    const normalized = normalizarTexto(descricao);
    const n = ` ${normalized} `;

    // Regras prioritárias para evitar conflito entre item de embalagem/adesivo
    // e palavras que também aparecem no nome do produto final.
    if (normalized.includes("adesivo")) return "adesivo";
    if (normalized.includes("embalagem") || normalized.includes("bandeja") || normalized.includes("bandejinha") || normalized.includes("saquinho") || normalized.includes("saco") || normalized.includes("pote")) return "embalagem";
    if (normalized.includes("etiquetadora") || normalized.includes("fita x full") || normalized.includes("fita") || normalized.includes("etiqueta")) return "etiqueta";
    if (normalized.includes("leite condensado") || normalized.includes("condensado")) return "leite_condensado";

    for (const [baseKey, config] of Object.entries(BASE_INGREDIENTS)) {
      if ((config.aliases || []).some((alias) => n.includes(` ${normalizarTexto(alias)} `) || n === ` ${normalizarTexto(alias)} `)) {
        return baseKey;
      }
    }

    for (const [baseKey, config] of Object.entries(BASE_INGREDIENTS)) {
      if ((config.patterns || []).some((pattern) => n.includes(` ${normalizarTexto(pattern)} `) || n.includes(normalizarTexto(pattern)))) {
        return baseKey;
      }
    }
    return null;
  }

  function parsePackageSizeFromDescription(baseKey, descricao) {
    const descOriginal = String(descricao || "").trim();
    const normalizedDesc = normalizarTexto(descOriginal);
    const compactDesc = normalizedDesc.replace(/\s+/g, "");
    const manual =
      MANUAL_PACKAGE_SIZES[normalizedDesc] ||
      MANUAL_PACKAGE_SIZES[compactDesc] ||
      MANUAL_PACKAGE_SIZES[descOriginal.toLowerCase()];
    if (manual) return manual;

    if (["adesivo", "embalagem", "etiqueta"].includes(baseKey)) {
      return { amount: 1, unit: "un" };
    }

    if (baseKey === "leite_condensado") {
      if (/395\s*g/.test(normalizedDesc) || /395g/.test(compactDesc)) {
        return { amount: 395, unit: "g" };
      }
      if (/5\s*kg/.test(normalizedDesc) || /5kg/.test(compactDesc)) {
        return { amount: 5, unit: "kg" };
      }
    }

    if (baseKey === "ovos") {
      const ovosMatch = normalizedDesc.match(/(\d+(?:[\.,]\d+)?)\s*(ovos?|un|und|unid|unidades)\b/);
      if (ovosMatch) {
        const qtdOvos = Number(String(ovosMatch[1]).replace(",", "."));
        if (Number.isFinite(qtdOvos) && qtdOvos > 0) {
          return { amount: qtdOvos * 0.05, unit: "kg" };
        }
      }
    }

    const match = normalizedDesc.match(/(\d+(?:[\.,]\d+)?)\s*(kg|g|gr|grama|gramas|l|lt|litro|litros|ml|un|und|unid|unidades)\b/);
    if (!match) return null;

    const amount = Number(String(match[1]).replace(",", "."));
    const unit = normalizarUnidade(match[2]);
    if (!Number.isFinite(amount) || amount <= 0 || !unit) return null;
    return { amount, unit };
  }

  function convertToBaseUnits(baseKey, amount, unit) {
    const config = BASE_INGREDIENTS[baseKey];
    if (!config) return null;

    const normalizedUnit = normalizarUnidade(unit);
    const baseUnit = config.baseUnit;
    const value = Number(amount || 0);
    if (!Number.isFinite(value) || value <= 0) return null;

    if (normalizedUnit === baseUnit) return value;

    if (baseUnit === "kg") {
      if (normalizedUnit === "g") return value / 1000;
      if (normalizedUnit === "un" && baseKey === "ovos") return value * 0.05;
    }

    if (baseUnit === "l") {
      if (normalizedUnit === "ml") return value / 1000;
    }

    if (baseUnit === "un" && normalizedUnit === "un") return value;

    return null;
  }

  function inferBaseQuantityPerStockUnit(record, baseKey) {
    const fromDescription = parsePackageSizeFromDescription(baseKey, record.itemDescricao || record.descricao || "");
    if (fromDescription) {
      const converted = convertToBaseUnits(baseKey, fromDescription.amount, fromDescription.unit);
      if (Number.isFinite(converted) && converted > 0) return converted;
    }

    const unidade = normalizarUnidade(record.unidade || "");
    if (unidade) {
      const converted = convertToBaseUnits(baseKey, 1, unidade);
      if (Number.isFinite(converted) && converted > 0) return converted;
    }

    return null;
  }

  function classForStatus(produto) {
    if (!produto.usedReferenceCosts.length && produto.isComplete) return "ok";
    if (produto.isComplete) return "warn";
    return "warn";
  }

  function buildStatus(produto) {
    if (!produto.isComplete) return "Incompleto";
    if (produto.usedReferenceCosts.length) return "Parcial";
    return "OK";
  }

  function inferGroupedCosts(stockRecords) {
    const grouped = {};
    const unidentifiedItems = [];

    (Array.isArray(stockRecords) ? stockRecords : []).forEach((record) => {
      const descricao = record.itemDescricao || record.descricao || "(sem descrição)";
      if (deveIgnorarItem(descricao)) return;

      const qtyPackages = Number(record.quantidade || 0);
      const custoPorPacote = Number(record.custoMedio || 0);

      if (!Number.isFinite(qtyPackages) || qtyPackages <= 0) return;
      if (!Number.isFinite(custoPorPacote) || custoPorPacote < 0) return;

      const baseKey = identificarBaseKey(descricao);
      if (!baseKey) {
        unidentifiedItems.push({ descricao, motivo: "grupo não reconhecido" });
        return;
      }

      const baseQtyPerPackage = inferBaseQuantityPerStockUnit(record, baseKey);
      if (!Number.isFinite(baseQtyPerPackage) || baseQtyPerPackage <= 0) {
        unidentifiedItems.push({ descricao, motivo: "tamanho/unidade não reconhecidos" });
        return;
      }

      if (!grouped[baseKey]) {
        grouped[baseKey] = {
          baseKey,
          label: BASE_INGREDIENTS[baseKey]?.label || baseKey,
          baseUnit: BASE_INGREDIENTS[baseKey]?.baseUnit || "un",
          totalBaseQty: 0,
          totalCost: 0,
          recordCount: 0,
          latestTimestamp: 0,
          sourceDescriptions: [],
        };
      }

      grouped[baseKey].totalBaseQty += qtyPackages * baseQtyPerPackage;
      grouped[baseKey].totalCost += qtyPackages * custoPorPacote;
      grouped[baseKey].recordCount += 1;
      grouped[baseKey].latestTimestamp = Math.max(grouped[baseKey].latestTimestamp, getLastTimestamp(record));
      grouped[baseKey].sourceDescriptions.push(descricao);
    });

    Object.values(grouped).forEach((item) => {
      item.currentCost = item.totalBaseQty > 0 ? item.totalCost / item.totalBaseQty : null;
      item.sourceDescriptions = [...new Set(item.sourceDescriptions)].sort((a, b) => a.localeCompare(b, "pt-BR"));
    });

    unidentifiedItems.sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
    return { grouped, unidentifiedItems };
  }

  function findProductMatch(recipe) {
    const entries = Object.entries(produtosMap || {}).map(([id, data]) => ({
      id,
      descricao: data?.descricao || "",
      precoUnitario: Number(data?.precoUnitario || 0),
    }));

    const patternList = (recipe.patterns || []).map(normalizarTexto);
    return entries.find((entry) => {
      const descricao = normalizarTexto(entry.descricao);
      return patternList.some((pattern) => descricao.includes(pattern));
    }) || null;
  }

  function getFallbackUnitCost(baseKey) {
    const value = Number(REFERENCE_COSTS[baseKey]);
    return Number.isFinite(value) ? value : null;
  }

  function calcularCustosProdutos(groupedCosts) {
    return PRODUCT_RECIPES.map((recipe) => {
      const productMatch = findProductMatch(recipe);
      const salePrice = Number(productMatch?.precoUnitario || recipe.referenceSalePrice || FALLBACK_SALE_PRICE);
      const usedReferenceCosts = [];

      const componentBreakdown = recipe.components.map((component) => {
        const baseConfig = BASE_INGREDIENTS[component.baseKey] || {};
        const stockInfo = groupedCosts[component.baseKey] || null;
        const stockUnitCost = Number(stockInfo?.currentCost);
        const fallbackUnitCost = getFallbackUnitCost(component.baseKey);
        const quantity = Number(component.quantity || 0);

        let chosenUnitCost = null;
        let source = "missing";

        if (Number.isFinite(stockUnitCost) && stockUnitCost >= 0) {
          chosenUnitCost = stockUnitCost;
          source = "stock";
        } else if (Number.isFinite(fallbackUnitCost) && fallbackUnitCost >= 0) {
          chosenUnitCost = fallbackUnitCost;
          source = "reference";
          if (quantity > 0) usedReferenceCosts.push(baseConfig.label || component.baseKey);
        }

        return {
          ...component,
          label: baseConfig.label || component.baseKey,
          baseUnit: baseConfig.baseUnit || "un",
          unitCost: chosenUnitCost,
          componentCost: Number.isFinite(chosenUnitCost) ? chosenUnitCost * quantity : null,
          hasCost: quantity === 0 ? true : Number.isFinite(chosenUnitCost),
          stockInfo,
          costSource: source,
        };
      });

      const missingComponents = componentBreakdown
        .filter((component) => Number(component.quantity || 0) > 0 && !component.hasCost)
        .map((component) => component.label);

      const isComplete = missingComponents.length === 0;
      const currentUnitCost = isComplete
        ? componentBreakdown.reduce((acc, component) => acc + Number(component.componentCost || 0), 0)
        : null;
      const profitUnit = Number.isFinite(currentUnitCost) ? salePrice - currentUnitCost : null;
      const marginPct = Number.isFinite(currentUnitCost) && salePrice > 0 ? (profitUnit / salePrice) * 100 : null;

      return {
        recipeId: recipe.id,
        label: recipe.label,
        productId: productMatch?.id || null,
        productLabel: productMatch?.descricao || recipe.label,
        salePrice,
        currentUnitCost,
        profitUnit,
        marginPct,
        isComplete,
        missingComponents,
        componentBreakdown,
        usedReferenceCosts: [...new Set(usedReferenceCosts)],
      };
    });
  }

  async function carregarEstoqueInsumosAtual() {
    if (!db) return [];
    const snapshot = await db.collection("estoqueInsumos").get();
    const records = [];
    snapshot.forEach((doc) => {
      const d = doc.data() || {};
      records.push({
        id: doc.id,
        itemId: d.itemId || "",
        itemDescricao: d.itemDescricao || "",
        unidade: d.unidade || "",
        quantidade: Number(d.quantidade || 0),
        custoMedio: Number(d.custoMedio || 0),
        ultimaEntradaDataTimestamp: Number(d.ultimaEntradaDataTimestamp || 0),
        atualizadoEm: d.atualizadoEm || null,
      });
    });
    return records;
  }

  async function carregarHistoricoFechado() {
    if (!db) return [];
    const snap = await db.collection("custosProducaoMensal").orderBy("mesRef").get();
    const lista = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      lista.push({ id: doc.id, ...d });
    });
    lista.sort((a, b) => String(a.mesRef || a.id).localeCompare(String(b.mesRef || b.id)));
    historicoFechadoCache = lista;
    return lista;
  }

  function popularFiltroProdutos(produtos) {
    if (!filtroProdutoEl) return;
    const atual = filtroProdutoEl.value || "";
    filtroProdutoEl.innerHTML = '<option value="">Todos os produtos</option>';
    produtos.forEach((produto) => {
      const option = document.createElement("option");
      option.value = produto.recipeId;
      option.textContent = produto.productLabel;
      filtroProdutoEl.appendChild(option);
    });
    if (atual && produtos.some((produto) => produto.recipeId === atual)) {
      filtroProdutoEl.value = atual;
    }
  }

  function getProdutoFiltrado(produtos) {
    const filtro = filtroProdutoEl?.value || "";
    if (!filtro) return produtos;
    return produtos.filter((produto) => produto.recipeId === filtro);
  }

  function renderKpis(produtos, groupedCosts) {
    const filtrados = getProdutoFiltrado(produtos).filter((item) => Number.isFinite(item.currentUnitCost));
    const custoMedio = filtrados.length
      ? filtrados.reduce((acc, item) => acc + Number(item.currentUnitCost || 0), 0) / filtrados.length
      : 0;
    const margemMedia = filtrados.length
      ? filtrados.reduce((acc, item) => acc + Number(item.marginPct || 0), 0) / filtrados.length
      : 0;

    const latestTs = Math.max(
      0,
      ...Object.values(groupedCosts || {}).map((item) => Number(item.latestTimestamp || 0)).filter((n) => Number.isFinite(n))
    );

    if (kpiCustoMedioEl) kpiCustoMedioEl.textContent = moeda(custoMedio);
    if (kpiMargemMediaEl) kpiMargemMediaEl.textContent = percentual(margemMedia);
    if (kpiAtualizacaoEl) kpiAtualizacaoEl.textContent = formatarDataCurta(latestTs);
  }

  function renderProdutosTable(produtos) {
    if (!produtosTbody) return;
    const filtrados = getProdutoFiltrado(produtos);

    if (!filtrados.length) {
      produtosTbody.innerHTML = '<tr><td colspan="7">Nenhum produto encontrado para o filtro atual.</td></tr>';
      return;
    }

    produtosTbody.innerHTML = filtrados.map((produto) => {
      const observacao = produto.isComplete
        ? (produto.usedReferenceCosts.length
            ? `Usando referência em: ${produto.usedReferenceCosts.join(", ")}`
            : "Base completa")
        : `Faltando: ${produto.missingComponents.join(", ")}`;
      return `
        <tr>
          <td>${produto.productLabel}</td>
          <td>${moeda(produto.salePrice)}</td>
          <td>${Number.isFinite(produto.currentUnitCost) ? moeda(produto.currentUnitCost) : "—"}</td>
          <td>${Number.isFinite(produto.profitUnit) ? moeda(produto.profitUnit) : "—"}</td>
          <td>${Number.isFinite(produto.marginPct) ? percentual(produto.marginPct) : "—"}</td>
          <td><span class="custo-chip ${classForStatus(produto)}">${buildStatus(produto)}</span></td>
          <td>${observacao}</td>
        </tr>
      `;
    }).join("");
  }

  function renderInsumosTable(groupedCosts) {
    if (!insumosTbody) return;
    const rows = Object.values(groupedCosts || {}).sort((a, b) => (a.label || "").localeCompare(b.label || "", "pt-BR"));

    if (!rows.length) {
      insumosTbody.innerHTML = '<tr><td colspan="5">Nenhum insumo identificado no estoque.</td></tr>';
      return;
    }

    insumosTbody.innerHTML = rows.map((item) => `
      <tr>
        <td>${item.label}</td>
        <td>${item.baseUnit}</td>
        <td>${Number.isFinite(item.currentCost) ? moeda(item.currentCost) : "—"}</td>
        <td>${numero(item.totalBaseQty)} ${item.baseUnit}</td>
        <td>${item.sourceDescriptions.length}</td>
      </tr>
    `).join("");
  }

  function renderNaoIdentificados(unidentifiedItems) {
    if (!naoIdentificadosWrap || !naoIdentificadosList) return;
    const lista = Array.isArray(unidentifiedItems) ? unidentifiedItems : [];
    if (!lista.length) {
      naoIdentificadosWrap.classList.add("hidden");
      naoIdentificadosList.innerHTML = "<li>Nenhum item pendente.</li>";
      return;
    }

    naoIdentificadosWrap.classList.remove("hidden");
    naoIdentificadosList.innerHTML = lista.map((item) => `<li><strong>${item.descricao}</strong> — ${item.motivo}</li>`).join("");
  }

  function destroyIfExists(chart) {
    if (chart && typeof chart.destroy === "function") chart.destroy();
  }

  function mesRefParaLabel(mesRef) {
    if (!mesRef || typeof mesRef !== "string" || mesRef.length < 7) return mesRef || "";
    const [y, m] = mesRef.split("-");
    return `${m}/${y}`;
  }

  function renderHistorico(produtos) {
    if (typeof Chart === "undefined" || !chartHistoricoCanvas) return;
    destroyIfExists(chartHistorico);

    const filtro = filtroProdutoEl?.value || "";
    const historico = Array.isArray(historicoFechadoCache) ? historicoFechadoCache : [];
    const labels = historico.map((item) => mesRefParaLabel(item.mesRef || item.id));

    const produtosBase = filtro ? produtos.filter((p) => p.recipeId === filtro) : produtos;
    const datasets = produtosBase.map((produto) => ({
      label: produto.productLabel,
      data: historico.map((mes) => {
        const arr = Array.isArray(mes.produtos) ? mes.produtos : [];
        const found = arr.find((item) => item.recipeId === produto.recipeId);
        return Number.isFinite(Number(found?.currentUnitCost)) ? Number(found.currentUnitCost) : null;
      }),
      tension: 0.25,
      fill: false,
      spanGaps: true,
    }));

    chartHistorico = new Chart(chartHistoricoCanvas.getContext("2d"), {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  function renderCharts(produtos, groupedCosts) {
    const filtrados = getProdutoFiltrado(produtos);
    if (typeof Chart === "undefined") return;

    destroyIfExists(chartProdutos);
    destroyIfExists(chartInsumos);

    if (chartProdutosCanvas) {
      chartProdutos = new Chart(chartProdutosCanvas.getContext("2d"), {
        type: "bar",
        data: {
          labels: filtrados.map((item) => item.productLabel),
          datasets: [{
            label: "Custo atual por unidade (R$)",
            data: filtrados.map((item) => Number.isFinite(item.currentUnitCost) ? Number(item.currentUnitCost) : null),
            borderRadius: 8,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { beginAtZero: true } },
        },
      });
    }

    renderHistorico(produtos);

    if (chartInsumosCanvas) {
      const insumos = Object.values(groupedCosts || {})
        .filter((item) => Number.isFinite(Number(item.currentCost)))
        .sort((a, b) => Number(b.currentCost || 0) - Number(a.currentCost || 0))
        .slice(0, 10);

      chartInsumos = new Chart(chartInsumosCanvas.getContext("2d"), {
        type: "bar",
        data: {
          labels: insumos.map((item) => item.label),
          datasets: [{
            label: "Custo atual do insumo",
            data: insumos.map((item) => Number(item.currentCost || 0)),
            borderRadius: 8,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          plugins: { legend: { display: true } },
          scales: { x: { beginAtZero: true } },
        },
      });
    }
  }

  async function calcularCustosAtuais() {
    if (typeof carregarProdutos === "function" && (!produtosMap || Object.keys(produtosMap).length === 0)) {
      await carregarProdutos();
    }
    const stockRecords = await carregarEstoqueInsumosAtual();
    const { grouped, unidentifiedItems } = inferGroupedCosts(stockRecords);
    const produtos = calcularCustosProdutos(grouped);
    return { produtos, groupedCosts: grouped, unidentifiedItems, stockRecords };
  }

  async function recalcularCustos() {
    try {
      setStatus("Atualizando custos com base no estoque de insumos...");
      const resultado = await calcularCustosAtuais();
      await carregarHistoricoFechado();

      ultimoResultado = resultado;

      popularFiltroProdutos(resultado.produtos);
      renderKpis(resultado.produtos, resultado.groupedCosts);
      renderProdutosTable(resultado.produtos);
      renderInsumosTable(resultado.groupedCosts);
      renderNaoIdentificados(resultado.unidentifiedItems);
      renderCharts(resultado.produtos, resultado.groupedCosts);

      const grupos = Object.keys(resultado.groupedCosts).length;
      const pendentes = resultado.unidentifiedItems.length;
      if (pendentes > 0) {
        setStatus(`Custos atualizados. ${grupos} grupos identificados no estoque e ${pendentes} item(ns) não reconhecido(s).`, "error");
      } else {
        setStatus(`Custos atualizados. ${grupos} grupos identificados no estoque.`, "ok");
      }
    } catch (error) {
      console.error("Erro ao calcular custos de produção:", error);
      setStatus(error?.message || "Erro ao calcular os custos de produção.", "error");
    }
  }

  function reaplicarRenderComFiltro() {
    if (!ultimoResultado) return;
    renderKpis(ultimoResultado.produtos, ultimoResultado.groupedCosts);
    renderProdutosTable(ultimoResultado.produtos);
    renderCharts(ultimoResultado.produtos, ultimoResultado.groupedCosts);
  }

  async function gerarSnapshotCustosProducaoMensal(mesRef) {
    if (!db || !mesRef) return;
    const resultado = await calcularCustosAtuais();
    const latestTs = Math.max(
      0,
      ...Object.values(resultado.groupedCosts || {}).map((item) => Number(item.latestTimestamp || 0)).filter((n) => Number.isFinite(n))
    );

    const payload = {
      mesRef,
      ultimaBaseEstoqueTimestamp: latestTs || null,
      naoIdentificados: resultado.unidentifiedItems,
      produtos: resultado.produtos.map((produto) => ({
        recipeId: produto.recipeId,
        productLabel: produto.productLabel,
        salePrice: Number(produto.salePrice || 0),
        currentUnitCost: Number.isFinite(produto.currentUnitCost) ? Number(produto.currentUnitCost) : null,
        profitUnit: Number.isFinite(produto.profitUnit) ? Number(produto.profitUnit) : null,
        marginPct: Number.isFinite(produto.marginPct) ? Number(produto.marginPct) : null,
        isComplete: !!produto.isComplete,
        missingComponents: produto.missingComponents,
        usedReferenceCosts: produto.usedReferenceCosts || [],
      })),
      insumos: Object.values(resultado.groupedCosts || {}).map((item) => ({
        baseKey: item.baseKey,
        label: item.label,
        baseUnit: item.baseUnit,
        currentCost: Number.isFinite(item.currentCost) ? Number(item.currentCost) : null,
        totalBaseQty: Number(item.totalBaseQty || 0),
        recordCount: Number(item.recordCount || 0),
      })),
      fechadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("custosProducaoMensal").doc(mesRef).set(payload, { merge: true });
    historicoFechadoCache = [];
  }

  async function init() {
    if (!custosInitDone) {
      if (btnAtualizar) btnAtualizar.addEventListener("click", recalcularCustos);
      if (filtroProdutoEl) filtroProdutoEl.addEventListener("change", reaplicarRenderComFiltro);
      custosInitDone = true;
    }
    await recalcularCustos();
  }

  window.initCustosProdutos = init;
  window.gerarSnapshotCustosProducaoMensal = gerarSnapshotCustosProducaoMensal;
})();
