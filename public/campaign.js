const form = document.getElementById("campaignForm");
const resultElement = document.getElementById("result");
const submitButton = document.getElementById("submitBtn");
const messageListElement = document.getElementById("messageList");
const addMessageBtn = document.getElementById("addMessageBtn");
const newMessageInput = document.getElementById("newMessageInput");
const uploadMediaBtn = document.getElementById("uploadMediaBtn");
const mediaFileInput = document.getElementById("mediaFileInput");
const mediaKeyInput = document.getElementById("mediaKeyInput");
const contactsFileInput = document.getElementById("contactsFileInput");
const contactsFileName = document.getElementById("contactsFileName");
const mediaFileName = document.getElementById("mediaFileName");
const mediaTypeSelect = document.getElementById("mediaTypeSelect");
const enableMediaCheckbox = document.getElementById("enableMediaCheckbox");
const mediaConfigWrap = document.getElementById("mediaConfigWrap");
const mediaKeyFieldWrap = document.getElementById("mediaKeyFieldWrap");
const mediaUploadFieldWrap = document.getElementById("mediaUploadFieldWrap");
const channelIdSelect = document.getElementById("channelIdSelect");
const queueIdSelect = document.getElementById("queueIdSelect");
const campaignDbSegmentInput = document.getElementById("campaignDbSegment");
const campaignDbLimitInput = document.getElementById("campaignDbLimit");
const loadDbValidatedContactsBtn = document.getElementById("loadDbValidatedContactsBtn");
const dbValidatedContactsPreview = document.getElementById("dbValidatedContactsPreview");
const dbValidatedContactsMeta = document.getElementById("dbValidatedContactsMeta");

let messageTemplates = [];
let dbValidatedContacts = [];

function updateCampaignSubmitAvailability() {
  if (!submitButton) {
    return;
  }

  const hasValidatedContacts = Array.isArray(dbValidatedContacts) && dbValidatedContacts.length > 0;
  submitButton.disabled = !hasValidatedContacts;
  submitButton.title = hasValidatedContacts
    ? ""
    : "Busque e valide os contatos no banco antes de rodar a campanha.";
}

function normalizeEntityId(entity, fallbackKeys = []) {
  const keys = ["id", ...fallbackKeys];
  for (const key of keys) {
    const value = entity && entity[key] !== undefined && entity[key] !== null ? String(entity[key]).trim() : "";
    if (value) {
      return value;
    }
  }
  return "";
}

function normalizeEntityLabel(entity, fallbackKeys = []) {
  const keys = ["name", ...fallbackKeys];
  for (const key of keys) {
    const value = entity && entity[key] !== undefined && entity[key] !== null ? String(entity[key]).trim() : "";
    if (value) {
      return value;
    }
  }
  return "";
}

function isConnectedStatus(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toUpperCase();
  return ["CONNECTED", "OPEN", "ONLINE", "READY", "TRUE", "ACTIVE"].includes(normalized);
}

function isChannelConnected(channel) {
  const statuses = [];

  if (Array.isArray(channel && channel.whatsapps) && channel.whatsapps.length) {
    channel.whatsapps.forEach((whatsapp) => {
      statuses.push(whatsapp && whatsapp.status !== undefined ? whatsapp.status : "");
    });
  }

  statuses.push(channel && channel.status !== undefined ? channel.status : "");
  statuses.push(channel && channel.active !== undefined ? channel.active : "");

  return statuses.some((status) => isConnectedStatus(status));
}

function setSelectSingleOption(selectElement, text, { value = "", disabled = false } = {}) {
  if (!selectElement) {
    return;
  }

  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  option.disabled = disabled;
  option.selected = true;

  selectElement.innerHTML = "";
  selectElement.appendChild(option);
  selectElement.disabled = disabled;
}

function populateRouteSelect(selectElement, items, {
  emptyText,
  defaultText,
  entityName,
  idKeys = [],
  labelKeys = []
} = {}) {
  if (!selectElement) {
    return;
  }

  const previousValue = String(selectElement.value || "").trim();
  const normalizedItems = Array.isArray(items) ? items : [];
  const mapped = normalizedItems
    .map((item) => {
      const id = normalizeEntityId(item, idKeys);
      const label = normalizeEntityLabel(item, labelKeys);
      return {
        id,
        label: label || `${entityName || "Item"} sem nome`
      };
    })
    .filter((item) => Boolean(item.id));

  if (!mapped.length) {
    setSelectSingleOption(selectElement, emptyText || "Nenhum item encontrado.", {
      value: "",
      disabled: true
    });
    return;
  }

  selectElement.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = defaultText || "Selecione uma opcao";
  placeholder.disabled = true;
  placeholder.selected = true;
  selectElement.appendChild(placeholder);

  mapped.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    selectElement.appendChild(option);
  });

  if (previousValue && mapped.some((item) => item.id === previousValue)) {
    selectElement.value = previousValue;
  }

  selectElement.disabled = false;
}

