export function initRequests({ state, selection, elements, api }) {
  const {
    listEl,
    countEl,
    detailEl,
    detailEmptyEl,
    detailMethod,
    detailPath,
    detailMeta,
    detailHeaders,
    detailQuery,
    detailBody,
    detailBodyRaw,
    detailBodyMeta,
  } = elements;

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
    selection.selectionEpoch += 1;
    selection.selectedRequestId = requestId;
    setActiveItem(requestId);
    if (requestId === null) {
      showEmptyDetailState();
      return;
    }
    detailEmptyEl.hidden = true;
    detailEl.hidden = false;
    clearDetailView();
  }

  async function selectRequest(requestId) {
    setSelectedRequest(requestId);
    const myEpoch = selection.selectionEpoch;
    let data;
    try {
      data = await api.requestDetail(requestId);
    } catch (err) {
      return;
    }
    if (myEpoch !== selection.selectionEpoch || selection.selectedRequestId !== requestId) {
      return;
    }

    detailMethod.textContent = data.method;
    detailPath.textContent = data.path;
    detailMeta.textContent = `${formatTimestamp(data.received_at)} Aú ${
      data.remote_ip || "unknown"
    }`;

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

  async function fetchList(append = true) {
    const data = await api.listRequests(state.token, state.limit, state.offset);
    if (!append) {
      listEl.innerHTML = "";
    }
    data.items.forEach((item) => {
      listEl.appendChild(buildListItem(item));
    });
    state.offset += data.items.length;
    updateCount();
    return data.items.length;
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

  async function clearAllRequests() {
    let res;
    try {
      res = await api.clearRequests(state.token);
    } catch (err) {
      return false;
    }
    if (!res.ok) {
      return false;
    }
    state.offset = 0;
    setSelectedRequest(null);
    listEl.innerHTML = "";
    updateCount();
    await fetchList(false);
    return true;
  }

  return {
    fetchList,
    prependRequest,
    showEmptyDetailState,
    setSelectedRequest,
    clearAllRequests,
  };
}
