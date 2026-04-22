const logsTableBody = document.getElementById("logsTableBody");
const clearLogsBtn = document.getElementById("clearLogsBtn");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactText(value, maxLength = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("pt-BR");
}

async function renderLogs() {
  if (!logsTableBody) {
    return;
  }

  logsTableBody.innerHTML = `
    <tr>
      <td colspan="5" class="empty">Carregando logs...</td>
    </tr>
  `;

  let logs = [];
  try {
    logs = await withGlobalLoading(() => getLogs(), "Carregando logs...");
  } catch (error) {
    notify(extractErrorMessage(error, "Erro ao carregar logs."), "error");
  }

  if (!logs.length) {
    logsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">Nenhum log registrado ainda.</td>
      </tr>
    `;
    return;
  }

  logsTableBody.innerHTML = logs
    .map((log) => {
      const detailsText = log && log.details && log.details.error ? log.details.error : "Execucao concluida";
      const statusClass = log.status === "sucesso" ? "pill good" : "pill bad";
      const safeDate = escapeHtml(formatDate(log.createdAt));
      const safeCampaignName = escapeHtml(log.campaignName || "-");
      const safeStatus = escapeHtml(log.status || "-");
      const safeSentCount = escapeHtml(log.sentCount || 0);
      const shortDetails = compactText(detailsText, 260);
      const safeDetails = escapeHtml(shortDetails);
      return `
        <tr>
          <td>${safeDate}</td>
          <td>${safeCampaignName}</td>
          <td><span class="${statusClass}">${safeStatus}</span></td>
          <td>${safeSentCount}</td>
          <td class="details" title="${escapeHtml(detailsText)}">${safeDetails}</td>
        </tr>
      `;
    })
    .join("");
}

if (clearLogsBtn) {
  clearLogsBtn.addEventListener("click", async () => {
    const confirmed = await confirmAction("Tem certeza que deseja limpar todos os logs?");
    if (!confirmed) {
      notify("Limpeza de logs cancelada.", "warning");
      return;
    }

    try {
      await withGlobalLoading(() => clearLogs(), "Limpando logs...");
      await renderLogs();
      notify("Logs removidos com sucesso.", "success");
    } catch (error) {
      notify(extractErrorMessage(error, "Erro ao limpar logs."), "error");
    }
  });
}

renderLogs();
