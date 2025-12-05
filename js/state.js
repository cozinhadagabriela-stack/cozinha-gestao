// ===== Estado global (mapas e flags) =====
const clientesMap = {};
const produtosMap = {};
const formasMap = {};

// Cache de últimas vendas
let ultimasVendasCache = [];

// Estados de edição
let editingClienteId = null;
let editingProdutoId = null;
let editingFormaId = null;
