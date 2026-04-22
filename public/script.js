const form = document.getElementById("campaignForm");
const resultElement = document.getElementById("result");
const submitButton = document.getElementById("submitBtn");
const menuItems = Array.from(document.querySelectorAll(".menu .item"));

function setActiveMenuByHash(hash) {
  if (!menuItems.length) {
    return;
  }

  menuItems.forEach((item) => {
    item.classList.toggle("active", item.getAttribute("href") === hash);
  });
}

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    setActiveMenuByHash(item.getAttribute("href"));
  });
});

window.addEventListener("hashchange", () => {
  setActiveMenuByHash(window.location.hash || "#topo");
});

setActiveMenuByHash(window.location.hash || "#topo");

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

function showResult(data, isError = false) {
  resultElement.style.color = isError ? "#ffd1d1" : "#d8ffe7";
  resultElement.textContent = JSON.stringify(data, null, 2);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";

  try {
    const fd = new FormData(form);
    const manualContacts = parseManualContacts(fd.get("manualContacts") || "");

    const config = {
      natyUrl: fd.get("natyUrl"),
      natyToken: fd.get("natyToken"),
      evolutionUrl: fd.get("evolutionUrl"),
      evolutionInstance: fd.get("evolutionInstance"),
      evolutionApiKey: fd.get("evolutionApiKey"),
      validateOnEvolution: fd.get("validateOnEvolution") === "on",
      onlyCsvValidated: fd.get("onlyCsvValidated") === "on"
    };

    const campaign = {
      name: fd.get("campaignName"),
      channelId: fd.get("channelId") || fd.get("chanellId"),
      chanellId: fd.get("channelId") || fd.get("chanellId"),
      queueId: fd.get("queueId"),
      ticketStatus: fd.get("ticketStatus"),
      minMsgInterval: Number(fd.get("minMsgInterval")),
      maxMsgInterval: Number(fd.get("maxMsgInterval")),
      contactDefaultName: fd.get("contactDefaultName"),
      messageBody: fd.get("messageBody")
    };

    const payload = new FormData();
    payload.append("config", JSON.stringify(config));
    payload.append("campaign", JSON.stringify(campaign));
    payload.append("contacts", JSON.stringify(manualContacts));

    const contactsFile = fd.get("contactsFile");
    if (contactsFile && contactsFile.size > 0) {
      payload.append("contactsFile", contactsFile);
    }

    const response = await fetch("/api/campaign/run", {
      method: "POST",
      body: payload
    });

    const data = await response.json();
    if (!response.ok) {
      throw data;
    }

    showResult(data, false);
  } catch (error) {
    showResult(error, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Rodar campanha";
  }
});