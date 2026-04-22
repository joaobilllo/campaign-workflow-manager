const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { Pool } = require("pg");
const {
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
} = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

const pgConfig = {
  host: process.env.PG_HOST || "209.126.86.132",
  port: Number(process.env.PG_PORT || 8902),
  user: process.env.PG_USER || "Campanha",
  password: process.env.PG_PASSWORD || "&JwEpqC@I5haQ$FsXMqvaKSVYqxMNsED",
  database: process.env.PG_DATABASE || "ScrapGoogle_campanha",
  ssl: parseBool(process.env.PG_SSL, false)
    ? {
        rejectUnauthorized: parseBool(process.env.PG_SSL_REJECT_UNAUTHORIZED, false)
      }
    : false
};

let pgPool = null;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

function normalizeBaseUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const lower = String(value).trim().toLowerCase();
  return ["true", "1", "yes", "sim"].includes(lower);
}

function parsePositiveInt(value, defaultValue, min = 1, max = 5000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function getPostgresPool() {
  if (pgPool) {
    return pgPool;
  }

  pgPool = new Pool(pgConfig);
  return pgPool;
}

async function queryCampaignContactsFromPostgres({ segment = "recic", limit = 500 }) {
  const pool = getPostgresPool();
  const sql = `
    SELECT
      c.name AS nome,
      f.number AS numero,
      cat.name_category AS segmento,
      r.number_stars AS avaliacao,
      ca.localidade AS localidade,
      c.url_google AS url_google
    FROM fone f
    INNER JOIN company c ON c.id_company = f.id_company
    INNER JOIN category_company catcom ON c.id_company = catcom.id_company
    INNER JOIN category_names cat ON catcom.id_category_name = cat.id_category_name
    INNER JOIN reputation_stars r ON c.id_company = r.id_company
    INNER JOIN company_address ca ON c.id_company = ca.id_company
    WHERE f.number IS NOT NULL
      AND LOWER(cat.name_category) LIKE '%' || LOWER($1) || '%'
    ORDER BY c.name ASC
    LIMIT $2;
  `;

  const querySegment = String(segment || "recic").trim() || "recic";
  const queryLimit = parsePositiveInt(limit, 500, 1, 5000);
  const { rows } = await pool.query(sql, [querySegment, queryLimit]);
  return rows;
}

function parseMaybeJson(value, fallback = {}) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseCsvContacts(buffer) {
  const csvText = buffer.toString("utf8").trim();
  if (!csvText) {
    return [];
  }

  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const numberIndex = headers.findIndex((h) => h === "number");
  const validatedIndex = headers.findIndex((h) => h === "validated_whatsapp");
  const nameIndex = headers.findIndex((h) => h === "name");

  if (numberIndex === -1) {
    return [];
  }

  const contacts = [];

  for (let i = 1; i < lines.length; i += 1) {
    const columns = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const rawNumber = columns[numberIndex];
    const normalizedNumber = onlyDigits(rawNumber);

    if (!normalizedNumber) {
      continue;
    }

    const validatedValue = validatedIndex !== -1 ? columns[validatedIndex] : "";
    const contactName = nameIndex !== -1 ? columns[nameIndex] : "";

    contacts.push({
      number: normalizedNumber,
      name: contactName || "",
      validatedWhatsapp: parseBool(validatedValue, true)
    });
  }

  return contacts;
}

function normalizeContacts(rawContacts) {
  if (!Array.isArray(rawContacts)) {
    return [];
  }

  return rawContacts
    .map((contact) => ({
      number: onlyDigits(contact.number),
      name: (contact.name || "").trim(),
      validatedWhatsapp: parseBool(contact.validatedWhatsapp, true)
    }))
    .filter((contact) => Boolean(contact.number));
}

function parseMessageVariations(rawVariations, rawSingleBody) {
  let values = [];

  if (Array.isArray(rawVariations)) {
    values = rawVariations;
  } else if (typeof rawVariations === "string") {
    values = rawVariations.split(/\r?\n/);
  }

  const parsed = values.map((value) => String(value || "").trim()).filter(Boolean);

  if (!parsed.length && rawSingleBody) {
    parsed.push(String(rawSingleBody).trim());
  }

  return Array.from(new Set(parsed)).filter(Boolean);
}

function pickRandomMessageBody(variations) {
  const index = Math.floor(Math.random() * variations.length);
  return variations[index];
}

function extractValidatedNumbersFromEvolutionResponse(data) {
  const values = data && data.data ? data.data : data;

  if (Array.isArray(values)) {
    const set = new Set();
    values.forEach((item) => {
      if (typeof item === "string") {
        const normalized = onlyDigits(item);
        if (normalized) {
          set.add(normalized);
        }
        return;
      }

      const number = onlyDigits(item.number || item.phone || item.jid || "");
      const existsFlag = item.exists ?? item.valid ?? item.isValid ?? true;
      if (number && Boolean(existsFlag)) {
        set.add(number);
      }
    });
    return Array.from(set);
  }

  if (values && Array.isArray(values.numbers)) {
    return values.numbers.map((n) => onlyDigits(n)).filter(Boolean);
  }

  return [];
}

function buildNetworkErrorMessage(serviceName, endpoint, error) {
  const base = `${serviceName} falhou ao conectar em ${endpoint}`;
  const causeMessage = error && error.cause && error.cause.message ? error.cause.message : "";
  const ownMessage = error && error.message ? error.message : "";
  const details = [causeMessage, ownMessage].filter(Boolean).join(" | ");
  return details ? `${base}. Detalhes: ${details}` : base;
}

function normalizeBearerToken(token) {
  const value = String(token || "").trim();
  if (!value) {
    return "";
  }

  return value.replace(/^bearer\s+/i, "").trim();
}

async function validateNumbersOnEvolution({ evolutionUrl, evolutionApiKey, evolutionInstance, numbers }) {
  const endpoint = `${normalizeBaseUrl(evolutionUrl)}/chat/whatsappNumbers/${evolutionInstance}`;

  const headers = {
    "Content-Type": "application/json"
  };

  if (evolutionApiKey) {
    headers.apikey = evolutionApiKey;
    headers["x-api-key"] = evolutionApiKey;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ numbers })
    });
  } catch (error) {
    throw new Error(buildNetworkErrorMessage("Evolution", endpoint, error));
  }

  const responseText = await response.text();
  const parsed = parseMaybeJson(responseText, { raw: responseText });

  if (!response.ok) {
    const message = typeof parsed === "object" ? JSON.stringify(parsed) : responseText;
    throw new Error(`Evolution retornou erro ${response.status}: ${message}`);
  }

  return {
    endpoint,
    raw: parsed,
    validatedNumbers: extractValidatedNumbersFromEvolutionResponse(parsed)
  };
}

