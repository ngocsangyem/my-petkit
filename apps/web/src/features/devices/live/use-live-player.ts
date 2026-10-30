import { useQueryClient } from '@tanstack/react-query';
import { type RefObject, useEffect, useState } from 'react';
import { fetchLiveInfo, hlsPlaylistUrl, liveKeys, type LiveMode } from './live-api';
import { MODE_LABEL, reasonSentence } from './live-copy';
import { startHls } from './live-hls';
import { startMse } from './live-mse';
import type { LiveCallbacks, LiveSession } from './live-session';
import { startWebrtc } from './live-webrtc';

export type LivePhase = 'idle' | 'connecting' | 'playing' | 'failed';

export interface LivePlayer {
  mode: LiveMode | undefined;
  phase: LivePhase;
  /** Why the last attempt failed, or which mode it fell back from. */
  message: string | null;
  selectMode: (mode: LiveMode) => void;
  watch: () => void;
  stop: () => void;
}

/**
 * One live view: which mode is chosen, and the session playing it. Nothing connects until
 * `watch()`, so opening the panel never opens the device's stream. The session lives in an
 * effect keyed on the mode, so unmounting or switching modes always closes the old one.
 */
export function useLivePlayer(
  deviceId: number,
  modes: readonly LiveMode[],
  videoRef: RefObject<HTMLVideoElement | null>,
): LivePlayer {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<LiveMode | null>(null);
  const [watching, setWatching] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<LivePhase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  // The server lists modes in preference order; the first is the default.
  const mode = chosen && modes.includes(chosen) ? chosen : modes[0];
  const fallbackFor = mode ? modes[modes.indexOf(mode) + 1] : undefined;

  useEffect(() => {
    const video = videoRef.current;
    if (!watching || !mode || !video) return;
    let active = true;
    const callbacks: LiveCallbacks = {
      onPlaying: () => {
        if (active) setPhase('playing');
      },
      onFailure: failure => {
        if (!active) return;
        if (failure.fallback && fallbackFor) {
          setMessage(`${failure.message} Using ${MODE_LABEL[fallbackFor]} instead.`);
          setChosen(fallbackFor);
          return;
        }
        setMessage(failure.message);
        setPhase('failed');
        setWatching(false);
      },
    };
    // Every HLS start and refresh asks for a newly signed link (they last five minutes).
    const freshHlsUrl = async () => {
      const info = await fetchLiveInfo(deviceId);
      queryClient.setQueryData(liveKeys.info(deviceId), info);
      if (!info.available || !info.hls_url) throw new Error(reasonSentence(info.reason));
      return hlsPlaylistUrl(info.hls_url);
    };
    let session: LiveSession;
    if (mode === 'webrtc') session = startWebrtc(video, deviceId, callbacks);
    else if (mode === 'mse') session = startMse(video, deviceId, callbacks);
    else session = startHls(video, freshHlsUrl, callbacks);
    return () => {
      active = false;
      session.stop();
    };
  }, [watching, mode, fallbackFor, attempt, deviceId, videoRef, queryClient]);

  return {
    mode,
    phase,
    message,
    selectMode: next => {
      setChosen(next);
      setMessage(null);
      // A mode change while watching reconnects in the new mode; the effect closes the old one.
      if (watching && next !== mode) setPhase('connecting');
    },
    watch: () => {
      setMessage(null);
      setPhase('connecting');
      setWatching(true);
      setAttempt(n => n + 1);
    },
    stop: () => {
      setWatching(false);
      setPhase('idle');
    },
  };
}
