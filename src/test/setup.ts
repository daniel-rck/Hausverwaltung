// Shared test setup, loaded through `setupFiles` in vitest.config.ts.
// BroadcastChannel needs no polyfill: Node's built-in one delivers between
// instances, so notifyMutation → useLiveQuery works as in the browser.
// oxlint-disable-next-line import/no-unassigned-import -- installs indexedDB, IDBKeyRange & co. as globals
import "fake-indexeddb/auto";
// oxlint-disable-next-line import/no-unassigned-import -- registers the jest-dom matchers (and their types) on vitest's expect
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only unmounts after each test by itself when `afterEach` is
// a global (vitest's `globals: true`); without this, trees leak between tests.
afterEach(() => {
  cleanup();
});

// jsdom has no matchMedia, which the theme and install-prompt hooks call.
// Every query reports "no match"; override per test with
// `vi.spyOn(window, "matchMedia").mockReturnValue(…)`.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}
