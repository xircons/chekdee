const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const STATE_STORAGE_KEY = "checkdee_line_oauth_state";

export function lineLoginRedirectURI(): string {
  return process.env.NEXT_PUBLIC_LINE_LOGIN_REDIRECT_URI ?? "";
}

// buildLineLoginURL generates the state param and stores it so the
// callback page can verify it (CSRF protection on the OAuth redirect).
export function buildLineLoginURL(): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_STORAGE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.NEXT_PUBLIC_LINE_CHANNEL_ID ?? "",
    redirect_uri: lineLoginRedirectURI(),
    state,
    scope: "profile openid",
  });

  return `${LINE_AUTHORIZE_URL}?${params.toString()}`;
}

export function consumeStoredState(): string | null {
  const state = sessionStorage.getItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  return state;
}
