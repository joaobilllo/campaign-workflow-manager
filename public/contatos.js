const contactsSegmentInput = document.getElementById("contactsSegment");
const contactsLimitInput = document.getElementById("contactsLimit");
const checkDbBtn = document.getElementById("checkDbBtn");
const loadContactsBtn = document.getElementById("loadContactsBtn");
const contactsMeta = document.getElementById("contactsMeta");
const contactsTableBody = document.getElementById("contactsTableBody");
const contactsResult = document.getElementById("contactsResult");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parsePositiveInt(value, fallback = 500, min = 1, max = 5000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function readFilters() {
  const segment = String((contactsSegmentInput && contactsSegmentInput.value) || "recic").trim() || "recic";
  const limit = parsePositiveInt(contactsLimitInput && contactsLimitInput.value, 500, 1, 5000);
  return { segment, limit };
}

function setTableState(message) {
  if (!contactsTableBody) {
    return;
  }

  contactsTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="empty">${escapeHtml(message)}</td>
    </tr>
  `;
}

function renderContacts(contacts) {
  if (!contactsTableBody) {
    return;
  }

  if (!Array.isArray(contacts) || !contacts.length) {
    setTableState("Nenhum contato encontrado para esse filtro.");
    return;
  }

  contactsTableBody.innerHTML = contacts
    .map((item) => {
      const safeNome = escapeHtml(item.nome || "-");
      const safeNumero = escapeHtml(item.numero || "-");
      const safeSegmento = escapeHtml(item.segmento || "-");
      const safeAvaliacao = escapeHtml(item.avaliacao || "-");
      const safeLocalidade = escapeHtml(item.localidade || "-");
      const safeUrl = escapeHtml(item.url_google || "-");
      const href = String(item.url_google || "").trim();
      const urlCell = href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="table-link">${safeUrl}</a>`
        : safeUrl;

      return `
        <tr>
          <td>${safeNome}</td>
          <td>${safeNumero}</td>
          <td>${safeSegmento}</td>
          <td>${safeAvaliacao}</td>
          <td>${safeLocalidade}</td>
          <td class="details">${urlCell}</td>
        </tr>
      `;
    })
    .join("");
}

async function checkDatabaseHealth() {
  try {
    const data = await withGlobalLoading(
      () => apiRequest("/api/postgres/health", { method: "GET" }),
      "Testando conexao com PostgreSQL..."
    );

    contactsResult.textContent = JSON.stringify(data, null, 2);
    if (contactsMeta) {
      const now = new Date().toLocaleString("pt-BR");
      contactsMeta.textContent = `Conexao ativa (${now})`;
    }
    notify("Conexao com PostgreSQL validada.", "success");
  } catch (error) {
    contactsResult.textContent = JSON.stringify(error || {}, null, 2);
    notify(extractErrorMessage(error, "Erro ao validar conexao com PostgreSQL."), "error");
  }
}

async function loadContactsFromDatabase() {
  const { segment, limit } = readFilters();
  setTableState("Carregando contatos...");

  try {
    const query = `/api/postgres/contacts?segment=${encodeURIComponent(segment)}&limit=${encodeURIComponent(limit)}`;
    const data = await withGlobalLoading(
      () => apiRequest(query, { method: "GET" }),
      "Buscando contatos no banco..."
    );

    renderContacts(data.contacts || []);
    contactsResult.textContent = JSON.stringify(data, null, 2);

    if (contactsMeta) {
      const now = new Date().toLocaleString("pt-BR");
      contactsMeta.textContent = `${data.total || 0} contato(s) encontrado(s) - filtro: ${segment} - ${now}`;
    }

    notify(`${data.total || 0} contato(s) carregado(s).`, "success");
  } catch (error) {
    setTableState("Erro ao consultar contatos.");
    contactsResult.textContent = JSON.stringify(error || {}, null, 2);
    notify(extractErrorMessage(error, "Erro ao buscar contatos no PostgreSQL."), "error");
  }
}

if (checkDbBtn) {
  checkDbBtn.addEventListener("click", checkDatabaseHealth);
}

if (loadContactsBtn) {
  loadContactsBtn.addEventListener("click", loadContactsFromDatabase);
}

loadContactsFromDatabase();
