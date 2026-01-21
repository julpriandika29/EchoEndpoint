export function initSSE(token, onRequest) {
  const source = new EventSource(`/events/${token}`);
  source.addEventListener("request_received", (event) => {
    try {
      const payload = JSON.parse(event.data);
      onRequest(payload);
    } catch (err) {
      console.error("Failed to parse SSE payload", err);
    }
  });
  return source;
}
