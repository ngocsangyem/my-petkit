import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom lacks a few browser APIs Base UI popups (dialog, sheet, menu, tooltip,
// collapsible) call while they measure, animate or position themselves. Each
// stub is the inert answer a real browser gives for an element with no layout.

class ResizeObserverStub {
  observe(): void {
    // No layout in jsdom: nothing ever resizes.
  }
  unobserve(): void {
    // Nothing observed.
  }
  disconnect(): void {
    // Nothing observed.
  }
}

if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ResizeObserverStub,
  });
}

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    // A desktop-sized window that never changes: no media query flips during a test.
    // Only the current listener API: the deprecated addListener/removeListener are left out.
    value: (query: string): Omit<MediaQueryList, 'addListener' | 'removeListener'> => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (!('PointerEvent' in globalThis)) {
  class PointerEventStub extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly width: number;
    readonly height: number;
    readonly pressure: number;
    readonly isPrimary: boolean;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
      this.width = init.width ?? 1;
      this.height = init.height ?? 1;
      this.pressure = init.pressure ?? 0;
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  Object.defineProperty(globalThis, 'PointerEvent', {
    configurable: true,
    writable: true,
    value: PointerEventStub,
  });
}

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => undefined;
}

if (typeof Element.prototype.getAnimations !== 'function') {
  // No running animations: Base UI unmounts a closed popup straight away.
  Element.prototype.getAnimations = () => [];
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