async function sendCampaignToNaty({ natyUrl, natyToken, campaignPayload }) {
  const base = normalizeBaseUrl(natyUrl);
  const endpoints = [`${base}/api/v2/messages`, `${base}/api/v2/messages/instantly`];

  const headers = {
    "Content-Type": "application/json"
  };

  const normalizedToken = normalizeBearerToken(natyToken);
  if (normalizedToken) {
    headers.Authorization = `Bearer ${normalizedToken}`;
  }

  let lastErrorMessage = "";

  for (let i = 0; i < endpoints.length; i += 1) {
    const endpoint = endpoints[i];
    let response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(campaignPayload)
      });
    } catch (error) {
      throw new Error(buildNetworkErrorMessage("Naty", endpoint, error));
    }

    const responseText = await response.text();
    const parsed = parseMaybeJson(responseText, { raw: responseText });

    if (response.ok) {
      return {
        endpoint,
        raw: parsed
      };
    }

    const message = typeof parsed === "object" ? JSON.stringify(parsed) : responseText;
    lastErrorMessage = `Naty retornou erro ${response.status} em ${endpoint}: ${message}`;

    const hasFallback = i < endpoints.length - 1;
    if (response.status !== 404 || !hasFallback) {
      throw new Error(lastErrorMessage);
    }
  }

  throw new Error(lastErrorMessage || "Naty retornou erro desconhecido");
}

