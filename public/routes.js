const fetchQueuesBtn = document.getElementById("fetchQueuesBtn");
const queuesTableBody = document.getElementById("queuesTableBody");
const queuesMeta = document.getElementById("queuesMeta");
const fetchChannelsBtn = document.getElementById("fetchChannelsBtn");
const channelsTableBody = document.getElementById("channelsTableBody");
const channelsMeta = document.getElementById("channelsMeta");
const routesResult = document.getElementById("routesResult");
const manualRouteForm = document.getElementById("manualRouteForm");
const manualRouteIdInput = document.getElementById("manualRouteId");
const manualRouteNameInput = document.getElementById("manualRouteName");
const manualRouteMethodInput = document.getElementById("manualRouteMethod");
const manualRoutePathInput = document.getElementById("manualRoutePath");
const manualRouteDescriptionInput = document.getElementById("manualRouteDescription");
const saveManualRouteBtn = document.getElementById("saveManualRouteBtn");
const cancelManualRouteBtn = document.getElementById("cancelManualRouteBtn");
const manualRoutesList = document.getElementById("manualRoutesList");
const openManualRouteBtn = document.getElementById("openManualRouteBtn");
const manualRouteEditorWrap = document.getElementById("manualRouteEditorWrap");

let manualRoutes = [];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showRoutesResult(data, isError = false) {
  routesResult.style.color = isError ? "#ffd1d1" : "#b9d7f4";
  routesResult.textContent = JSON.stringify(data, null, 2);
}

async function apiRoutesRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw data;
  }

  return data;
}

function resetManualRouteForm() {
  if (!manualRouteForm) {
    return;
  }

  manualRouteForm.reset();
  if (manualRouteIdInput) {
    manualRouteIdInput.value = "";
  }
  if (manualRouteMethodInput) {
    manualRouteMethodInput.value = "GET";
  }
  if (saveManualRouteBtn) {
    saveManualRouteBtn.textContent = "Salvar rota";
  }
}

function setManualRouteEditorVisible(visible) {
  if (!manualRouteEditorWrap) {
    return;
  }

  manualRouteEditorWrap.classList.toggle("hidden-manual-route-editor", !visible);

  if (openManualRouteBtn) {
    openManualRouteBtn.textContent = visible ? "Ocultar formulario" : "Adicionar rota manual";
  }
}

function renderManualRoutes() {
  if (!manualRoutesList) {
    return;
  }

  if (!manualRoutes.length) {
    manualRoutesList.innerHTML = "";
    return;
  }

  manualRoutesList.innerHTML = manualRoutes
    .map((route) => {
      const name = escapeHtml(route.name || "-");
      const method = escapeHtml(route.method || "GET");
      const path = escapeHtml(route.path || "-");
      const description = escapeHtml(route.description || "-");
      const id = Number(route.id || 0);
      const updatedAt = route.updatedAt
        ? new Date(route.updatedAt).toLocaleString("pt-BR")
        : "-";

      return `
        <section class="block manual-route-block">
          <h2>${name}</h2>
          <p class="route-text">Rota: <strong>${method} ${path}</strong></p>
          <div class="form-actions">
            <button type="button" class="inline-btn" data-edit-manual-route="${id}">Editar rota</button>
            <button type="button" class="remove-message-btn" data-delete-manual-route="${id}">Excluir rota</button>
          </div>
          <p class="route-meta">Descricao: ${description} | Atualizada em: ${escapeHtml(updatedAt)}</p>
        </section>
      `;
    })
    .join("");
}

function fillManualRouteForm(route) {
  if (!route) {
    return;
  }

  setManualRouteEditorVisible(true);

  manualRouteIdInput.value = String(route.id || "");
  manualRouteNameInput.value = route.name || "";
  manualRouteMethodInput.value = String(route.method || "GET").toUpperCase();
  manualRoutePathInput.value = route.path || "";
  manualRouteDescriptionInput.value = route.description || "";
  saveManualRouteBtn.textContent = "Salvar alteracoes";
}

if (openManualRouteBtn) {
  openManualRouteBtn.addEventListener("click", () => {
    const isHidden = manualRouteEditorWrap
      ? manualRouteEditorWrap.classList.contains("hidden-manual-route-editor")
      : true;

    setManualRouteEditorVisible(isHidden);

    if (isHidden && manualRouteNameInput) {
      manualRouteNameInput.focus();
    }
  });
}

async function loadManualRoutes() {
  try {
    const data = await withGlobalLoading(
      () => apiRoutesRequest("/api/manual-routes", { method: "GET" }),
      "Carregando rotas manuais..."
    );
    manualRoutes = Array.isArray(data.routes) ? data.routes : [];
    renderManualRoutes();
  } catch (error) {
    notify(extractErrorMessage(error, "Erro ao carregar rotas manuais."), "error");
    renderManualRoutes();
  }
}

