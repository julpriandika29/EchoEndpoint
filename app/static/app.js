const state = {
  token: document.body.dataset.token,
  webhookUrl: document.body.dataset.webhook,
  offset: 0,
  limit: 200,
  selectedId: null,
};

const listEl = document.getElementById("request-list");
const countEl = document.getElementById("request-count");
const detailEl = document.getElementById("detail");
const detailEmptyEl = document.getElementById("detail-empty");

const detailMethod = document.getElementById("detail-method");
const detailPath = document.getElementById("detail-path");
const detailMeta = document.getElementById("detail-meta");
const detailHeaders = document.getElementById("detail-headers");
const detailQuery = document.getElementById("detail-query");
const detailBody = document.getElementById("detail-body");
const detailBodyRaw = document.getElementById("detail-body-raw");
const detailBodyMeta = document.getElementById("detail-body-meta");

const responseStatusInput = document.getElementById("response-status-code");
const responseBodyInput = document.getElementById("response-body");
const responseSaveBtn = document.getElementById("response-save");
const responseResetBtn = document.getElementById("response-reset");
const responseStatusText = document.getElementById("response-status-text");

const copyBtn = document.getElementById("copy-url");
const exportBtn = document.getElementById("export-json");
const clearBtn = document.getElementById("clear-requests");
const loadMoreBtn = document.getElementById("load-more");

const defaultResponse = {
  statusCode: 200,
  body: { message: "ok" },
};

function formatTimestamp(iso) {
  if (!iso) return "unknown";
  const date = new Date(iso);
  return date.toLocaleString();
}

function methodBadge(method) {
  const span = document.createElement("span");
  span.className = "badge";
  span.textContent = method;
  return span;
}

function buildListItem(item) {
  const card = document.createElement("div");
  card.className = "request-item";
  card.dataset.requestId = item.id;

  const row = document.createElement("div");
  row.className = "request-row";

  const left = document.createElement("div");
  left.appendChild(methodBadge(item.method || "N/A"));

  const path = document.createElement("span");
  path.textContent = item.path || "/";
  path.className = "detail-path";
  left.appendChild(path);

  const time = document.createElement("span");
  time.className = "request-meta";
  time.textContent = formatTimestamp(item.received_at);

  row.appendChild(left);
  card.appendChild(row);
  card.appendChild(time);

  card.addEventListener("click", () => {
    selectRequest(item.id);
  });

  return card;
}

function updateCount() {
  countEl.textContent = listEl.children.length.toString();
}

function setActiveItem(requestId) {
  Array.from(listEl.children).forEach((child) => {
    child.classList.toggle("active", child.dataset.requestId === String(requestId));
  });
}

