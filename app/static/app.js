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

const responseBodyInput = document.getElementById("response-body");
const responseSaveBtn = document.getElementById("response-save");
const responseResetBtn = document.getElementById("response-reset");
const responseStatusText = document.getElementById("response-status-text");

const statusDropdown = document.getElementById("status-dropdown");
const statusSelected = document.getElementById("status-selected");
const statusSearch = document.getElementById("status-search");
const statusOptionsEl = document.getElementById("status-options");
const statusSearchWarning = document.getElementById("status-search-warning");

const contentTypeDropdown = document.getElementById("content-type-dropdown");
const contentTypeSelected = document.getElementById("content-type-selected");
const contentTypeSearch = document.getElementById("content-type-search");
const contentTypeOptionsEl = document.getElementById("content-type-options");
const contentTypeSearchWarning = document.getElementById("content-type-search-warning");

const webhookInput = document.getElementById("webhook-url");
const webhookCopyStatus = document.getElementById("webhook-copy-status");
const openResponseBtn = document.getElementById("open-response-settings");
const responseModal = document.getElementById("response-modal");
const responseModalBackdrop = document.getElementById("response-modal-backdrop");
const closeResponseBtn = document.getElementById("close-response-settings");
const responseModalCard = document.querySelector(".modal-card");
const toastRoot = document.getElementById("toast-root");

const exportBtn = document.getElementById("export-json");
const clearBtn = document.getElementById("clear-requests");
const loadMoreBtn = document.getElementById("load-more");

const defaultResponse = {
  statusCode: 200,
  bodyText: '{"message":"ok"}',
  contentType: "application/json",
};

const statusOptions = [
  { code: 200, label: "OK" },
  { code: 201, label: "Created" },
  { code: 202, label: "Accepted" },
  { code: 204, label: "No Content" },
  { code: 301, label: "Moved Permanently" },
  { code: 302, label: "Found" },
  { code: 304, label: "Not Modified" },
  { code: 400, label: "Bad Request" },
  { code: 401, label: "Unauthorized" },
  { code: 403, label: "Forbidden" },
  { code: 404, label: "Not Found" },
  { code: 409, label: "Conflict" },
  { code: 422, label: "Unprocessable Entity" },
  { code: 429, label: "Too Many Requests" },
  { code: 500, label: "Internal Server Error" },
  { code: 502, label: "Bad Gateway" },
  { code: 503, label: "Service Unavailable" },
  { code: 504, label: "Gateway Timeout" },
];

const contentTypeOptions = [
  "application/json",
  "text/plain",
  "text/html",
  "application/xml",
  "application/x-www-form-urlencoded",
  "application/octet-stream",
];

let selectedStatusCode = defaultResponse.statusCode;
let selectedContentType = defaultResponse.contentType;
let selectedRequestId = null;
let selectionEpoch = 0;

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
  left.className = "request-left";
  left.appendChild(methodBadge(item.method || "N/A"));

  const path = document.createElement("span");
  path.textContent = item.path || "/";
  path.className = "request-path";
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
    child.classList.toggle(
      "active",
      requestId !== null && child.dataset.requestId === String(requestId)
    );
  });
}

function clearDetailView() {
  detailMethod.textContent = "";
  detailPath.textContent = "";
  detailMeta.textContent = "";
  detailHeaders.textContent = "";
  detailQuery.textContent = "";
  detailBody.textContent = "";
  detailBodyRaw.textContent = "";
  detailBodyMeta.textContent = "";
}

function showEmptyDetailState() {
  detailEmptyEl.hidden = false;
  detailEl.hidden = true;
  clearDetailView();
}

function setSelectedRequest(requestId) {
  selectionEpoch += 1;
  selectedRequestId = requestId;
  setActiveItem(requestId);
  if (requestId === null) {
    showEmptyDetailState();
    return;
  }
  detailEmptyEl.hidden = true;
  detailEl.hidden = false;
  clearDetailView();
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
}

