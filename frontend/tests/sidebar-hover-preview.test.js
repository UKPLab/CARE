import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Window } from "happy-dom";

const defaultStubs = {};

const window = new Window();
Object.assign(globalThis, { window, document: window.document });
window.innerWidth = 700;
window.innerHeight = 240;

const source = readFileSync(
  new URL("../src/components/dashboard/navigation/Sidebar.vue", import.meta.url),
  "utf8"
);
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const importPattern = /^import\s+([^'"]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm;
const names = [...script.matchAll(importPattern)].flatMap(([, clause]) =>
  clause.replace(/[{}]/g, "").split(",").map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean)
);
const Sidebar = new Function(
  ...names,
  script.replace(importPattern, "").replace("export default", "return")
)(...names.map(name => defaultStubs[name] ?? {}));

test("repositions the flyout when its anchor or content size changes", () => {
  const observed = [];
  let resizeCallback;
  const previousResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback) {
      resizeCallback = callback;
    }

    observe(target) {
      observed.push(target);
    }

    disconnect() {}
  };

  const anchor = {
    isConnected: true,
    getBoundingClientRect: () => ({ right: 180, top: 190 }),
  };
  const preview = {
    getBoundingClientRect: () => ({ width: 220, height: 1000 }),
  };
  const instance = {
    hoveredGroup: "Study",
    previewAnchor: anchor,
    previewResizeObserver: null,
    previewStyle: {},
    $refs: { sidebarPreview: { $el: preview } },
    getFlyoutStyle: Sidebar.methods.getFlyoutStyle,
    updatePreviewPosition() {
      Sidebar.methods.updatePreviewPosition.call(this);
    },
  };

  try {
    Sidebar.methods.observePreviewPosition.call(instance);
    assert.deepEqual(observed, [anchor, preview]);
    resizeCallback();
    assert.equal(instance.previewStyle.top, "8px");
    assert.equal(instance.previewStyle.maxHeight, "224px");
  } finally {
    if (previousResizeObserver === undefined) {
      delete globalThis.ResizeObserver;
    } else {
      globalThis.ResizeObserver = previousResizeObserver;
    }
  }
});
