import { i18n } from '@/i18n';

/** An API refusal, carrying the server's stable `code` and readable `message`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Envelope {
  error?: { code?: unknown; message?: unknown; correlation_id?: unknown } | string;
}

/** Build an ApiError from whatever a failed response carried. */
export function toApiError(status: number, body: unknown): ApiError {
  const err = (body as Envelope | null)?.error;
  if (typeof err === 'object') {
    return new ApiError(
      status,
      typeof err.code === 'string' ? err.code : 'error',
      typeof err.message === 'string' ? err.message : `HTTP ${status}`,
      typeof err.correlation_id === 'string' ? err.correlation_id : undefined,
    );
  }
  return new ApiError(status, 'error', typeof err === 'string' ? err : `HTTP ${status}`);
}

/**
 * The sentence to show for any failure, network errors included. The server's message stays as
 * sent; only the reference wording and the last-resort sentence follow the active language.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.correlationId
      ? i18n.t('ui:error.withReference', {
          message: error.message,
          reference: error.correlationId,
        })
      : error.message;
  }
  return error instanceof Error ? error.message : i18n.t('ui:error.generic');
}
