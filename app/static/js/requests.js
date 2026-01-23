export function initRequests({ state, selection, elements, api }) {
  const {
    root,
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
    mobileToggle,
    mobileTabList,
    mobileTabDetail,
    mobileBack,
  } = elements;
  const rootEl = root || document.body;
  const mobileMedia = window.matchMedia("(max-width: 768px)");
  let currentView = "list";
  const renderedIds = new Set();
  let duplicateWarned = false;

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

  function updateMobileTabs(view) {
    if (mobileTabList) {
      mobileTabList.classList.toggle("active", view === "list");
    }
    if (mobileTabDetail) {
      mobileTabDetail.classList.toggle("active", view === "detail");
    }
  }

  function setView(view) {
    currentView = view;
    if (mobileMedia.matches) {
      rootEl.dataset.view = view;
    } else {
      delete rootEl.dataset.view;
    }
    updateMobileTabs(view);
  }

  function setSelectedRequest(requestId) {
    selection.selectionEpoch += 1;
    selection.selectedRequestId = requestId;
    setActiveItem(requestId);
    if (requestId === null) {
      showEmptyDetailState();
      if (mobileMedia.matches) {
        setView("list");
      }
      return;
    }
    detailEmptyEl.hidden = true;
    detailEl.hidden = false;
    clearDetailView();
    if (mobileMedia.matches) {
      setView("detail");
    }
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

  function appendItem(item, position = "append") {
    if (renderedIds.has(item.id)) {
      if (!duplicateWarned) {
        console.warn("Duplicate request id skipped in list rendering.");
        duplicateWarned = true;
      }
      return false;
    }
    const node = buildListItem(item);
    if (position === "prepend") {
      listEl.prepend(node);
    } else {
      listEl.appendChild(node);
    }
    renderedIds.add(item.id);
    return true;
  }

  async function fetchList(append = true) {
    const data = await api.listRequests(state.token, state.limit, state.offset);
    if (!append) {
      listEl.innerHTML = "";
      renderedIds.clear();
    }
    data.items.forEach((item) => appendItem(item, "append"));
    state.offset += data.items.length;
    updateCount();
    return data.items.length;
  }

  function setupMobileToggle() {
    if (mobileTabList) {
      mobileTabList.addEventListener("click", () => {
        setView("list");
      });
    }
    if (mobileTabDetail) {
      mobileTabDetail.addEventListener("click", () => {
        setView("detail");
      });
    }
    if (mobileBack) {
      mobileBack.addEventListener("click", () => {
        setView("list");
      });
    }
    mobileMedia.addEventListener("change", () => {
      if (!mobileMedia.matches) {
        delete rootEl.dataset.view;
      } else {
        setView(currentView || "list");
      }
    });
    if (mobileMedia.matches) {
      setView("list");
    }
  }

  function prependRequest(payload) {
    const item = {
      id: payload.id,
      received_at: payload.received_at,
      method: payload.method,
      path: payload.path,
    };
    const added = appendItem(item, "prepend");
    if (added) {
      state.offset += 1;
      updateCount();
    }
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
    renderedIds.clear();
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
    setupMobileToggle,
  };
}
