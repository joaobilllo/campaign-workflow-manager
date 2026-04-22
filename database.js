const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "app-db.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readDb() {
  if (!fs.existsSync(dbPath)) {
    return {
      integration: {},
      messageTemplates: [],
      manualRoutes: [],
      logs: [],
      counters: {
        messageTemplate: 0,
        manualRoute: 0,
        log: 0
      }
    };
  }

  try {
    const content = fs.readFileSync(dbPath, "utf8");
    const parsed = JSON.parse(content);
    return {
      integration: parsed.integration || {},
      messageTemplates: Array.isArray(parsed.messageTemplates) ? parsed.messageTemplates : [],
      manualRoutes: Array.isArray(parsed.manualRoutes) ? parsed.manualRoutes : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      counters: {
        messageTemplate: Number(parsed?.counters?.messageTemplate || 0),
        manualRoute: Number(parsed?.counters?.manualRoute || 0),
        log: Number(parsed?.counters?.log || 0)
      }
    };
  } catch {
    return {
      integration: {},
      messageTemplates: [],
      manualRoutes: [],
      logs: [],
      counters: {
        messageTemplate: 0,
        manualRoute: 0,
        log: 0
      }
    };
  }
}

function writeDb(state) {
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2), "utf8");
}

function getIntegrationSettings() {
  const db = readDb();
  return db.integration || {};
}

function saveIntegrationSettings(config) {
  const db = readDb();
  db.integration = {
    natyUrl: String(config.natyUrl || "").trim(),
    natyToken: String(config.natyToken || "").trim(),
    evolutionUrl: String(config.evolutionUrl || "").trim(),
    evolutionInstance: String(config.evolutionInstance || "").trim(),
    evolutionApiKey: String(config.evolutionApiKey || "").trim(),
    validateOnEvolution: Boolean(config.validateOnEvolution),
    onlyCsvValidated: Boolean(config.onlyCsvValidated),
    updatedAt: new Date().toISOString()
  };
  writeDb(db);
  return db.integration;
}

function listMessageTemplates() {
  const db = readDb();
  return [...db.messageTemplates].sort((a, b) => b.id - a.id);
}

function addMessageTemplate(body) {
  const normalized = String(body || "").trim();
  if (!normalized) {
    throw new Error("Mensagem vazia nao pode ser cadastrada.");
  }

  const db = readDb();
  const exists = db.messageTemplates.some((item) => item.body === normalized);
  if (exists) {
    throw new Error("Essa mensagem ja foi cadastrada.");
  }

  db.counters.messageTemplate += 1;
  const created = {
    id: db.counters.messageTemplate,
    body: normalized,
    createdAt: new Date().toISOString()
  };
  db.messageTemplates.push(created);
  writeDb(db);
  return created;
}

function deleteMessageTemplate(id) {
  const db = readDb();
  const before = db.messageTemplates.length;
  db.messageTemplates = db.messageTemplates.filter((item) => item.id !== Number(id));
  writeDb(db);
  return db.messageTemplates.length < before;
}

function listRunLogs(limit = 200) {
  const db = readDb();
  return [...db.logs].sort((a, b) => b.id - a.id).slice(0, limit);
}

function addRunLog(entry) {
  const db = readDb();
  db.counters.log += 1;
  db.logs.push({
    id: db.counters.log,
    createdAt: entry.createdAt || new Date().toISOString(),
    campaignName: entry.campaignName || "Sem nome",
    status: entry.status || "erro",
    sentCount: Number(entry.sentCount || 0),
    details: entry.details || null
  });
  writeDb(db);
}

function clearRunLogs() {
  const db = readDb();
  db.logs = [];
  writeDb(db);
}

function normalizeManualRoutePayload(payload) {
  const method = String(payload.method || "GET").trim().toUpperCase();
  const name = String(payload.name || "").trim();
  const routePath = String(payload.path || "").trim();
  const description = String(payload.description || "").trim();

  if (!name) {
    throw new Error("Nome da rota e obrigatorio.");
  }

  if (!routePath) {
    throw new Error("Path da rota e obrigatorio.");
  }

  const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  if (!allowedMethods.includes(method)) {
    throw new Error("Metodo invalido. Use GET, POST, PUT, PATCH ou DELETE.");
  }

  return {
    name,
    method,
    path: routePath,
    description,
    updatedAt: new Date().toISOString()
  };
}

function listManualRoutes() {
  const db = readDb();
  return [...db.manualRoutes].sort((a, b) => b.id - a.id);
}

function addManualRoute(payload) {
  const db = readDb();
  const normalized = normalizeManualRoutePayload(payload || {});

  db.counters.manualRoute += 1;
  const created = {
    id: db.counters.manualRoute,
    createdAt: new Date().toISOString(),
    ...normalized
  };

  db.manualRoutes.push(created);
  writeDb(db);
  return created;
}

function updateManualRoute(id, payload) {
  const db = readDb();
  const routeId = Number(id);
  const index = db.manualRoutes.findIndex((item) => item.id === routeId);
  if (index === -1) {
    return null;
  }

  const normalized = normalizeManualRoutePayload(payload || {});
  const updated = {
    ...db.manualRoutes[index],
    ...normalized
  };

  db.manualRoutes[index] = updated;
  writeDb(db);
  return updated;
}

function deleteManualRoute(id) {
  const db = readDb();
  const before = db.manualRoutes.length;
  db.manualRoutes = db.manualRoutes.filter((item) => item.id !== Number(id));
  writeDb(db);
  return db.manualRoutes.length < before;
}

module.exports = {
  getIntegrationSettings,
  saveIntegrationSettings,
  listMessageTemplates,
  addMessageTemplate,
  deleteMessageTemplate,
  listRunLogs,
  addRunLog,
  clearRunLogs,
  listManualRoutes,
  addManualRoute,
  updateManualRoute,
  deleteManualRoute
};
