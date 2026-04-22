async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const responseText = await response.text();
  let data = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {
      error: responseText || "Resposta invalida do servidor."
    };
  }

  if (!response.ok) {
    throw data;
  }

  return data;
}

const THEME_STORAGE_KEY = "natyCampaignTheme";
let mediaThemeListenerBound = false;

function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") {
      return value;
    }
  } catch {
    return null;
  }

  return null;
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors silently.
  }
}

function getPreferredTheme() {
  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}

function getCurrentThemeSelection() {
  return getStoredTheme() || "system";
}

function resolveThemeValue(selectedTheme) {
  return selectedTheme === "system" ? getPreferredTheme() : selectedTheme;
}

function updateThemeTrigger(themeSelection) {
  const trigger = document.getElementById("themeMenuTrigger");
  if (!trigger) {
    return;
  }

  const labelMap = {
    light: "Claro",
    dark: "Escuro",
    system: "Padrao do sistema"
  };
  const iconMap = {
    light: "☀",
    dark: "☾",
    system: "⌘"
  };
  const key = labelMap[themeSelection] ? themeSelection : "system";

  const label = trigger.querySelector(".theme-menu-trigger-label");
  const icon = trigger.querySelector(".theme-menu-trigger-icon");
  if (label) {
    label.textContent = labelMap[key];
  }
  if (icon) {
    icon.textContent = iconMap[key];
  }
}

