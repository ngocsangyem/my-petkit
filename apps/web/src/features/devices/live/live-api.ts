import { useQuery } from '@tanstack/react-query';
import type { components } from '@/api/schema';
import { serverUrl } from '@/shared/api/base-path';
import { api, unwrap } from '@/shared/api/client';

export type LiveInfo = components['schemas']['LiveInfo'];
export type LiveMode = LiveInfo['modes'][number];
export type LiveReason = NonNullable<LiveInfo['reason']>;

// Its own key, outside the 'devices' prefix: a schedule save invalidates that
// prefix, and nothing about a save changes what can be watched.
export const liveKeys = {
  info: (id: number) => ['live', id] as const,
};

/** `GET /api/devices/{id}/live`. Cheap: the server only reads its own state, it never dials the camera. */
export function fetchLiveInfo(id: number): Promise<LiveInfo> {
  return unwrap(api.GET('/api/devices/{id}/live', { params: { path: { id } } }));
}

export function useLiveInfo(id: number) {
  return useQuery({
    queryKey: liveKeys.info(id),
    queryFn: () => fetchLiveInfo(id),
    // The HLS link in it expires after five minutes; every play fetches a fresh one anyway.
    refetchOnWindowFocus: false,
  });
}

/** The answer SDP for an offer. Throws ApiError (409 `webrtc_unavailable` when WebRTC is not set up). */
export async function postWebrtcOffer(id: number, sdp: string): Promise<string> {
  const answer = await unwrap(
    api.POST('/api/live/{id}/webrtc', { params: { path: { id } }, body: { type: 'offer', sdp } }),
  );
  return answer.sdp;
}

/** The server's root-absolute signed HLS link, put under this page's mount point (Ingress). */
export function hlsPlaylistUrl(rootAbsolute: string): string {
  return serverUrl(rootAbsolute);
}
