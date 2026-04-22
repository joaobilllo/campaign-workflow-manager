const integrationForm = document.getElementById("integrationForm");
const integrationStatus = document.getElementById("integrationStatus");
const saveBtn = document.getElementById("saveBtn");

function renderIntegrationStatus(config) {
  const hasConfig = config && Object.keys(config).length > 0;
  if (!hasConfig) {
    integrationStatus.textContent = "Nenhuma configuracao salva ainda.";
    return;
  }

  const safeConfig = {
    ...config,
    natyToken: config.natyToken ? "*** oculto ***" : ""
  };

  integrationStatus.textContent = `Configuracao salva com sucesso:\n${JSON.stringify(safeConfig, null, 2)}`;
}

function fillIntegrationForm(config) {
  Object.entries(config || {}).forEach(([key, value]) => {
    const field = integrationForm.elements.namedItem(key);
    if (!field) {
      return;
    }

    if (field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }

    field.value = value ?? "";
  });
}

async function initIntegrationPage() {
  try {
    const savedConfig = await withGlobalLoading(
      () => getIntegrationConfig(),
      "Carregando configuracoes de integracao..."
    );
    fillIntegrationForm(savedConfig);
    renderIntegrationStatus(savedConfig);
  } catch (error) {
    notify(extractErrorMessage(error, "Erro ao carregar configuracoes."), "error");
  }
}

initIntegrationPage();

integrationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  saveBtn.disabled = true;
  saveBtn.textContent = "Salvando...";

  const fd = new FormData(integrationForm);
  const config = {
    natyUrl: String(fd.get("natyUrl") || "").trim(),
    natyToken: String(fd.get("natyToken") || "").trim(),
    evolutionUrl: String(fd.get("evolutionUrl") || "").trim(),
    evolutionInstance: String(fd.get("evolutionInstance") || "").trim(),
    evolutionApiKey: String(fd.get("evolutionApiKey") || "").trim(),
    validateOnEvolution: fd.get("validateOnEvolution") === "on",
    onlyCsvValidated: fd.get("onlyCsvValidated") === "on"
  };

  if (!config.natyUrl || !config.natyToken) {
    notify("Preencha URL e token da Naty antes de salvar.", "error");
    saveBtn.disabled = false;
    saveBtn.textContent = "Salvar integracoes";
    return;
  }

  try {
    const saved = await withGlobalLoading(
      () => saveIntegrationConfig(config),
      "Salvando configuracoes de integracao..."
    );
    renderIntegrationStatus(saved);
    notify("Configuracoes de integracao salvas com sucesso.", "success");
  } catch (error) {
    notify(extractErrorMessage(error, "Erro ao salvar configuracoes."), "error");
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "Salvar integracoes";
});