async function fetchRouteOptions(endpoint, config) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ config })
  });

  const data = await response.json();
  if (!response.ok) {
    throw data;
  }

  return data;
}

async function loadChannelAndQueueOptions() {
  if (channelIdSelect) {
    setSelectSingleOption(channelIdSelect, "Carregando canais...", { disabled: true });
  }
  if (queueIdSelect) {
    setSelectSingleOption(queueIdSelect, "Carregando filas...", { disabled: true });
  }

  let integration = {};
  try {
    integration = await withGlobalLoading(
      () => getIntegrationConfig(),
      "Carregando configuracoes da campanha..."
    );
  } catch (error) {
    setSelectSingleOption(channelIdSelect, "Erro ao carregar integracoes.", { disabled: true });
    setSelectSingleOption(queueIdSelect, "Erro ao carregar integracoes.", { disabled: true });
    return;
  }

  if (!integration.natyUrl || !integration.natyToken) {
    setSelectSingleOption(channelIdSelect, "Configure Integracoes para listar canais.", { disabled: true });
    setSelectSingleOption(queueIdSelect, "Configure Integracoes para listar filas.", { disabled: true });
    return;
  }

  try {
    const [channelsResponse, queuesResponse] = await Promise.all([
      fetchRouteOptions("/api/naty/channels", integration),
      fetchRouteOptions("/api/naty/queues", integration)
    ]);

    const connectedChannels = (channelsResponse.channels || []).filter((channel) => isChannelConnected(channel));

    populateRouteSelect(channelIdSelect, connectedChannels, {
      emptyText: "Nenhum canal conectado encontrado.",
      defaultText: "Selecione o canal",
      entityName: "Canal",
      idKeys: ["channelId"],
      labelKeys: ["channelName", "title"]
    });

    populateRouteSelect(queueIdSelect, queuesResponse.queues || [], {
      emptyText: "Nenhuma fila retornada.",
      defaultText: "Selecione a fila",
      entityName: "Fila",
      idKeys: ["queueId"],
      labelKeys: ["queueName", "title"]
    });
  } catch (error) {
    setSelectSingleOption(channelIdSelect, "Erro ao consultar canais.", { disabled: true });
    setSelectSingleOption(queueIdSelect, "Erro ao consultar filas.", { disabled: true });
    notify(extractErrorMessage(error, "Nao foi possivel carregar canais e filas."), "error");
  }
}

function parseManualContacts(text) {
  if (!text.trim()) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [number, name] = line.split(",");
      return {
        number: (number || "").replace(/\D/g, ""),
        name: (name || "").trim(),
        validatedWhatsapp: true
      };
    })
    .filter((contact) => Boolean(contact.number));
}

