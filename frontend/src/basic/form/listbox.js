/**
 * Shared logic for the custom popups: the single-select listboxes (FormSelect, FilterDropdown,
 * the native <select> enhancer), the date picker popup and BasicPopupMenu.
 *
 * Framework-free so the plain-JS enhancer plugin can use it too. Option lists are arrays of
 * `{ label, disabled }` (extra fields are ignored).
 */

let lastId = 0;

/**
 * Id unique within the page, for aria-controls / aria-activedescendant links.
 * @returns {number}
 */
export function uniqueId() {
  lastId += 1;
  return lastId;
}

/**
 * Where to teleport a popup. Inside a modal it must go into the .modal element itself, otherwise
 * Bootstrap's focus trap pulls focus back to the modal's close button.
 * @param {Element} el The component's root element.
 * @returns {Element|string}
 */
export function popupTeleportTarget(el) {
  return el?.closest?.(".modal") || "body";
}

/**
 * Position a fixed popup next to its anchor, inside the viewport. It opens upward when its content
 * does not fit below (at most `minSpaceBelow` is asked for) and there is more room above.
 * @param {DOMRect} rect Anchor's bounding rect.
 * @param {HTMLElement|null} popupEl Rendered popup, used for its content height; null before the first render.
 * @param {object} [opts]
 * @param {number} [opts.width] Popup width; defaults to the anchor width.
 * @param {number} [opts.gap] Distance between anchor and popup.
 * @param {number} [opts.margin] Distance kept from the viewport edges.
 * @param {number} [opts.minSpaceBelow] Space below that is always enough (Infinity = whole popup must fit).
 * @param {number} [opts.maxHeight] Upper limit for the popup height.
 * @returns {{openUp: boolean, style: {left: string, width: string, maxHeight: string, top: string, bottom: string}}}
 */
export function placePopup(rect, popupEl, {
  width = rect.width,
  gap = 4,
  margin = 12,
  minSpaceBelow = 200,
  maxHeight = 320,
} = {}) {
  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  // +2 for the 1px border, which scrollHeight leaves out
  const wanted = popupEl ? popupEl.scrollHeight + 2 : minSpaceBelow;
  const openUp = spaceBelow < Math.min(wanted, minSpaceBelow) && spaceAbove > spaceBelow;

  // A popup wider than its anchor grows to the right; near the viewport edge it is pinned to the
  // anchor's right corner instead so it stays on screen.
  let left = rect.left;
  if (width > rect.width) {
    if (left + width > window.innerWidth - margin) {
      left = rect.right - width;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - width));
  }

  const px = (value) => `${Math.round(value)}px`;
  return {
    openUp,
    style: {
      left: px(left),
      width: px(width),
      maxHeight: px(Math.max(120, Math.min(maxHeight, openUp ? spaceAbove : spaceBelow))),
      top: openUp ? "" : px(rect.bottom + gap),
      bottom: openUp ? px(window.innerHeight - rect.top + gap) : "",
    },
  };
}

/**
 * Close-on-outside-press and follow-the-anchor listeners for an open popup.
 * @param {object} handlers
 * @param {function(EventTarget): boolean} handlers.isInside True if a press on this target belongs to the popup or its trigger.
 * @param {function(PointerEvent): void} handlers.onOutside Called for a press anywhere else.
 * @param {function(): void} handlers.onReposition Called on resize and on any scroll.
 * @returns {function(): void} Removes the listeners.
 */
export function bindPopupListeners({ isInside, onOutside, onReposition }) {
  const onPointerdown = (event) => {
    if (!isInside(event.target)) {
      onOutside(event);
    }
  };
  document.addEventListener("pointerdown", onPointerdown, true);
  window.addEventListener("resize", onReposition);
  window.addEventListener("scroll", onReposition, true);
  return () => {
    document.removeEventListener("pointerdown", onPointerdown, true);
    window.removeEventListener("resize", onReposition);
    window.removeEventListener("scroll", onReposition, true);
  };
}

