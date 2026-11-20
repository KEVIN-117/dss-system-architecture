/**
 * jsdom has no ResizeObserver. Radix form controls (the checkbox inside a <form>) measure their bubble
 * input with it, so component tests need a no-op implementation.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {
      // jsdom does no layout: nothing to observe.
    }

    unobserve(): void {
      // See observe().
    }

    disconnect(): void {
      // See observe().
    }
  };
}