function applyTheme(themeSelection) {
  const normalizedSelection = themeSelection === "light" || themeSelection === "dark" || themeSelection === "system"
    ? themeSelection
    : "system";
  const resolvedTheme = resolveThemeValue(normalizedSelection);
  document.documentElement.setAttribute("data-theme", resolvedTheme);
  document.documentElement.setAttribute("data-theme-selection", normalizedSelection);

  const buttons = Array.from(document.querySelectorAll("[data-theme-value]"));
  buttons.forEach((button) => {
    const isActive = button.getAttribute("data-theme-value") === normalizedSelection;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  updateThemeTrigger(normalizedSelection);
}

function bindMediaThemeListener() {
  if (mediaThemeListenerBound || !window.matchMedia) {
    return;
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  const handleChange = () => {
    if (getCurrentThemeSelection() === "system") {
      applyTheme("system");
    }
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(handleChange);
  }

  mediaThemeListenerBound = true;
}

function mountThemeToggle() {
  const topbar = document.querySelector(".topbar");
  if (!topbar || document.getElementById("themeSwitcher")) {
    return;
  }

  let controls = document.getElementById("topbarControls");
  if (!controls) {
    controls = document.createElement("div");
    controls.id = "topbarControls";
    controls.className = "topbar-controls";

    const children = Array.from(topbar.children);
    children.slice(1).forEach((child) => {
      controls.appendChild(child);
    });

    topbar.appendChild(controls);
  }

  const switcher = document.createElement("section");
  switcher.id = "themeSwitcher";
  switcher.className = "theme-switcher topbar-theme-switcher";
  switcher.innerHTML = `
    <button type="button" class="theme-menu-trigger" id="themeMenuTrigger" aria-haspopup="true" aria-expanded="false" aria-controls="themeMenuDropdown" title="Alterar tema">
      <span class="theme-menu-trigger-icon" aria-hidden="true">☾</span>
      <span class="theme-menu-trigger-label">Escuro</span>
    </button>
    <div class="theme-menu-dropdown" id="themeMenuDropdown" role="menu" aria-label="Alterar tema">
      <p class="theme-menu-title">Alterar tema</p>
      <button type="button" class="theme-switcher-btn theme-option-btn" data-theme-value="light" aria-pressed="false" role="menuitemradio" title="Tema claro">
        <span class="theme-option-icon" aria-hidden="true">☀</span>
        <span>Claro</span>
      </button>
      <button type="button" class="theme-switcher-btn theme-option-btn" data-theme-value="dark" aria-pressed="false" role="menuitemradio" title="Tema escuro">
        <span class="theme-option-icon" aria-hidden="true">☾</span>
        <span>Escuro</span>
      </button>
      <button type="button" class="theme-switcher-btn theme-option-btn" data-theme-value="system" aria-pressed="false" role="menuitemradio" title="Padrao do sistema">
        <span class="theme-option-icon" aria-hidden="true">⌘</span>
        <span>Padrao do sistema</span>
      </button>
    </div>
  `;

  controls.appendChild(switcher);

  const trigger = switcher.querySelector("#themeMenuTrigger");

  const setDropdownOpen = (open) => {
    switcher.classList.toggle("open", open);
    if (trigger) {
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }
  };

  if (trigger) {
    trigger.addEventListener("click", () => {
      setDropdownOpen(!switcher.classList.contains("open"));
    });
  }

  switcher.addEventListener("click", (event) => {
    const target = event.target.closest("[data-theme-value]");
    if (!target) {
      return;
    }

    const selectedTheme = target.getAttribute("data-theme-value");
    const normalized = selectedTheme === "light" || selectedTheme === "dark" || selectedTheme === "system"
      ? selectedTheme
      : "system";
    const label = normalized === "light" ? "claro" : normalized === "dark" ? "escuro" : "do sistema";

    applyTheme(normalized);
    saveTheme(normalized);
    notify(`Tema ${label} ativado.`, "success");
    setDropdownOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (!switcher.contains(event.target)) {
      setDropdownOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setDropdownOpen(false);
    }
  });
}

function initializeThemeSystem() {
  mountThemeToggle();
  bindMediaThemeListener();
  applyTheme(getCurrentThemeSelection());
}

function extractErrorMessage(error, fallback = "Erro inesperado.") {
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.error) {
    return String(error.error);
  }

  if (error.message) {
    return String(error.message);
  }

  if (Array.isArray(error.errors) && error.errors.length) {
    return String(error.errors[0]);
  }

  return fallback;
}

let globalLoadingCount = 0;

function ensureGlobalLoadingOverlay() {
  let overlay = document.getElementById("globalLoadingOverlay");
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.id = "globalLoadingOverlay";
  overlay.className = "global-loading-overlay";
  overlay.innerHTML = `
    <div class="global-loading-card">
      <div class="global-loading-spinner" aria-hidden="true"></div>
      <p id="globalLoadingText" class="global-loading-text">Carregando...</p>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function showGlobalLoading(message = "Processando...") {
  const overlay = ensureGlobalLoadingOverlay();
  const text = document.getElementById("globalLoadingText");
  if (text) {
    text.textContent = String(message || "Processando...");
  }

  globalLoadingCount += 1;
  overlay.classList.add("show");
}

function hideGlobalLoading() {
  const overlay = document.getElementById("globalLoadingOverlay");
  if (!overlay) {
    globalLoadingCount = 0;
    return;
  }

  globalLoadingCount = Math.max(0, globalLoadingCount - 1);
  if (globalLoadingCount === 0) {
    overlay.classList.remove("show");
  }
}

async function withGlobalLoading(task, message = "Processando...") {
  showGlobalLoading(message);
  try {
    return await task();
  } finally {
    hideGlobalLoading();
  }
}

async function getIntegrationConfig() {
  const data = await apiRequest("/api/settings/integration", { method: "GET" });
  return data.config || {};
}

async function saveIntegrationConfig(config) {
  const data = await apiRequest("/api/settings/integration", {
    method: "PUT",
    body: JSON.stringify({ config })
  });
  return data.config || {};
}

async function getLogs() {
  const data = await apiRequest("/api/logs?limit=200", { method: "GET" });
  return data.logs || [];
}

async function saveLogEntry(entry) {
  await apiRequest("/api/logs", {
    method: "POST",
    body: JSON.stringify({ entry })
  });
}

async function clearLogs() {
  await apiRequest("/api/logs", { method: "DELETE" });
}

async function getMessageTemplates() {
  const data = await apiRequest("/api/message-templates", { method: "GET" });
  return data.templates || [];
}

async function addMessageTemplateApi(body) {
  const data = await apiRequest("/api/message-templates", {
    method: "POST",
    body: JSON.stringify({ body })
  });
  return data.template;
}

async function deleteMessageTemplateApi(id) {
  await apiRequest(`/api/message-templates/${id}`, { method: "DELETE" });
}

function ensureToastContainer() {
  let container = document.getElementById("toastContainer");
  if (container) {
    return container;
  }

  container = document.createElement("div");
  container.id = "toastContainer";
  container.className = "toast-container";
  document.body.appendChild(container);
  return container;
}

function notify(message, type = "info") {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = String(message || "");
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 240);
  }, 3200);
}

let confirmDialogState = {
  resolver: null
};

function ensureConfirmDialog() {
  let overlay = document.getElementById("appConfirmOverlay");
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.id = "appConfirmOverlay";
  overlay.className = "app-confirm-overlay";
  overlay.innerHTML = `
    <section class="app-confirm-card" role="dialog" aria-modal="true" aria-labelledby="appConfirmTitle">
      <h3 id="appConfirmTitle" class="app-confirm-title">Confirmacao</h3>
      <p id="appConfirmMessage" class="app-confirm-message">Tem certeza?</p>
      <div class="app-confirm-actions">
        <button type="button" id="appConfirmCancel" class="inline-btn app-confirm-cancel">Cancelar</button>
        <button type="button" id="appConfirmAccept" class="app-confirm-accept">Confirmar</button>
      </div>
    </section>
  `;

  const closeWith = (value) => {
    overlay.classList.remove("show");
    const resolver = confirmDialogState.resolver;
    confirmDialogState.resolver = null;
    if (resolver) {
      resolver(Boolean(value));
    }
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeWith(false);
    }
  });

  const cancelButton = overlay.querySelector("#appConfirmCancel");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      closeWith(false);
    });
  }

  const confirmButton = overlay.querySelector("#appConfirmAccept");
  if (confirmButton) {
    confirmButton.addEventListener("click", () => {
      closeWith(true);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.classList.contains("show")) {
      closeWith(false);
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

function confirmAction(message) {
  const overlay = ensureConfirmDialog();
  const messageElement = overlay.querySelector("#appConfirmMessage");
  if (messageElement) {
    messageElement.textContent = String(message || "Tem certeza?");
  }

  const confirmButton = overlay.querySelector("#appConfirmAccept");
  if (confirmButton) {
    confirmButton.focus();
  }

  overlay.classList.add("show");
  return new Promise((resolve) => {
    confirmDialogState.resolver = resolve;
  });
}

function markCurrentPageInMenu() {
  const page = window.location.pathname.split("/").pop() || "campaign.html";
  const menuItems = Array.from(document.querySelectorAll(".menu .item"));
  menuItems.forEach((item) => {
    item.classList.toggle("active", item.getAttribute("href") === page);
  });
}

function applyStaggeredCardEntry() {
  const candidates = Array.from(document.querySelectorAll(".workspace > .card"));
  candidates.forEach((element, index) => {
    const delay = Math.min(index * 70, 420);
    element.style.animationDelay = `${delay}ms`;
  });
}

window.addEventListener("unhandledrejection", (event) => {
  const message = extractErrorMessage(event.reason, "Erro inesperado durante a operacao.");
  notify(message, "error");
});

window.addEventListener("error", (event) => {
  const message = extractErrorMessage(event.error || event.message, "Erro inesperado na aplicacao.");
  notify(message, "error");
});

markCurrentPageInMenu();
applyStaggeredCardEntry();
initializeThemeSystem();