async function fetchNatyQueues({ natyUrl, natyToken }) {
  const endpoint = `${normalizeBaseUrl(natyUrl)}/api/v2/queues`;

  const headers = {
    "Content-Type": "application/json"
  };

  const normalizedToken = normalizeBearerToken(natyToken);
  if (normalizedToken) {
    headers.Authorization = `Bearer ${normalizedToken}`;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers
    });
  } catch (error) {
    throw new Error(buildNetworkErrorMessage("Naty", endpoint, error));
  }

  const responseText = await response.text();
  const parsed = parseMaybeJson(responseText, { raw: responseText });

  if (!response.ok) {
    const message = typeof parsed === "object" ? JSON.stringify(parsed) : responseText;
    throw new Error(`Naty retornou erro ${response.status} em ${endpoint}: ${message}`);
  }

  const queues = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];

  return {
    endpoint,
    raw: parsed,
    queues
  };
}

async function fetchNatyChannels({ natyUrl, natyToken }) {
  const endpoint = `${normalizeBaseUrl(natyUrl)}/api/v2/channels`;

  const headers = {
    "Content-Type": "application/json"
  };

  const normalizedToken = normalizeBearerToken(natyToken);
  if (normalizedToken) {
    headers.Authorization = `Bearer ${normalizedToken}`;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers
    });
  } catch (error) {
    throw new Error(buildNetworkErrorMessage("Naty", endpoint, error));
  }

  const responseText = await response.text();
  const parsed = parseMaybeJson(responseText, { raw: responseText });

  if (!response.ok) {
    const message = typeof parsed === "object" ? JSON.stringify(parsed) : responseText;
    throw new Error(`Naty retornou erro ${response.status} em ${endpoint}: ${message}`);
  }

  const channels = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];

  return {
    endpoint,
    raw: parsed,
    channels
  };
}

async function uploadMediaToNaty({ natyUrl, natyToken, file }) {
  const endpoint = `${normalizeBaseUrl(natyUrl)}/api/v2/medias`;

  const headers = {};
  const normalizedToken = normalizeBearerToken(natyToken);
  if (normalizedToken) {
    headers.Authorization = `Bearer ${normalizedToken}`;
  }

  const fieldCandidates = ["file", "media", "medias", "arquivo", "attachment"];
  let lastErrorMessage = "";

  for (let i = 0; i < fieldCandidates.length; i += 1) {
    const fieldName = fieldCandidates[i];
    const formData = new FormData();
    const blob = new Blob([file.buffer], {
      type: file.mimetype || "application/octet-stream"
    });
    formData.append(fieldName, blob, file.originalname || "media.bin");

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: formData
      });
    } catch (error) {
      throw new Error(buildNetworkErrorMessage("Naty", endpoint, error));
    }

    const responseText = await response.text();
    const parsed = parseMaybeJson(responseText, { raw: responseText });

    if (response.ok) {
      const mediaKeys = Array.isArray(parsed?.data?.mediaKeys)
        ? parsed.data.mediaKeys
        : Array.isArray(parsed?.mediaKeys)
          ? parsed.mediaKeys
          : [];

      const fileName = String(file.originalname || "").toLowerCase();
      let mediaType = "document";
      if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName)) {
        mediaType = "image";
      } else if (/\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(fileName)) {
        mediaType = "video";
      }

      return {
        endpoint,
        raw: parsed,
        mediaKeys,
        usedFieldName: fieldName,
        mediaType
      };
    }

    const message = typeof parsed === "object" ? JSON.stringify(parsed) : responseText;
    lastErrorMessage = `Naty retornou erro ${response.status} em ${endpoint}: ${message}`;

    const isUnexpectedField =
      response.status === 400 &&
      String(message).toLowerCase().includes("unexpected field");

    const hasNextCandidate = i < fieldCandidates.length - 1;
    if (!isUnexpectedField || !hasNextCandidate) {
      throw new Error(lastErrorMessage);
    }
  }

  throw new Error(lastErrorMessage || "Erro ao subir midia na Naty");
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/postgres/health", async (req, res) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query("SELECT NOW() AS now");
    return res.json({
      success: true,
      connection: {
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        user: pgConfig.user
      },
      now: result.rows && result.rows[0] ? result.rows[0].now : null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao conectar no PostgreSQL"
    });
  }
});

app.get("/api/postgres/contacts", async (req, res) => {
  try {
    const segment = String(req.query.segment || "recic").trim();
    const limit = parsePositiveInt(req.query.limit, 500, 1, 5000);
    const rows = await queryCampaignContactsFromPostgres({ segment, limit });

    return res.json({
      success: true,
      filters: {
        segment,
        limit
      },
      total: rows.length,
      contacts: rows
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao consultar contatos no PostgreSQL"
    });
  }
});