if (manualRouteForm) {
  manualRouteForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const routePayload = {
      name: manualRouteNameInput.value,
      method: manualRouteMethodInput.value,
      path: manualRoutePathInput.value,
      description: manualRouteDescriptionInput.value
    };

    const editingId = Number(manualRouteIdInput.value || 0);
    const isEditing = Number.isInteger(editingId) && editingId > 0;

    saveManualRouteBtn.disabled = true;
    saveManualRouteBtn.textContent = isEditing ? "Salvando..." : "Criando...";

    try {
      if (isEditing) {
        await withGlobalLoading(
          () =>
            apiRoutesRequest(`/api/manual-routes/${editingId}`, {
              method: "PUT",
              body: JSON.stringify({ route: routePayload })
            }),
          "Salvando alteracoes da rota..."
        );
        notify("Rota manual atualizada com sucesso.", "success");
      } else {
        await withGlobalLoading(
          () =>
            apiRoutesRequest("/api/manual-routes", {
              method: "POST",
              body: JSON.stringify({ route: routePayload })
            }),
          "Criando rota manual..."
        );
        notify("Rota manual criada com sucesso.", "success");
      }

      resetManualRouteForm();
      setManualRouteEditorVisible(false);
      await loadManualRoutes();
    } catch (error) {
      notify(extractErrorMessage(error, "Erro ao salvar rota manual."), "error");
    } finally {
      saveManualRouteBtn.disabled = false;
      if (!manualRouteIdInput.value) {
        saveManualRouteBtn.textContent = "Salvar rota";
      }
    }
  });
}

if (cancelManualRouteBtn) {
  cancelManualRouteBtn.addEventListener("click", () => {
    resetManualRouteForm();
    setManualRouteEditorVisible(false);
  });
}

if (manualRoutesList) {
  manualRoutesList.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-manual-route]");
    if (editButton) {
      const routeId = Number(editButton.getAttribute("data-edit-manual-route") || 0);
      const route = manualRoutes.find((item) => Number(item.id) === routeId);
      fillManualRouteForm(route);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-manual-route]");
    if (!deleteButton) {
      return;
    }

    const routeId = Number(deleteButton.getAttribute("data-delete-manual-route") || 0);
    if (!Number.isInteger(routeId) || routeId <= 0) {
      return;
    }

    const confirmed = await confirmAction("Tem certeza que deseja excluir esta rota manual?");
    if (!confirmed) {
      return;
    }

    try {
      await withGlobalLoading(
        () =>
          apiRoutesRequest(`/api/manual-routes/${routeId}`, {
            method: "DELETE"
          }),
        "Excluindo rota manual..."
      );
      notify("Rota manual removida com sucesso.", "success");
      await loadManualRoutes();
    } catch (error) {
      notify(extractErrorMessage(error, "Erro ao excluir rota manual."), "error");
    }
  });
}

resetManualRouteForm();
setManualRouteEditorVisible(false);
loadManualRoutes();

function renderTableState(tbody, colspan, message, type = "empty") {
  if (!tbody) {
    return;
  }

  const stateClass = type === "error" ? "route-error" : type === "loading" ? "loading-state" : "";

  tbody.innerHTML = `
    <tr>
      <td colspan="${colspan}" class="empty ${stateClass}">${escapeHtml(message)}</td>
    </tr>
  `;
}

function updateMeta(element, label, total) {
  if (!element) {
    return;
  }

  const now = new Date().toLocaleString("pt-BR");
  element.textContent = `${label}: ${total} registro(s) - ${now}`;
}

function statusBadge(status) {
  const value = String(status || "-").toUpperCase();

  if (["CONNECTED", "OPEN", "ONLINE", "READY", "TRUE", "ACTIVE"].includes(value)) {
    return `<span class="pill good">${escapeHtml(value)}</span>`;
  }

  if (["DISCONNECTED", "CLOSED", "OFFLINE", "FALSE", "INACTIVE"].includes(value)) {
    return `<span class="pill bad">${escapeHtml(value)}</span>`;
  }

  return `<span class="pill route-neutral">${escapeHtml(value)}</span>`;
}

function renderQueues(queues) {
  if (!queues || !queues.length) {
    renderTableState(queuesTableBody, 3, "Nenhuma fila retornada.");
    updateMeta(queuesMeta, "Ultima consulta", 0);
    return;
  }

  queuesTableBody.innerHTML = queues
    .map((queue) => {
      const queueId = escapeHtml(queue.id || queue.queueId || "-");
      const queueName = escapeHtml(queue.name || queue.queueName || queue.title || "-");
      const queueStatus = queue.status ?? queue.active;
      return `
        <tr>
          <td>${queueId}</td>
          <td>${queueName}</td>
          <td>${statusBadge(queueStatus)}</td>
        </tr>
      `;
    })
    .join("");

  updateMeta(queuesMeta, "Ultima consulta", queues.length);
}

