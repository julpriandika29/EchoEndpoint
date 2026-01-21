export function initResponseModal({ openBtn, modal, backdrop, closeBtn, card, focusEl }) {
  let lastFocused = null;
  let keyHandler = null;

  const open = () => {
    if (!modal || !backdrop) return;
    lastFocused = document.activeElement;
    modal.hidden = false;
    backdrop.hidden = false;
    if (focusEl) {
      focusEl.focus();
    }
    keyHandler = (event) => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", keyHandler);
  };

  const close = () => {
    if (!modal || !backdrop) return;
    modal.hidden = true;
    backdrop.hidden = true;
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  };

  if (openBtn) openBtn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (backdrop) backdrop.addEventListener("click", close);
  if (card) {
    card.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }

  if (modal) modal.hidden = true;
  if (backdrop) backdrop.hidden = true;

  return { open, close };
}

export function initConfirmModal({
  openBtn,
  modal,
  backdrop,
  closeBtn,
  cancelBtn,
  confirmBtn,
  card,
  onConfirm,
}) {
  let lastFocused = null;
  let keyHandler = null;

  const open = () => {
    if (!modal || !backdrop) return;
    lastFocused = document.activeElement;
    modal.hidden = false;
    backdrop.hidden = false;
    if (cancelBtn) {
      cancelBtn.focus();
    }
    keyHandler = (event) => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", keyHandler);
  };

  const close = () => {
    if (!modal || !backdrop) return;
    modal.hidden = true;
    backdrop.hidden = true;
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  };

  if (openBtn) openBtn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);
  if (backdrop) backdrop.addEventListener("click", close);
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      if (onConfirm) {
        await onConfirm();
      }
      close();
    });
  }
  if (card) {
    card.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }

  if (modal) modal.hidden = true;
  if (backdrop) backdrop.hidden = true;

  return { open, close };
}
