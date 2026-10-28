import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from '@/api/schema';
import { serverBase } from './base-path';
import { notifySignedOut, promptForCredential } from './credential-prompt';
import { ApiError, toApiError } from './errors';

// One typed client for the whole app, generated from packages/contracts.
//
// Two refusals are handled here so no screen has to: a 401 on an authenticated
// route means the session ended (the auth gate shows the sign-in screen), and a
// 403 `step_up_required` asks for the admin password once and replays the
// request. The auth routes themselves are left alone: a wrong password there is
// an answer for the form, not a reason to prompt.

const AUTH_ROUTES = /\/api\/auth\/(setup|login|step-up|pairing\/redeem)$/;
const pending = new WeakMap<Request, Request>();

const refusals: Middleware = {
  onRequest({ request }) {
    pending.set(request, request.clone());
    return request;
  },
  async onResponse({ request, response }) {
    const replay = pending.get(request);
    pending.delete(request);
    if (AUTH_ROUTES.test(new URL(request.url).pathname)) return response;
    if (response.status === 401) {
      notifySignedOut();
      return response;
    }
    if (response.status !== 403 || !replay) return response;
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    if (toApiError(403, body).code !== 'step_up_required') return response;
    if (!(await promptForCredential('step-up'))) return response;
    return fetch(replay);
  },
};

export const api = createClient<paths>({
  baseUrl: window.location.origin + serverBase().replace(/\/$/, ''),
  credentials: 'same-origin',
});
api.use(refusals);

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** The data of a successful call, or an ApiError for anything else. */
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (response.ok && data !== undefined) return data;
  throw error instanceof ApiError ? error : toApiError(response.status, error);
}
