import { useEffect, type RefObject } from 'react';

const HLS_TYPE = 'application/vnd.apple.mpegurl';

function isPlaylist(url: string): boolean {
  return /\.m3u8$/i.test(new URL(url, window.location.href).pathname);
}

function playQuietly(video: HTMLVideoElement): void {
  try {
    // Autoplay can be refused (and jsdom has no media stack); a refusal leaves the poster up.
    void video.play().catch(() => undefined);
  } catch {
    // Same as above, for engines that throw instead of rejecting.
  }
}

interface Attached {
  detach: () => void;
}

/**
 * Point `video` at `url`. An HLS playlist plays natively where the browser can (Safari, iOS) and
 * through hls.js elsewhere; anything else (mp4, or the `.ts` kept when ffmpeg could not remux) is
 * handed to the element as-is, as the legacy panel did.
 */
async function attach(video: HTMLVideoElement, url: string): Promise<Attached> {
  if (!isPlaylist(url) || video.canPlayType(HLS_TYPE)) {
    video.src = url;
    return {
      detach: () => {
        video.removeAttribute('src');
      },
    };
  }
  const { default: Hls } = await import('hls.js');
  if (!Hls.isSupported()) {
    video.src = url;
    return {
      detach: () => {
        video.removeAttribute('src');
      },
    };
  }
  const hls = new Hls();
  hls.loadSource(url);
  hls.attachMedia(video);
  return {
    detach: () => {
      hls.destroy();
    },
  };
}

/**
 * Load and play `url` in `ref` only while the element is on screen; pause when it scrolls away,
 * so a long day of events never fetches every clip at once. Without IntersectionObserver the
 * video simply loads and plays.
 */
export function useLazyVideo(
  ref: RefObject<HTMLVideoElement | null>,
  url: string | null,
  autoplay: boolean,
): void {
  useEffect(() => {
    const video = ref.current;
    if (!video || !url) return;
    let cancelled = false;
    let attached: Attached | null = null;
    let loading = false;

    const start = () => {
      if (attached || loading) {
        if (autoplay) playQuietly(video);
        return;
      }
      loading = true;
      attach(video, url)
        .then(a => {
          if (cancelled) {
            a.detach();
            return;
          }
          attached = a;
          if (autoplay) playQuietly(video);
        })
        .catch(() => {
          // hls.js failed to load: fall back to the plain URL, which Safari-class engines play.
          if (!cancelled) video.src = url;
        });
    };

    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) start();
            else video.pause();
          }
        },
        { rootMargin: '100px' },
      );
      observer.observe(video);
    } else {
      start();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      video.pause();
      attached?.detach();
    };
  }, [ref, url, autoplay]);
}