function parsePositiveInt(value, fallback = 500, min = 1, max = 5000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function readDbFilters() {
  const segment = String((campaignDbSegmentInput && campaignDbSegmentInput.value) || "recic").trim() || "recic";
  const limit = parsePositiveInt(campaignDbLimitInput && campaignDbLimitInput.value, 200, 1, 5000);
  return { segment, limit };
}

function renderDbValidatedContactsPreview() {
  if (!dbValidatedContactsPreview) {
    return;
  }

  if (!Array.isArray(dbValidatedContacts) || !dbValidatedContacts.length) {
    dbValidatedContactsPreview.value = "";
    if (dbValidatedContactsMeta) {
      dbValidatedContactsMeta.textContent = "Nenhum contato validado carregado.";
    }
    updateCampaignSubmitAvailability();
    return;
  }

  dbValidatedContactsPreview.value = dbValidatedContacts
    .map((contact) => `${contact.number},${contact.name || ""}`)
    .join("\n");

  if (dbValidatedContactsMeta) {
    dbValidatedContactsMeta.textContent = `${dbValidatedContacts.length} contato(s) validados e prontos para campanha.`;
  }

  updateCampaignSubmitAvailability();
}

async function loadValidatedContactsForCampaign() {
  const { segment, limit } = readDbFilters();

  try {
    const integration = await withGlobalLoading(
      () => getIntegrationConfig(),
      "Carregando configuracoes para validar contatos..."
    );

    if (!integration.evolutionUrl || !integration.evolutionInstance) {
      throw {
        success: false,
        error: "Configure Evolution URL e Instance na pagina Integracoes antes de buscar contatos validados."
      };
    }

    const data = await withGlobalLoading(
      () => apiRequest("/api/campaign/contacts-from-db", {
        method: "POST",
        body: JSON.stringify({
          filters: { segment, limit },
          config: integration
        })
      }),
      "Buscando contatos no banco e validando na Evolution..."
    );

    dbValidatedContacts = (data.contacts || []).map((contact) => ({
      number: String(contact.number || "").replace(/\D/g, ""),
      name: String(contact.name || "").trim(),
      validatedWhatsapp: true
    })).filter((contact) => Boolean(contact.number));

    renderDbValidatedContactsPreview();
    showResult(data, false);

    notify(`${dbValidatedContacts.length} contato(s) validado(s) para campanha.`, "success");
  } catch (error) {
    dbValidatedContacts = [];
    renderDbValidatedContactsPreview();
    showResult(error, true);
    notify(extractErrorMessage(error, "Erro ao carregar contatos validados do banco."), "error");
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMessageTemplates() {
  if (!messageListElement) {
    return;
  }

  if (!messageTemplates.length) {
    messageListElement.innerHTML = '<p class="empty-messages">Nenhuma mensagem cadastrada ainda.</p>';
    return;
  }

  messageListElement.innerHTML = messageTemplates
    .map((message) => {
      const safeMessage = escapeHtml(message.body || "");
      const templateId = Number(message.id);
      return `
        <div class="message-item">
          <label class="message-select">
            <input type="checkbox" class="message-check" data-id="${templateId}" checked />
            <span>${safeMessage}</span>
          </label>
          <button type="button" class="remove-message-btn" data-remove-id="${templateId}">Remover</button>
        </div>
      `;
    })
    .join("");
}

async function loadMessageTemplates() {
  try {
    const templates = await getMessageTemplates();
    messageTemplates = Array.isArray(templates) ? templates : [];
    renderMessageTemplates();
  } catch (error) {
    notify(extractErrorMessage(error, "Erro ao carregar mensagens cadastradas."), "error");
  }
}

async function addMessageTemplate(messageText) {
  const normalized = String(messageText || "").trim();
  if (!normalized) {
    notify("Digite uma mensagem antes de adicionar.", "error");
    return;
  }

  try {
    await withGlobalLoading(
      () => addMessageTemplateApi(normalized),
      "Criando mensagem..."
    );
    await loadMessageTemplates();
    notify("Mensagem criada com sucesso.", "success");
  } catch (error) {
    notify(extractErrorMessage(error, "Erro ao cadastrar mensagem."), "error");
  }
}

function getSelectedMessages() {
  const selected = Array.from(document.querySelectorAll(".message-check:checked"))
    .map((checkbox) => Number(checkbox.dataset.id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .map((id) => messageTemplates.find((template) => Number(template.id) === id))
    .map((template) => (template ? template.body : ""))
    .filter(Boolean);

  return Array.from(new Set(selected));
}

if (addMessageBtn && newMessageInput) {
  addMessageBtn.addEventListener("click", async () => {
    await addMessageTemplate(newMessageInput.value);
    newMessageInput.value = "";
    newMessageInput.focus();
  });

  newMessageInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    await addMessageTemplate(newMessageInput.value);
    newMessageInput.value = "";
  });
}

if (messageListElement) {
  messageListElement.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-remove-id]");
    if (!removeButton) {
      return;
    }

    const removeId = Number(removeButton.dataset.removeId);
    if (!Number.isInteger(removeId) || removeId <= 0) {
      return;
    }

    const confirmed = await confirmAction("Tem certeza que deseja excluir esta mensagem?");
    if (!confirmed) {
      return;
    }

    try {
      await withGlobalLoading(
        () => deleteMessageTemplateApi(removeId),
        "Excluindo mensagem..."
      );
      await loadMessageTemplates();
      notify("Mensagem excluida com sucesso.", "success");
    } catch (error) {
      notify(extractErrorMessage(error, "Erro ao excluir mensagem."), "error");
    }
  });
}

async function initCampaignPage() {
  try {
    await withGlobalLoading(
      () => Promise.all([loadMessageTemplates(), loadChannelAndQueueOptions()]),
      "Carregando dados da campanha..."
    );
  } catch (error) {
    notify(extractErrorMessage(error, "Erro ao inicializar a tela de campanha."), "error");
  }
}

initCampaignPage();
renderDbValidatedContactsPreview();
updateCampaignSubmitAvailability();

if (loadDbValidatedContactsBtn) {
  loadDbValidatedContactsBtn.addEventListener("click", loadValidatedContactsForCampaign);
}

