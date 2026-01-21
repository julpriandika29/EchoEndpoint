export const state = {
  token: document.body.dataset.token,
  webhookUrl: document.body.dataset.webhook,
  offset: 0,
  limit: 200,
};

export const selection = {
  selectedRequestId: null,
  selectionEpoch: 0,
};

export const responseState = {
  selectedStatusCode: 200,
  selectedContentType: "application/json",
};

export const defaultResponse = {
  statusCode: 200,
  bodyText: '{"message":"ok"}',
  contentType: "application/json",
};
