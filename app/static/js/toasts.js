let toastRoot = null;

export function initToasts(root) {
  toastRoot = root;
}

export function showToast({ type, title, message, duration = 3000 }) {
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
