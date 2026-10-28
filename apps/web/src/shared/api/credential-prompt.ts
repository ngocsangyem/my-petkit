// The API layer asks for a password without knowing what the dialog looks
// like: `src/auth` registers the handler, and the client awaits it.

export type CredentialKind = 'step-up';
type Handler = (kind: CredentialKind) => Promise<boolean>;

let handler: Handler | null = null;
const signedOutListeners = new Set<() => void>();

/** Installed once by the auth layer; resolves true when the user confirmed. */
export function setCredentialHandler(next: Handler | null): void {
  handler = next;
}

export function promptForCredential(kind: CredentialKind): Promise<boolean> {
  return handler ? handler(kind) : Promise.resolve(false);
}

/** Called when the server answers 401 to an authenticated request. */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

export function notifySignedOut(): void {
  signedOutListeners.forEach(listener => {
    listener();
  });
}
