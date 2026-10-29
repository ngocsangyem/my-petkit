// `navigator.clipboard` exists only in a secure context, and the app is often
// plain HTTP on the LAN, so the textarea + execCommand path still has to work.
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  if (window.isSecureContext && 'clipboard' in navigator) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'visually-hidden';
  document.body.appendChild(area);
  area.select();
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only path on plain HTTP
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