app.get("/api/postgres/contacts/simple", async (req, res) => {
  try {
    const segment = String(req.query.segment || "recic").trim();
    const limit = parsePositiveInt(req.query.limit, 500, 1, 5000);
    const rows = await queryCampaignContactsFromPostgres({ segment, limit });

    const contacts = rows
      .map((row) => ({
        number: onlyDigits(row.numero),
        name: String(row.nome || "").trim(),
        segment: row.segmento || ""
      }))
      .filter((item) => Boolean(item.number));

    return res.json({
      success: true,
      filters: {
        segment,
        limit
      },
      total: contacts.length,
      contacts
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao consultar contatos simplificados no PostgreSQL"
    });
  }
});

app.get("/api/settings/integration", (req, res) => {
  try {
    const config = getIntegrationSettings();
    return res.json({ success: true, config });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar configuracoes"
    });
  }
});

app.put("/api/settings/integration", (req, res) => {
  try {
    const payload = parseMaybeJson(req.body.config, req.body || {});
    const saved = saveIntegrationSettings({
      natyUrl: payload.natyUrl,
      natyToken: payload.natyToken,
      evolutionUrl: payload.evolutionUrl,
      evolutionInstance: payload.evolutionInstance,
      evolutionApiKey: payload.evolutionApiKey,
      validateOnEvolution: parseBool(payload.validateOnEvolution, true),
      onlyCsvValidated: parseBool(payload.onlyCsvValidated, false)
    });

    return res.json({ success: true, config: saved });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao salvar configuracoes"
    });
  }
});

app.get("/api/message-templates", (req, res) => {
  try {
    const templates = listMessageTemplates();
    return res.json({ success: true, templates });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao listar mensagens"
    });
  }
});

app.post("/api/message-templates", (req, res) => {
  try {
    const body = req.body && req.body.body ? req.body.body : "";
    const created = addMessageTemplate(body);
    return res.json({ success: true, template: created });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || "Erro ao criar mensagem"
    });
  }
});

app.delete("/api/message-templates/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "ID invalido." });
    }

    const deleted = deleteMessageTemplate(id);
    return res.json({ success: true, deleted });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao remover mensagem"
    });
  }
});

app.get("/api/logs", (req, res) => {
  try {
    const limit = Number(req.query.limit || 200);
    const logs = listRunLogs(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 1000) : 200);
    return res.json({ success: true, logs });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || "Erro ao listar logs" });
  }
});

app.post("/api/logs", (req, res) => {
  try {
    const entry = parseMaybeJson(req.body.entry, req.body || {});
    addRunLog(entry);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || "Erro ao salvar log" });
  }
});

app.delete("/api/logs", (req, res) => {
  try {
    clearRunLogs();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || "Erro ao limpar logs" });
  }
});

app.get("/api/manual-routes", (req, res) => {
  try {
    const routes = listManualRoutes();
    return res.json({ success: true, routes });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao listar rotas manuais"
    });
  }
});

app.post("/api/manual-routes", (req, res) => {
  try {
    const payload = parseMaybeJson(req.body.route, req.body || {});
    const created = addManualRoute(payload);
    return res.json({ success: true, route: created });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || "Erro ao criar rota manual"
    });
  }
});

app.put("/api/manual-routes/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "ID invalido." });
    }

    const payload = parseMaybeJson(req.body.route, req.body || {});
    const updated = updateManualRoute(id, payload);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Rota nao encontrada." });
    }

    return res.json({ success: true, route: updated });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || "Erro ao atualizar rota manual"
    });
  }
});

app.delete("/api/manual-routes/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "ID invalido." });
    }

    const deleted = deleteManualRoute(id);
    return res.json({ success: true, deleted });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao remover rota manual"
    });
  }
});

app.post("/api/naty/queues", async (req, res) => {
  try {
    const config = parseMaybeJson(req.body.config, req.body || {});

    if (!config.natyUrl || !config.natyToken) {
      return res.status(400).json({
        success: false,
        error: "Configure URL e token da Naty na pagina Integracoes antes de consultar filas."
      });
    }

    const result = await fetchNatyQueues({
      natyUrl: config.natyUrl,
      natyToken: config.natyToken
    });

    return res.json({
      success: true,
      endpoint: result.endpoint,
      totalQueues: result.queues.length,
      queues: result.queues,
      raw: result.raw
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao consultar filas na Naty"
    });
  }
});