function showResult(data, isError = false) {
  resultElement.style.color = isError ? "#ffd1d1" : "#b9d7f4";
  resultElement.textContent = JSON.stringify(data, null, 2);
}

function updateSelectedFileName(inputElement, targetElement, defaultText) {
  if (!inputElement || !targetElement) {
    return;
  }

  const file = inputElement.files && inputElement.files[0] ? inputElement.files[0] : null;
  targetElement.textContent = file ? file.name : defaultText;
}

if (contactsFileInput && contactsFileName) {
  contactsFileInput.addEventListener("change", () => {
    updateSelectedFileName(
      contactsFileInput,
      contactsFileName,
      "Clique para selecionar ou arraste o arquivo"
    );
  });
}

function inferMediaTypeFromFileName(fileName) {
  const name = String(fileName || "").toLowerCase();
  if (!name.includes(".")) {
    return "";
  }

  const ext = name.split(".").pop();
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) {
    return "image";
  }

  if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(ext)) {
    return "video";
  }

  if (["pdf", "doc", "docx", "xls", "xlsx", "txt", "ppt", "pptx"].includes(ext)) {
    return "document";
  }

  return "";
}

function updateMediaFieldsVisibility() {
  const isMediaEnabled = Boolean(enableMediaCheckbox && enableMediaCheckbox.checked);
  const hasMediaType = Boolean(mediaTypeSelect && mediaTypeSelect.value);

  if (mediaConfigWrap) {
    mediaConfigWrap.classList.toggle("hidden-media-fields", !isMediaEnabled);
  }

  const hasMedia = isMediaEnabled && hasMediaType;

  if (mediaKeyFieldWrap) {
    mediaKeyFieldWrap.classList.toggle("hidden-media-fields", !hasMedia);
  }

  if (mediaUploadFieldWrap) {
    mediaUploadFieldWrap.classList.toggle("hidden-media-fields", !hasMedia);
  }

  if (!isMediaEnabled) {
    if (mediaTypeSelect) {
      mediaTypeSelect.value = "";
    }
  }

  if (!hasMedia) {
    if (mediaKeyInput) {
      mediaKeyInput.value = "";
    }
    if (mediaFileInput) {
      mediaFileInput.value = "";
    }
  }
}

if (enableMediaCheckbox) {
  enableMediaCheckbox.addEventListener("change", updateMediaFieldsVisibility);
}

if (mediaTypeSelect) {
  mediaTypeSelect.addEventListener("change", updateMediaFieldsVisibility);
}

updateMediaFieldsVisibility();

if (mediaFileInput) {
  mediaFileInput.addEventListener("change", () => {
    updateSelectedFileName(
      mediaFileInput,
      mediaFileName,
      "Clique para selecionar ou arraste o arquivo"
    );

    const file = mediaFileInput.files && mediaFileInput.files[0] ? mediaFileInput.files[0] : null;
    if (!file || !mediaTypeSelect) {
      return;
    }

    const inferred = inferMediaTypeFromFileName(file.name);
    if (inferred) {
      mediaTypeSelect.value = inferred;
      updateMediaFieldsVisibility();
      notify(`Tipo de midia identificado automaticamente: ${inferred}.`, "info");
    }
  });
}