async function selectRequest(requestId) {
  setSelectedRequest(requestId);
  const myEpoch = selectionEpoch;
  const res = await fetch(`/api/requests/${requestId}`);
  if (myEpoch !== selectionEpoch || selectedRequestId !== requestId) {
    return;
  }
  const data = await res.json();
  if (myEpoch !== selectionEpoch || selectedRequestId !== requestId) {
    return;
  }

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

function setStatusSelection(statusCode) {
  const match = statusOptions.find((item) => item.code === statusCode);
  selectedStatusCode = match ? match.code : defaultResponse.statusCode;
  const label = match ? `${match.code} - ${match.label}` : `${defaultResponse.statusCode} - OK`;
  statusSelected.textContent = label;
}

function setContentTypeSelection(value) {
  const match = contentTypeOptions.find((item) => item === value);
  selectedContentType = match || defaultResponse.contentType;
  contentTypeSelected.textContent = selectedContentType;
}

function renderStatusOptions() {
  const pattern = statusSearch.value.trim();
  let regex = null;
  let invalid = false;
  if (pattern) {
    let source = pattern;
    if (!source.startsWith("^")) {
      source = `^${source}`;
    }
    try {
      regex = new RegExp(source, "i");
    } catch (err) {
      invalid = true;
    }
  }
  statusSearchWarning.hidden = !invalid;
  statusOptionsEl.innerHTML = "";
  statusOptions.forEach((item) => {
    const codeStr = String(item.code);
    let match = true;
    if (pattern) {
      if (regex) {
        match = regex.test(codeStr);
      } else {
        match = codeStr.toLowerCase().startsWith(pattern.toLowerCase());
      }
    }
    if (!match) return;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${item.code} - ${item.label}`;
    button.addEventListener("click", () => {
      setStatusSelection(item.code);
      statusDropdown.open = false;
    });
    statusOptionsEl.appendChild(button);
  });
}

function renderContentTypeOptions() {
  const pattern = contentTypeSearch.value.trim();
  let regex = null;
  let invalid = false;
  if (pattern) {
    try {
      regex = new RegExp(pattern, "i");
    } catch (err) {
      invalid = true;
    }
  }
  contentTypeSearchWarning.hidden = !invalid;
  contentTypeOptionsEl.innerHTML = "";
  contentTypeOptions.forEach((item) => {
    let match = true;
    if (pattern) {
      if (regex) {
        match = regex.test(item);
      } else {
        match = item.toLowerCase().includes(pattern.toLowerCase());
      }
    }
    if (!match) return;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item;
    button.addEventListener("click", () => {
      setContentTypeSelection(item);
      contentTypeDropdown.open = false;
    });
    contentTypeOptionsEl.appendChild(button);
  });
}

function setResponseForm(statusCode, bodyText, contentType) {
  setStatusSelection(statusCode);
  setContentTypeSelection(contentType);
  let bodyValue = bodyText;
  if (typeof bodyValue !== "string") {
    try {
      bodyValue = JSON.stringify(bodyValue, null, 2);
    } catch (err) {
      bodyValue = String(bodyValue);
    }
  }
  responseBodyInput.value = bodyValue;
}

function setResponseStatus(message, isError = false) {
  responseStatusText.textContent = message;
  responseStatusText.classList.toggle("error", isError);
}

function showToast({ type, title, message, duration = 3000 }) {
  if (!toastRoot) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type || "info"}`;

  const header = document.createElement("div");
  header.className = "toast-header";

  const heading = document.createElement("div");
  heading.className = "toast-title";
  heading.textContent = title || "Notice";

  const closeBtn = document.createElement("button");
  closeBtn.className = "toast-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close notification");
  closeBtn.textContent = "×";

  const body = document.createElement("p");
  body.className = "toast-message";
  body.textContent = message || "";

  const bar = document.createElement("div");
  bar.className = "toast-bar";
  bar.style.animationDuration = `${duration}ms`;

  header.appendChild(heading);
  header.appendChild(closeBtn);
  toast.appendChild(header);
  toast.appendChild(body);
  toast.appendChild(bar);

  toastRoot.prepend(toast);
  const toasts = toastRoot.querySelectorAll(".toast");
  if (toasts.length > 4) {
    toasts[toasts.length - 1].remove();
  }

  let timeoutId = null;
  const removeToast = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    toast.remove();
  };
  timeoutId = setTimeout(removeToast, duration);
  closeBtn.addEventListener("click", removeToast);
}

function setCopyFeedback(message) {
  if (!webhookCopyStatus) return;
  webhookCopyStatus.textContent = message;
  if (!message) return;
  setTimeout(() => {
    webhookCopyStatus.textContent = "";
  }, 1500);
}

async function copyWebhookUrl() {
  if (!webhookInput) return;
  const value = webhookInput.value;
  try {
    await navigator.clipboard.writeText(value);
    webhookInput.classList.add("copied");
    setCopyFeedback("Copied!");
  } catch (err) {
    try {
      webhookInput.focus();
      webhookInput.select();
      const ok = document.execCommand("copy");
      if (ok) {
        webhookInput.classList.add("copied");
        setCopyFeedback("Copied!");
      } else {
        setCopyFeedback("Copy failed");
      }
    } catch (fallbackErr) {
      setCopyFeedback("Copy failed");
    }
  } finally {
    setTimeout(() => {
      webhookInput.classList.remove("copied");
    }, 1500);
  }
}

let lastFocusedElement = null;
let modalKeyHandler = null;

function openResponseModal() {
  if (!responseModal || !responseModalBackdrop) return;
  lastFocusedElement = document.activeElement;
  responseModal.hidden = false;
  responseModalBackdrop.hidden = false;
  if (responseBodyInput) {
    responseBodyInput.focus();
  }
  modalKeyHandler = (event) => {
    if (event.key === "Escape") {
      closeResponseModal();
    }
  };
  document.addEventListener("keydown", modalKeyHandler);
}

function closeResponseModal() {
  if (!responseModal || !responseModalBackdrop) return;
  responseModal.hidden = true;
  responseModalBackdrop.hidden = true;
  if (modalKeyHandler) {
    document.removeEventListener("keydown", modalKeyHandler);
    modalKeyHandler = null;
  }
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

async function loadResponseConfig() {
  try {
    const res = await fetch(`/api/endpoints/${state.token}/response`);
    if (res.status === 404) {
      setResponseForm(
        defaultResponse.statusCode,
        defaultResponse.bodyText,
        defaultResponse.contentType
      );
      setResponseStatus("Using default response");
      return;
    }
    if (!res.ok) {
      setResponseStatus("Failed to load response config", true);
      return;
    }
    const data = await res.json();
    setResponseForm(data.status_code, data.body, data.content_type || defaultResponse.contentType);
    setResponseStatus("Custom response loaded");
  } catch (err) {
    setResponseStatus("Failed to load response config", true);
  }
}

responseSaveBtn.addEventListener("click", async () => {
  const statusCode = selectedStatusCode;
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    setResponseStatus("Select a valid status code", true);
    return;
  }

  const body = responseBodyInput.value;
  const contentType = selectedContentType;

  try {
    const res = await fetch(`/api/endpoints/${state.token}/response`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status_code: statusCode, body, content_type: contentType }),
    });
    if (!res.ok) {
      setResponseStatus("Failed to save response config", true);
      showToast({
        type: "warning",
        title: "Save failed",
        message: "Could not update response settings.",
      });
      return;
    }
    setResponseStatus("Response saved");
    showToast({ type: "success", title: "Saved", message: "Response settings updated." });
  } catch (err) {
    setResponseStatus("Failed to save response config", true);
    showToast({
      type: "warning",
      title: "Save failed",
      message: "Could not update response settings.",
    });
  }
});

