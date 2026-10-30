// Pins the page's clock to the fixtures' moment, so "today", the now line and
// every "12 s ago" read the same as the artboards. Time still moves forward from
// there (timers and relative stamps keep ticking); only the starting point moves.

/** Replace `Date` so `new Date()` and `Date.now()` start at `nowSeconds`. */
export function freezeClock(nowSeconds: number): void {
  const RealDate = Date;
  const offset = nowSeconds * 1000 - RealDate.now();
  const now = () => RealDate.now() + offset;

  class PreviewDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(now());
      // The arguments are forwarded untouched: whatever the caller passed, the
      // real constructor validates it exactly as it would have without the stub.
      else super(...(args as [number]));
    }

    static override now(): number {
      return now();
    }
  }

  globalThis.Date = PreviewDate as DateConstructor;
}
