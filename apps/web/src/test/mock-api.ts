import { vi } from 'vitest';

/** One canned answer: a JSON body (status 200 unless given) or a function of the request. */
export type MockReply =
  | { status?: number; body?: unknown }
  | ((
      request: Request,
    ) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>);

/**
 * Stub `fetch` with replies keyed by `"METHOD /api/path"` (query string ignored).
 * Returns the list of requests made, for assertions. Unknown routes answer 404.
 */
export function mockApi(routes: Record<string, MockReply>): Request[] {
  const calls: Request[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request | string, init?: RequestInit) => {
      const request =
        input instanceof Request ? input : new Request(new URL(input, 'http://localhost'), init);
      // Kept as sent and never read here, so a test can read its body; a reply
      // function gets its own clone. (Cloning every request a second time hangs
      // undici on some Node versions with a FormData body.)
      calls.push(request);
      const path = new URL(request.url).pathname.replace(/^.*?(\/api\/)/, '/api/');
      const reply = routes[`${request.method} ${path}`];
      if (!reply) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Not found.' } }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      const { status = 200, body = {} } =
        typeof reply === 'function' ? await reply(request.clone()) : reply;
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return calls;
}