app.post("/api/naty/channels", async (req, res) => {
  try {
    const config = parseMaybeJson(req.body.config, req.body || {});

    if (!config.natyUrl || !config.natyToken) {
      return res.status(400).json({
        success: false,
        error: "Configure URL e token da Naty na pagina Integracoes antes de consultar canais."
      });
    }

    const result = await fetchNatyChannels({
      natyUrl: config.natyUrl,
      natyToken: config.natyToken
    });

    return res.json({
      success: true,
      endpoint: result.endpoint,
      totalChannels: result.channels.length,
      channels: result.channels,
      raw: result.raw
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao consultar canais na Naty"
    });
  }
});

app.post("/api/naty/medias", upload.single("mediaFile"), async (req, res) => {
  try {
    const dbConfig = getIntegrationSettings();
    const requestConfig = parseMaybeJson(req.body.config, req.body || {});
    const config = {
      ...dbConfig,
      ...requestConfig
    };

    if (!config.natyUrl || !config.natyToken) {
      return res.status(400).json({
        success: false,
        error: "Configure URL e token da Naty na pagina Integracoes antes de subir midia."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Selecione um arquivo para upload de midia."
      });
    }

    const result = await uploadMediaToNaty({
      natyUrl: config.natyUrl,
      natyToken: config.natyToken,
      file: req.file
    });

    return res.json({
      success: true,
      endpoint: result.endpoint,
      usedFieldName: result.usedFieldName,
      mediaKeys: result.mediaKeys,
      mediaKey: result.mediaKeys[0] || "",
      mediaType: result.mediaType,
      raw: result.raw
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao subir midia na Naty"
    });
  }
});

