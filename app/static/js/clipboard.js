export function initClipboardCopy({ input, showToast }) {
  if (!input) return;
  input.addEventListener("click", async () => {
    const value = input.value;
    try {
      await navigator.clipboard.writeText(value);
      showToast({
        type: "success",
        title: "Copied",
        message: "Webhook URL copied to clipboard.",
      });
    } catch (err) {
      try {
        input.focus();
        input.select();
        const ok = document.execCommand("copy");
        if (ok) {
          showToast({
            type: "success",
            title: "Copied",
            message: "Webhook URL copied to clipboard.",
          });
        } else {
          showToast({
            type: "warning",
            title: "Copy failed",
            message: "Could not copy webhook URL.",
          });
        }
      } catch (fallbackErr) {
        showToast({
          type: "warning",
          title: "Copy failed",
          message: "Could not copy webhook URL.",
        });
      }
    }
  });
}
