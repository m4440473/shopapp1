export const AUTH_REQUIRED_EVENT_NAME = 'shopapp:auth-required';

type AuthRequiredEventDetail = {
  url?: string;
};

export function emitAuthRequired(detail: AuthRequiredEventDetail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AuthRequiredEventDetail>(AUTH_REQUIRED_EVENT_NAME, { detail }));
}
