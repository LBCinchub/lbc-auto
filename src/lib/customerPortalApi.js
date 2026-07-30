const TOKEN_KEY = "customer_portal_token";

export const getPortalToken = () => sessionStorage.getItem(TOKEN_KEY) || "";
export const setPortalToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearPortalToken = () => sessionStorage.removeItem(TOKEN_KEY);

export async function portalRequest(functionName, body = {}, authenticated = false) {
  const token = authenticated ? getPortalToken() : "";
  const response = await fetch(`/api/functions/${functionName}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request unavailable");
    error.status = response.status;
    throw error;
  }
  return data;
}