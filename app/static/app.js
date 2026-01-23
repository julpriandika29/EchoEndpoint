import { byId } from "./js/dom.js";
import { state, selection, responseState, defaultResponse } from "./js/state.js";
import * as api from "./js/api.js";
import { initToasts, showToast } from "./js/toasts.js";
import { initClipboardCopy } from "./js/clipboard.js";
import { initResponseModal, initConfirmModal } from "./js/modals.js";
import { initRequests } from "./js/requests.js";
import { initResponseSettings } from "./js/response_settings.js";
import { initSSE } from "./js/sse.js";

const elements = {
  listEl: byId("request-list"),
  countEl: byId("request-count"),
  detailEl: byId("detail"),
  detailEmptyEl: byId("detail-empty"),
  detailMethod: byId("detail-method"),
  detailPath: byId("detail-path"),
  detailMeta: byId("detail-meta"),
  detailHeaders: byId("detail-headers"),
  detailQuery: byId("detail-query"),
  detailBody: byId("detail-body"),
  detailBodyRaw: byId("detail-body-raw"),
  detailBodyMeta: byId("detail-body-meta"),
  responseBodyInput: byId("response-body"),
  responseSaveBtn: byId("response-save"),
  responseResetBtn: byId("response-reset"),
  responseStatusText: byId("response-status-text"),
  statusDropdown: byId("status-dropdown"),
  statusSelected: byId("status-selected"),
  statusSearch: byId("status-search"),
  statusOptionsEl: byId("status-options"),
  statusSearchWarning: byId("status-search-warning"),
  contentTypeDropdown: byId("content-type-dropdown"),
  contentTypeSelected: byId("content-type-selected"),
  contentTypeSearch: byId("content-type-search"),
  contentTypeOptionsEl: byId("content-type-options"),
  contentTypeSearchWarning: byId("content-type-search-warning"),
  webhookInput: byId("webhook-url"),
  openResponseBtn: byId("open-response-settings"),
  responseModal: byId("response-modal"),
  responseModalBackdrop: byId("response-modal-backdrop"),
  closeResponseBtn: byId("close-response-settings"),
  exportBtn: byId("export-json"),
  clearBtn: byId("clear-requests"),
  loadMoreBtn: byId("load-more"),
  toastRoot: byId("toast-root"),
  clearModal: byId("clear-modal"),
  clearModalBackdrop: byId("clear-modal-backdrop"),
  closeClearModalBtn: byId("close-clear-modal"),
  cancelClearModalBtn: byId("cancel-clear-modal"),
  confirmClearModalBtn: byId("confirm-clear-modal"),
  mobileToggle: byId("mobile-toggle"),
  mobileTabList: byId("mobile-tab-list"),
  mobileTabDetail: byId("mobile-tab-detail"),
  mobileBack: byId("mobile-back"),
};

const responseModalCard = document.querySelector("#response-modal .modal-card");
const clearModalCard = elements.clearModal
  ? elements.clearModal.querySelector(".modal-card")
  : null;

initToasts(elements.toastRoot);
initClipboardCopy({ input: elements.webhookInput, showToast });

const requests = initRequests({
  state,
  selection,
  elements: {
    root: document.body,
    listEl: elements.listEl,
    countEl: elements.countEl,
    detailEl: elements.detailEl,
    detailEmptyEl: elements.detailEmptyEl,
    detailMethod: elements.detailMethod,
    detailPath: elements.detailPath,
    detailMeta: elements.detailMeta,
    detailHeaders: elements.detailHeaders,
    detailQuery: elements.detailQuery,
    detailBody: elements.detailBody,
    detailBodyRaw: elements.detailBodyRaw,
    detailBodyMeta: elements.detailBodyMeta,
    mobileToggle: elements.mobileToggle,
    mobileTabList: elements.mobileTabList,
    mobileTabDetail: elements.mobileTabDetail,
    mobileBack: elements.mobileBack,
  },
  api,
});
requests.setupMobileToggle();

const responseSettings = initResponseSettings({
  state,
  responseState,
  defaultResponse,
  elements: {
    responseBodyInput: elements.responseBodyInput,
    responseSaveBtn: elements.responseSaveBtn,
    responseResetBtn: elements.responseResetBtn,
    responseStatusText: elements.responseStatusText,
    statusDropdown: elements.statusDropdown,
    statusSelected: elements.statusSelected,
    statusSearch: elements.statusSearch,
    statusOptionsEl: elements.statusOptionsEl,
    statusSearchWarning: elements.statusSearchWarning,
    contentTypeDropdown: elements.contentTypeDropdown,
    contentTypeSelected: elements.contentTypeSelected,
    contentTypeSearch: elements.contentTypeSearch,
    contentTypeOptionsEl: elements.contentTypeOptionsEl,
    contentTypeSearchWarning: elements.contentTypeSearchWarning,
  },
  api,
  showToast,
});

initResponseModal({
  openBtn: elements.openResponseBtn,
  modal: elements.responseModal,
  backdrop: elements.responseModalBackdrop,
  closeBtn: elements.closeResponseBtn,
  card: responseModalCard,
  focusEl: elements.responseBodyInput,
});

initConfirmModal({
  openBtn: elements.clearBtn,
  modal: elements.clearModal,
  backdrop: elements.clearModalBackdrop,
  closeBtn: elements.closeClearModalBtn,
  cancelBtn: elements.cancelClearModalBtn,
  confirmBtn: elements.confirmClearModalBtn,
  card: clearModalCard,
  onConfirm: async () => {
    const ok = await requests.clearAllRequests();
    if (ok) {
      showToast({
        type: "warning",
        title: "Cleared",
        message: "All requests were cleared.",
      });
    } else {
      showToast({
        type: "warning",
        title: "Clear failed",
        message: "Could not clear requests.",
      });
    }
  },
});

if (elements.exportBtn) {
  elements.exportBtn.addEventListener("click", () => {
    window.location.href = `/api/endpoints/${state.token}/export`;
  });
}

if (elements.loadMoreBtn) {
  elements.loadMoreBtn.addEventListener("click", async () => {
    try {
      const added = await requests.fetchList(true);
      if (added > 0) {
        showToast({
          type: "info",
          title: "Loaded",
          message: `Loaded ${added} new requests.`,
        });
      } else {
        showToast({
          type: "info",
          title: "Loaded",
          message: "No new requests to load.",
        });
      }
    } catch (err) {
      showToast({
        type: "warning",
        title: "Load failed",
        message: "Could not load more requests.",
      });
    }
  });
}

initSSE(state.token, requests.prependRequest);
requests.fetchList(true);
responseSettings.loadResponseConfig();
requests.showEmptyDetailState();