app.post("/api/campaign/run", upload.single("contactsFile"), async (req, res) => {
  try {
    const dbConfig = getIntegrationSettings();
    const requestConfig = parseMaybeJson(req.body.config, req.body.config || {});
    const config = {
      ...dbConfig,
      ...requestConfig
    };
    const campaign = parseMaybeJson(req.body.campaign, req.body.campaign || {});
    const campaignChannelId = campaign.channelId || campaign.chanellId;
    const rawContacts = parseMaybeJson(req.body.contacts, []);

    const contactsFromBody = normalizeContacts(rawContacts);
    const contactsFromCsv = req.file ? parseCsvContacts(req.file.buffer) : [];
    const contacts = [...contactsFromBody, ...contactsFromCsv];

    if (!contacts.length) {
      return res.status(400).json({
        error: "Nenhum contato enviado. Informe contatos manuais ou faça upload de CSV."
      });
    }

    const requiredCampaignFields = ["name", "queueId", "ticketStatus"];
    const missingFields = requiredCampaignFields.filter((field) => !campaign[field]);
    if (!campaignChannelId) {
      missingFields.push("channelId");
    }
    if (missingFields.length) {
      return res.status(400).json({
        error: `Campos da campanha obrigatorios ausentes: ${missingFields.join(", ")}`
      });
    }

    const requiredConfigFields = ["evolutionUrl", "evolutionInstance", "natyUrl"];
    const missingConfig = requiredConfigFields.filter((field) => !config[field]);
    if (missingConfig.length) {
      return res.status(400).json({
        error: `Campos de configuracao obrigatorios ausentes: ${missingConfig.join(", ")}`
      });
    }

    const validateOnEvolution = parseBool(config.validateOnEvolution, true);
    const onlyCsvValidated = parseBool(config.onlyCsvValidated, false);
    const messageVariations = parseMessageVariations(campaign.messageVariations, campaign.messageBody);
    if (messageVariations.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Informe no minimo 3 variacoes de mensagem para distribuicao aleatoria na campanha."
      });
    }

    const minMsgInterval = Number(campaign.minMsgInterval || 120000);
    const maxMsgInterval = Number(campaign.maxMsgInterval || 140000);

    const dedupMap = new Map();
    contacts.forEach((contact) => {
      if (!dedupMap.has(contact.number)) {
        dedupMap.set(contact.number, contact);
      }
    });

    let dedupContacts = Array.from(dedupMap.values());

    if (onlyCsvValidated) {
      dedupContacts = dedupContacts.filter((contact) => contact.validatedWhatsapp);
    }

    let validatedNumbers = dedupContacts.map((contact) => contact.number);
    let evolutionResult = null;

    if (validateOnEvolution) {
      evolutionResult = await validateNumbersOnEvolution({
        evolutionUrl: config.evolutionUrl,
        evolutionApiKey: config.evolutionApiKey,
        evolutionInstance: config.evolutionInstance,
        numbers: validatedNumbers
      });

      const validSet = new Set(evolutionResult.validatedNumbers);
      validatedNumbers = validatedNumbers.filter((number) => validSet.has(number));
    }

    if (!validatedNumbers.length) {
      return res.status(400).json({
        error: "Nenhum numero valido para envio apos validacoes.",
        totalRecebidos: contacts.length,
        totalUnicos: dedupContacts.length
      });
    }

    const numberToContact = new Map(dedupContacts.map((c) => [c.number, c]));
    const variationUsage = {};
    const mediaKey = String(campaign.mediaKey || "").trim();
    const mediaType = String(campaign.mediaType || "none").trim().toLowerCase();
    const normalizedMediaType = ["image", "video", "document"].includes(mediaType) ? mediaType : "none";

    if (mediaKey && normalizedMediaType === "none") {
      return res.status(400).json({
        success: false,
        error: "Para campanha com mediaKey, informe mediaType (image, video ou document)."
      });
    }

    const messages = validatedNumbers.map((number) => {
      const contact = numberToContact.get(number);
      const fallbackName = campaign.contactDefaultName || "Contato";
      const selectedBody = pickRandomMessageBody(messageVariations);
      variationUsage[selectedBody] = (variationUsage[selectedBody] || 0) + 1;
      return {
        number,
        name: contact && contact.name ? contact.name : fallbackName,
        body: selectedBody,
        ...(mediaKey ? { mediaKey, mediaType: normalizedMediaType } : {})
      };
    });

    const campaignPayload = {
      name: campaign.name,
      channelId: campaignChannelId,
      chanellId: campaignChannelId,
      queueId: campaign.queueId,
      ticketStatus: campaign.ticketStatus || "closed",
      minMsgInterval,
      maxMsgInterval,
      messages,
      ...(mediaKey ? { mediaKeys: [mediaKey], mediaType: normalizedMediaType } : {})
    };

    const natyResult = await sendCampaignToNaty({
      natyUrl: config.natyUrl,
      natyToken: config.natyToken,
      campaignPayload
    });

    return res.json({
      success: true,
      summary: {
        channelIdUtilizado: campaignChannelId,
        totalRecebidos: contacts.length,
        totalUnicos: dedupContacts.length,
        totalValidados: validatedNumbers.length,
        envioMensagemCount: messages.length,
        mediaKeyUtilizada: mediaKey || null,
        mediaTypeUtilizada: mediaKey ? normalizedMediaType : null,
        variacoesMensagemCount: messageVariations.length,
        distribuicaoVariacoes: variationUsage,
        validacaoEvolutionAtiva: validateOnEvolution,
        filtroCsvValidatedAtivo: onlyCsvValidated
      },
      evolution: evolutionResult
        ? {
            endpoint: evolutionResult.endpoint,
            totalRetornado: evolutionResult.validatedNumbers.length
          }
        : null,
      naty: {
        endpoint: natyResult.endpoint,
        response: natyResult.raw
      }
    });
  } catch (error) {
    if (error && typeof error.message === "string" && error.message.includes("ERR_NO_WAPP_FOUND")) {
      return res.status(400).json({
        success: false,
        error:
          `${error.message} | Dica: confira o channelId e se a conexao WhatsApp existe/esta ativa na Naty para esse token.`
      });
    }

    if (error && typeof error.message === "string" && error.message.includes("ERR_WHATSAPP_DISCONNECTED")) {
      return res.status(400).json({
        success: false,
        error:
          `${error.message} | Dica: conecte novamente o WhatsApp da sessao no painel da Naty (ou use outro channelId que esteja conectado).`
      });
    }

    console.error("Erro ao processar campanha:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro inesperado ao processar campanha"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor ativo em http://localhost:${PORT}`);
});