class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];

  disconnect() {
    return;
  }
  observe(_target: Element) {
    void _target;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve(_target: Element) {
    void _target;
  }
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  configurable: true,
  value: MockIntersectionObserver,
});

// jsdom implements neither ResizeObserver nor matchMedia; the timeline and
// theme toggle use both on mount.
class MockResizeObserver implements ResizeObserver {
  disconnect() {
    return;
  }
  observe(_target: Element) {
    void _target;
  }
  unobserve(_target: Element) {
    void _target;
  }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: MockResizeObserver,
});

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