/**
 * Whether a focusout left both the open menu and the button that opened it.
 * A move between those two stays open. Focus leaving the page (no next target) closes it.
 * @param {FocusEvent} event
 * @param {Element|null|undefined} menu
 * @param {Element|null|undefined} trigger
 * @returns {boolean}
 */
export function focusLeftMenu(event, menu, trigger) {
  const next = event.relatedTarget || document.activeElement;
  const stays = (node) => node && (next === node || node.contains(next));
  return !(stays(menu) || stays(trigger));
}

/**
 * Next enabled option in `step` direction, wrapping around.
 * @param {Array<{disabled?: boolean}>} items
 * @param {number} from Start index (not itself considered); -1 / items.length to start at an edge.
 * @param {number} step 1 or -1.
 * @returns {number} Index, or -1 if every option is disabled.
 */
export function nextEnabledIndex(items, from, step) {
  const count = items.length;
  let index = from;
  for (let i = 0; i < count; i++) {
    index = (index + step + count) % count;
    if (!items[index].disabled) {
      return index;
    }
  }
  return -1;
}

/**
 * Type-to-find like a native select: letters typed within `timeoutMs` of each other are matched
 * together against the start of the option labels.
 * @param {number} [timeoutMs]
 * @returns {function(string, Array<{label: string, disabled?: boolean}>, number): number}
 *   `(key, items, activeIndex) => index` (-1 if nothing matches); `.reset()` clears what was typed.
 */
export function createTypeahead(timeoutMs = 600) {
  let typed = "";
  let timer = null;
  const find = (key, items, activeIndex) => {
    clearTimeout(timer);
    typed += key.toLowerCase();
    timer = setTimeout(() => { typed = ""; }, timeoutMs);
    // A new search starts after the current option, a longer one may still match it
    const start = Math.max(typed.length === 1 ? activeIndex + 1 : activeIndex, 0);
    for (let i = 0; i < items.length; i++) {
      const index = (start + i) % items.length;
      const item = items[index];
      if (!item.disabled && String(item.label).trim().toLowerCase().startsWith(typed)) {
        return index;
      }
    }
    return -1;
  };
  find.reset = () => {
    clearTimeout(timer);
    typed = "";
  };
  return find;
}

/**
 * Keyboard handling of an open listbox: arrows / Home / End / PageUp / PageDown move over enabled
 * options, Enter / Space pick, Escape closes (and returns focus), Tab closes, letters type-to-find.
 * @param {KeyboardEvent} event
 * @param {object} ctx
 * @param {Array<{label: string, disabled?: boolean}>} ctx.items
 * @param {number} ctx.activeIndex
 * @param {function(number): void} ctx.setActive Highlight (and scroll to) this index.
 * @param {function(number): void} ctx.pick Choose this (enabled) index.
 * @param {function(boolean): void} ctx.close Close; the argument says whether focus goes back to the trigger.
 * @param {function} [ctx.typeahead] From createTypeahead; omit to disable type-to-find.
 * @returns {void}
 */
export function handleListboxKeydown(event, { items, activeIndex, setActive, pick, close, typeahead }) {
  const moveTo = (index) => {
    event.preventDefault();
    if (index >= 0) {
      setActive(index);
    }
  };
  switch (event.key) {
    case "ArrowDown":
      moveTo(nextEnabledIndex(items, activeIndex, 1));
      break;
    case "ArrowUp":
      moveTo(nextEnabledIndex(items, activeIndex, -1));
      break;
    case "Home":
    case "PageUp":
      moveTo(nextEnabledIndex(items, -1, 1));
      break;
    case "End":
    case "PageDown":
      moveTo(nextEnabledIndex(items, items.length, -1));
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      if (items[activeIndex] && !items[activeIndex].disabled) {
        pick(activeIndex);
      }
      break;
    case "Escape":
      event.preventDefault();
      event.stopPropagation(); // do not close a surrounding modal
      close(true);
      break;
    case "Tab":
      close(false);
      break;
    default:
      if (typeahead && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        moveTo(typeahead(event.key, items, activeIndex));
      }
  }
}