async function fetchList(append = true) {
  const url = `/api/endpoints/${state.token}/requests?limit=${state.limit}&offset=${state.offset}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!append) {
    listEl.innerHTML = "";
  }
  data.items.forEach((item) => {
    listEl.appendChild(buildListItem(item));
  });
  state.offset += data.items.length;
  updateCount();
  if (!state.selectedId && data.items.length) {
    selectRequest(data.items[0].id);
  }
}

async function selectRequest(requestId) {
  state.selectedId = requestId;
  setActiveItem(requestId);
  const res = await fetch(`/api/requests/${requestId}`);
  const data = await res.json();

  detailMethod.textContent = data.method;
  detailPath.textContent = data.path;
  detailMeta.textContent = `${formatTimestamp(data.received_at)} · ${data.remote_ip || "unknown"}`;

  let headers = {};
  try {
    headers = JSON.parse(data.headers_json);
  } catch (err) {
    headers = { error: "Unable to parse headers" };
  }
  detailHeaders.textContent = JSON.stringify(headers, null, 2);

  const params = {};
  if (data.query) {
    const parsed = new URLSearchParams(data.query);
    parsed.forEach((value, key) => {
      params[key] = value;
    });
  }
  detailQuery.textContent = JSON.stringify(params, null, 2);

  const rawText = data.body_text || "";
  let prettyBody = rawText;
  if (rawText) {
    try {
      prettyBody = JSON.stringify(JSON.parse(rawText), null, 2);
    } catch (err) {
      prettyBody = rawText;
    }
  }
  detailBody.textContent = prettyBody || "(empty)";

  if (rawText) {
    detailBodyRaw.textContent = rawText;
  } else {
    detailBodyRaw.textContent = data.body_blob_base64
      ? `base64:${data.body_blob_base64}`
      : "(empty)";
  }

  const sizeInfo = `${data.body_size} bytes${data.truncated ? " (truncated)" : ""}`;
  detailBodyMeta.textContent = sizeInfo;

  detailEmptyEl.hidden = true;
  detailEl.hidden = false;
}

function prependRequest(payload) {
  const item = {
    id: payload.id,
    received_at: payload.received_at,
    method: payload.method,
    path: payload.path,
  };
  const node = buildListItem(item);
  listEl.prepend(node);
  updateCount();
}

function setupSSE() {
  const source = new EventSource(`/events/${state.token}`);
  source.addEventListener("request_received", (event) => {
    try {
      const payload = JSON.parse(event.data);
      prependRequest(payload);
    } catch (err) {
      console.error("Failed to parse SSE payload", err);
    }
  });
}

function setResponseForm(statusCode, body) {
  responseStatusInput.value = String(statusCode);
  responseBodyInput.value = JSON.stringify(body, null, 2);
}

function setResponseStatus(message, isError = false) {
  responseStatusText.textContent = message;
  responseStatusText.classList.toggle("error", isError);
}

async function loadResponseConfig() {
  try {
    const res = await fetch(`/api/endpoints/${state.token}/response`);
    if (res.status === 404) {
      setResponseForm(defaultResponse.statusCode, defaultResponse.body);
      setResponseStatus("Using default response");
      return;
    }
    if (!res.ok) {
      setResponseStatus("Failed to load response config", true);
      return;
    }
    const data = await res.json();
    setResponseForm(data.status_code, data.body);
    setResponseStatus("Custom response loaded");
  } catch (err) {
    setResponseStatus("Failed to load response config", true);
  }
}

responseSaveBtn.addEventListener("click", async () => {
  const statusCode = Number(responseStatusInput.value);
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    setResponseStatus("Status code must be between 100 and 599", true);
    return;
  }

  let body;
  try {
    body = JSON.parse(responseBodyInput.value);
  } catch (err) {
    setResponseStatus("Body must be valid JSON", true);
    return;
  }

  try {
    const res = await fetch(`/api/endpoints/${state.token}/response`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status_code: statusCode, body }),
    });
    if (!res.ok) {
      setResponseStatus("Failed to save response config", true);
      return;
    }
    setResponseStatus("Response saved");
  } catch (err) {
    setResponseStatus("Failed to save response config", true);
  }
});

responseResetBtn.addEventListener("click", async () => {
  try {
    const res = await fetch(`/api/endpoints/${state.token}/response`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setResponseStatus("Failed to reset response config", true);
      return;
    }
    setResponseForm(defaultResponse.statusCode, defaultResponse.body);
    setResponseStatus("Reset to default");
  } catch (err) {
    setResponseStatus("Failed to reset response config", true);
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(state.webhookUrl);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy Webhook URL";
    }, 1500);
  } catch (err) {
    window.alert("Copy failed. Please select the URL manually.");
  }
});

exportBtn.addEventListener("click", () => {
  window.location.href = `/api/endpoints/${state.token}/export`;
});

clearBtn.addEventListener("click", async () => {
  const ok = window.confirm("Clear all requests for this endpoint?");
  if (!ok) return;
  await fetch(`/api/endpoints/${state.token}/clear`, { method: "POST" });
  state.offset = 0;
  state.selectedId = null;
  detailEl.hidden = true;
  detailEmptyEl.hidden = false;
  await fetchList(false);
});

loadMoreBtn.addEventListener("click", async () => {
  await fetchList(true);
});

fetchList(true);
setupSSE();
loadResponseConfig();
