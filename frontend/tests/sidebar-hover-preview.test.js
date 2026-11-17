import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { sidebarHoverPreviewMethods } from "../src/components/dashboard/navigation/helpers/sidebarHoverPreview.js";

const window = new Window();
Object.assign(globalThis, { window, document: window.document });
window.innerWidth = 700;
window.innerHeight = 240;

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
    updatePreviewPosition() {
      sidebarHoverPreviewMethods.updatePreviewPosition.call(this);
    },
  };

  try {
    sidebarHoverPreviewMethods.observePreviewPosition.call(instance);
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
