export async function listRequests(token, limit, offset) {
  const res = await fetch(
    `/api/endpoints/${token}/requests?limit=${limit}&offset=${offset}`
  );
  if (!res.ok) {
    throw new Error("Failed to load requests");
  }
  return res.json();
}

export async function requestDetail(requestId) {
  const res = await fetch(`/api/requests/${requestId}`);
  if (!res.ok) {
    throw new Error("Failed to load request detail");
  }
  return res.json();
}

export async function clearRequests(token) {
  return fetch(`/api/endpoints/${token}/clear`, { method: "POST" });
}

export async function getResponseConfig(token) {
  const res = await fetch(`/api/endpoints/${token}/response`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error("Failed to load response config");
  }
  return res.json();
}

export async function setResponseConfig(token, payload) {
  return fetch(`/api/endpoints/${token}/response`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteResponseConfig(token) {
  return fetch(`/api/endpoints/${token}/response`, { method: "DELETE" });
}