responseResetBtn.addEventListener("click", async () => {
  try {
    const res = await fetch(`/api/endpoints/${state.token}/response`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setResponseStatus("Failed to reset response config", true);
      showToast({
        type: "warning",
        title: "Reset failed",
        message: "Could not reset response settings.",
      });
      return;
    }
    setResponseForm(
      defaultResponse.statusCode,
      defaultResponse.bodyText,
      defaultResponse.contentType
    );
    setResponseStatus("Reset to default");
    showToast({
      type: "info",
      title: "Reset",
      message: "Response settings restored to default.",
    });
  } catch (err) {
    setResponseStatus("Failed to reset response config", true);
    showToast({
      type: "warning",
      title: "Reset failed",
      message: "Could not reset response settings.",
    });
  }
});

if (webhookInput) {
  webhookInput.addEventListener("click", copyWebhookUrl);
}

if (openResponseBtn) {
  openResponseBtn.addEventListener("click", openResponseModal);
}
if (closeResponseBtn) {
  closeResponseBtn.addEventListener("click", closeResponseModal);
}
if (responseModalBackdrop) {
  responseModalBackdrop.addEventListener("click", closeResponseModal);
}
if (responseModalCard) {
  responseModalCard.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

exportBtn.addEventListener("click", () => {
  window.location.href = `/api/endpoints/${state.token}/export`;
});

clearBtn.addEventListener("click", async () => {
  const ok = window.confirm("Clear all requests for this endpoint?");
  if (!ok) return;
  try {
    const res = await fetch(`/api/endpoints/${state.token}/clear`, { method: "POST" });
    if (!res.ok) {
      showToast({
        type: "warning",
        title: "Clear failed",
        message: "Could not clear requests.",
      });
      return;
    }
    showToast({
      type: "warning",
      title: "Cleared",
      message: "All requests were cleared.",
    });
  } catch (err) {
    showToast({
      type: "warning",
      title: "Clear failed",
      message: "Could not clear requests.",
    });
    return;
  }
  state.offset = 0;
  setSelectedRequest(null);
  listEl.innerHTML = "";
  updateCount();
  await fetchList(false);
});

loadMoreBtn.addEventListener("click", async () => {
  await fetchList(true);
});

setResponseForm(
  defaultResponse.statusCode,
  defaultResponse.bodyText,
  defaultResponse.contentType
);
renderStatusOptions();
renderContentTypeOptions();

statusSearch.addEventListener("input", renderStatusOptions);
contentTypeSearch.addEventListener("input", renderContentTypeOptions);

fetchList(true);
setupSSE();
loadResponseConfig();
showEmptyDetailState();

if (responseModal) {
  responseModal.hidden = true;
}
if (responseModalBackdrop) {
  responseModalBackdrop.hidden = true;
}
