// Where the API lives, relative to wherever this page was served from.
//
// The app never assumes it sits at `/`: under Home Assistant Ingress the whole
// server is mounted at `/api/hassio_ingress/<token>/`, and during the switch-over
// the app itself is at `<mount>/app/`. Everything is resolved from the page's own
// path, the same rule the old panel followed (`BASE` in core.js).

const APP_SEGMENT = 'app/';

/** The server's mount point, with a trailing slash: `/`, or an Ingress prefix. */
export function serverBase(pathname: string = window.location.pathname): string {
  const dir = pathname.endsWith('/') ? pathname : pathname.replace(/[^/]*$/, '');
  return dir.endsWith('/' + APP_SEGMENT) ? dir.slice(0, -APP_SEGMENT.length) : dir;
}

/** An absolute-path URL for a server-relative path such as `api/devices`. */
export function serverUrl(relative: string, pathname?: string): string {
  return serverBase(pathname) + relative.replace(/^\/+/, '');
}

/** The WebSocket URL of a server-relative path, on this page's host and scheme. */
export function socketUrl(relative: string, location: Location = window.location): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}${serverUrl(relative, location.pathname)}`;
}

/** URL of a file under the media root, from the relative path the API returns. */
export function mediaUrl(relative: string, thumb = false): string {
  // Folder names can hold `#` and spaces: encode each segment, keep the slashes.
  const encoded = relative.split('/').map(encodeURIComponent).join('/');
  return serverUrl((thumb ? 'api/media/thumb/' : 'api/media/') + encoded);
}
