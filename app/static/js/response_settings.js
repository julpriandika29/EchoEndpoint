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

export function initResponseSettings({
  state,
  responseState,
  defaultResponse,
  elements,
  api,
  showToast,
}) {
  const {
    responseBodyInput,
    responseSaveBtn,
    responseResetBtn,
    responseStatusText,
    statusDropdown,
    statusSelected,
    statusSearch,
    statusOptionsEl,
    statusSearchWarning,
    contentTypeDropdown,
    contentTypeSelected,
    contentTypeSearch,
    contentTypeOptionsEl,
    contentTypeSearchWarning,
  } = elements;

  function setStatusSelection(statusCode) {
    const match = statusOptions.find((item) => item.code === statusCode);
    responseState.selectedStatusCode = match ? match.code : defaultResponse.statusCode;
    const label = match ? `${match.code} - ${match.label}` : `${defaultResponse.statusCode} - OK`;
    statusSelected.textContent = label;
  }

  function setContentTypeSelection(value) {
    const match = contentTypeOptions.find((item) => item === value);
    responseState.selectedContentType = match || defaultResponse.contentType;
    contentTypeSelected.textContent = responseState.selectedContentType;
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

  async function loadResponseConfig() {
    try {
      const data = await api.getResponseConfig(state.token);
      if (!data) {
        setResponseForm(
          defaultResponse.statusCode,
          defaultResponse.bodyText,
          defaultResponse.contentType
        );
        setResponseStatus("Using default response");
        return;
      }
      setResponseForm(data.status_code, data.body, data.content_type || defaultResponse.contentType);
      setResponseStatus("Custom response loaded");
    } catch (err) {
      setResponseStatus("Failed to load response config", true);
    }
  }

  responseSaveBtn.addEventListener("click", async () => {
    const statusCode = responseState.selectedStatusCode;
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
      setResponseStatus("Select a valid status code", true);
      return;
    }

    const body = responseBodyInput.value;
    const contentType = responseState.selectedContentType;

    try {
      const res = await api.setResponseConfig(state.token, {
        status_code: statusCode,
        body,
        content_type: contentType,
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
      const res = await api.deleteResponseConfig(state.token);
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

  setResponseForm(
    defaultResponse.statusCode,
    defaultResponse.bodyText,
    defaultResponse.contentType
  );
  renderStatusOptions();
  renderContentTypeOptions();

  statusSearch.addEventListener("input", renderStatusOptions);
  contentTypeSearch.addEventListener("input", renderContentTypeOptions);

  return { loadResponseConfig };
}