if (uploadMediaBtn) {
  uploadMediaBtn.addEventListener("click", async () => {
    if (enableMediaCheckbox && !enableMediaCheckbox.checked) {
      notify("Marque 'Campanha com midia' para subir arquivo.", "warning");
      return;
    }

    if (mediaTypeSelect && !mediaTypeSelect.value) {
      notify("Selecione o tipo de midia antes de subir o arquivo.", "warning");
      return;
    }

    const file = mediaFileInput && mediaFileInput.files ? mediaFileInput.files[0] : null;
    if (!file) {
      notify("Selecione um arquivo antes de gerar o ID da midia.", "warning");
      return;
    }

    uploadMediaBtn.disabled = true;
    uploadMediaBtn.textContent = "Subindo...";

    try {
      const integration = await withGlobalLoading(
        () => getIntegrationConfig(),
        "Carregando integracoes para upload..."
      );
      if (!integration.natyUrl || !integration.natyToken) {
        throw {
          success: false,
          error: "Integracoes nao configuradas. Salve URL/token antes de subir midia."
        };
      }

      const payload = new FormData();
      payload.append("mediaFile", file);
      payload.append("config", JSON.stringify(integration));

      const data = await withGlobalLoading(async () => {
        const response = await fetch("/api/naty/medias", {
          method: "POST",
          body: payload
        });

        const parsed = await response.json();
        if (!response.ok) {
          throw parsed;
        }

        return parsed;
      }, "Enviando midia...");

      if (mediaKeyInput) {
        mediaKeyInput.value = data.mediaKey || "";
      }

      if (mediaTypeSelect && data && data.mediaType) {
        mediaTypeSelect.value = data.mediaType;
      }

      showResult(data, false);
      notify("Midia enviada e ID gerado com sucesso.", "success");
    } catch (error) {
      showResult(error, true);
      notify(extractErrorMessage(error, "Erro ao subir midia."), "error");
    } finally {
      uploadMediaBtn.disabled = false;
      uploadMediaBtn.textContent = "Gerar ID da midia";
    }
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!Array.isArray(dbValidatedContacts) || !dbValidatedContacts.length) {
    notify("Busque e valide contatos no banco antes de rodar a campanha.", "warning");
    showResult(
      {
        success: false,
        error: "Nenhum contato validado carregado. Use o botao 'Buscar no banco e validar na Evolution'."
      },
      true
    );
    return;
  }

  let integration = {};
  try {
    integration = await getIntegrationConfig();
  } catch (error) {
    notify(extractErrorMessage(error, "Erro ao carregar integracoes."), "error");
    return;
  }

  if (!integration.natyUrl || !integration.natyToken) {
    notify("Integracoes nao configuradas. Salve URL/token na pagina Integracoes.", "error");
    showResult(
      {
        success: false,
        error: "Integracoes nao configuradas. Abra a pagina Integracoes e salve URL/token antes de rodar."
      },
      true
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";

  try {
    const fd = new FormData(form);
    const manualContacts = parseManualContacts(fd.get("manualContacts") || "");
    const allContactsForCampaign = [...manualContacts, ...dbValidatedContacts];
    const messageVariations = getSelectedMessages();

    const confirmedSubmit = await confirmAction("Tem certeza que deseja subir esta campanha?");
    if (!confirmedSubmit) {
      notify("Envio da campanha cancelado.", "warning");
      return;
    }

    if (messageVariations.length < 3) {
      throw {
        success: false,
        error: "Selecione no minimo 3 mensagens para usar na campanha."
      };
    }

    const campaign = {
      name: fd.get("campaignName"),
      channelId: fd.get("channelId") || fd.get("chanellId"),
      chanellId: fd.get("channelId") || fd.get("chanellId"),
      queueId: fd.get("queueId"),
      ticketStatus: fd.get("ticketStatus"),
      minMsgInterval: Number(fd.get("minMsgInterval")),
      maxMsgInterval: Number(fd.get("maxMsgInterval")),
      contactDefaultName: fd.get("contactDefaultName"),
      mediaKey: String(fd.get("mediaKey") || "").trim(),
      mediaType: fd.get("enableMedia") === "on" ? String(fd.get("mediaType") || "").trim() : "none",
      messageVariations,
      messageBody: messageVariations[0]
    };

    if (campaign.mediaType !== "none" && !campaign.mediaKey) {
      throw {
        success: false,
        error: "Para campanha com midia, gere ou informe o Media Key."
      };
    }

    if (fd.get("enableMedia") === "on" && !campaign.mediaType) {
      throw {
        success: false,
        error: "Selecione o tipo de midia (image, video ou document)."
      };
    }

    const payload = new FormData();
    payload.append("config", JSON.stringify(integration));
    payload.append("campaign", JSON.stringify(campaign));
    payload.append("contacts", JSON.stringify(allContactsForCampaign));

    const contactsFile = fd.get("contactsFile");
    if (contactsFile && contactsFile.size > 0) {
      payload.append("contactsFile", contactsFile);
    }

    const data = await withGlobalLoading(async () => {
      const response = await fetch("/api/campaign/run", {
        method: "POST",
        body: payload
      });

      const parsed = await response.json();
      if (!response.ok) {
        throw parsed;
      }

      return parsed;
    }, "Enviando campanha...");

    showResult(data, false);
    notify("Campanha enviada com sucesso.", "success");

    await saveLogEntry({
      createdAt: new Date().toISOString(),
      campaignName: campaign.name,
      status: "sucesso",
      sentCount: data && data.summary ? data.summary.envioMensagemCount || 0 : 0,
      details: data
    });
  } catch (error) {
    showResult(error, true);
    notify(extractErrorMessage(error, "Erro ao enviar campanha."), "error");

    await saveLogEntry({
      createdAt: new Date().toISOString(),
      campaignName: form.elements.namedItem("campaignName").value || "Sem nome",
      status: "erro",
      sentCount: 0,
      details: error
    });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Rodar campanha";
  }
});