function renderChannels(channels) {
  if (!channels || !channels.length) {
    renderTableState(channelsTableBody, 3, "Nenhum canal retornado.");
    updateMeta(channelsMeta, "Ultima consulta", 0);
    return;
  }

  channelsTableBody.innerHTML = channels
    .map((channel) => {
      const channelId = escapeHtml(channel.id || channel.channelId || "-");
      const channelName = escapeHtml(channel.name || channel.channelName || channel.title || "-");
      let channelStatuses = [];

      if (Array.isArray(channel.whatsapps) && channel.whatsapps.length) {
        channelStatuses = channel.whatsapps
          .map((whatsapp) => String(whatsapp && whatsapp.status ? whatsapp.status : "").trim())
          .filter(Boolean);
      }

      if (!channelStatuses.length) {
        channelStatuses = [String(channel.status || channel.active || "-")];
      }

      const statusBadges = channelStatuses.map((status) => statusBadge(status)).join(" ");

      return `
        <tr>
          <td>${channelId}</td>
          <td>${channelName}</td>
          <td>${statusBadges}</td>
        </tr>
      `;
    })
    .join("");

  updateMeta(channelsMeta, "Ultima consulta", channels.length);
}

if (fetchQueuesBtn) {
  fetchQueuesBtn.addEventListener("click", async () => {
    let integration = {};
    try {
      integration = await withGlobalLoading(
        () => getIntegrationConfig(),
        "Carregando integracoes..."
      );
    } catch (error) {
      notify(extractErrorMessage(error, "Erro ao carregar integracoes."), "error");
      return;
    }
    if (!integration.natyUrl || !integration.natyToken) {
      notify("Salve URL e token na pagina Integracoes antes de consultar filas.", "error");
      showRoutesResult(
        {
          success: false,
          error: "Integracoes nao configuradas."
        },
        true
      );
      return;
    }

    fetchQueuesBtn.disabled = true;
    fetchQueuesBtn.textContent = "Consultando...";
    renderTableState(queuesTableBody, 3, "Consultando filas...", "loading");

    try {
      const data = await withGlobalLoading(async () => {
        const response = await fetch("/api/naty/queues", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            config: integration
          })
        });

        const parsed = await response.json();
        if (!response.ok) {
          throw parsed;
        }

        return parsed;
      }, "Consultando filas..."
      );

      renderQueues(data.queues || []);
      showRoutesResult(data, false);
      notify(`Filas consultadas com sucesso (${data.totalQueues || 0}).`, "success");
    } catch (error) {
      renderTableState(queuesTableBody, 3, extractErrorMessage(error, "Erro ao consultar filas."), "error");
      updateMeta(queuesMeta, "Ultima consulta", 0);
      showRoutesResult(error, true);
      notify(extractErrorMessage(error, "Erro ao consultar filas."), "error");
    } finally {
      fetchQueuesBtn.disabled = false;
      fetchQueuesBtn.textContent = "Consultar filas";
    }
  });
}

if (fetchChannelsBtn) {
  fetchChannelsBtn.addEventListener("click", async () => {
    let integration = {};
    try {
      integration = await withGlobalLoading(
        () => getIntegrationConfig(),
        "Carregando integracoes..."
      );
    } catch (error) {
      notify(extractErrorMessage(error, "Erro ao carregar integracoes."), "error");
      return;
    }
    if (!integration.natyUrl || !integration.natyToken) {
      notify("Salve URL e token na pagina Integracoes antes de consultar canais.", "error");
      showRoutesResult(
        {
          success: false,
          error: "Integracoes nao configuradas."
        },
        true
      );
      return;
    }

    fetchChannelsBtn.disabled = true;
    fetchChannelsBtn.textContent = "Consultando...";
    renderTableState(channelsTableBody, 3, "Consultando canais...", "loading");

    try {
      const data = await withGlobalLoading(async () => {
        const response = await fetch("/api/naty/channels", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            config: integration
          })
        });

        const parsed = await response.json();
        if (!response.ok) {
          throw parsed;
        }

        return parsed;
      }, "Consultando canais..."
      );

      renderChannels(data.channels || []);
      showRoutesResult(data, false);
      notify(`Canais consultados com sucesso (${data.totalChannels || 0}).`, "success");
    } catch (error) {
      renderTableState(channelsTableBody, 3, extractErrorMessage(error, "Erro ao consultar canais."), "error");
      updateMeta(channelsMeta, "Ultima consulta", 0);
      showRoutesResult(error, true);
      notify(extractErrorMessage(error, "Erro ao consultar canais."), "error");
    } finally {
      fetchChannelsBtn.disabled = false;
      fetchChannelsBtn.textContent = "Consultar canais";
    }
  });
}
