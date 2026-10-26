/**
 * Styled popup for every native single <select> in the app.
 *
 * The browser draws the <select> popup itself (in Firefox the highlight only covers part of
 * the row and nothing can be styled). Instead of rewriting every <select> in the code base,
 * this plugin keeps the native element (v-model, @change, disabled, forms all keep working)
 * and only replaces the popup:
 *
 * - mouse press / Space / Alt+ArrowDown / F4 on the select open a custom list under it
 * - focus stays on the <select>, so Bootstrap modal focus traps are not involved
 * - picking an item sets `select.value` and fires `input` + `change`, which is what v-model
 *   and @change listen to
 *
 * Skipped: `multiple`, `size > 1`, disabled selects, and anything with `data-native-select`.
 * Selects rendered by FormSelect / FilterDropdown are already custom buttons and not affected.
 *
 * Styles live in assets/styles/global.css (`.care-native-menu`).
 */

let menu = null;          // the open <ul>
let current = null;       // the <select> it belongs to
let items = [];           // [{ el, option }]
let activeIndex = -1;
let typeahead = "";
let typeaheadTimer = null;

function isEnhanced(select) {
  return select instanceof HTMLSelectElement
    && !select.multiple
    && !(select.size > 1)
    && !select.disabled
    && !select.closest("fieldset:disabled")
    && !select.hasAttribute("data-native-select");
}

function buildItem(option, index) {
  const li = document.createElement("li");
  li.className = "care-native-menu__option";
  if (option.className) li.className += ` ${option.className}`;
  li.setAttribute("role", "option");
  li.id = `care-native-opt-${index}`;
  const label = document.createElement("span");
  label.className = "care-native-menu__label";
  label.textContent = option.label || option.textContent;
  li.appendChild(label);
  if (option.selected) {
    li.classList.add("is-selected");
    li.setAttribute("aria-selected", "true");
    const check = document.createElement("i");
    check.className = "bi bi-check2 care-native-menu__check";
    check.setAttribute("aria-hidden", "true");
    li.appendChild(check);
  } else {
    li.setAttribute("aria-selected", "false");
  }
  if (option.disabled) {
    li.classList.add("is-disabled");
    li.setAttribute("aria-disabled", "true");
  }
  return li;
}

function setActive(index, scroll = true) {
  if (activeIndex >= 0 && items[activeIndex]) items[activeIndex].el.classList.remove("is-active");
  activeIndex = index;
  const item = items[index];
  if (!item) return;
  item.el.classList.add("is-active");
  current?.setAttribute("aria-activedescendant", item.el.id);
  if (scroll) item.el.scrollIntoView({block: "nearest"});
}

function position() {
  if (!menu || !current) return;
  if (!current.isConnected) {
    close();
    return;
  }
  const rect = current.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  const wanted = Math.min(320, menu.scrollHeight + 2);
  const openUp = spaceBelow < Math.min(wanted, 200) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(120, Math.min(320, openUp ? spaceAbove : spaceBelow));
  const width = Math.max(rect.width, 160);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  Object.assign(menu.style, {
    left: `${Math.round(left)}px`,
    minWidth: `${Math.round(width)}px`,
    maxWidth: `${Math.round(Math.max(width, Math.min(480, window.innerWidth - 16)))}px`,
    maxHeight: `${Math.round(maxHeight)}px`,
    top: openUp ? "" : `${Math.round(rect.bottom + 4)}px`,
    bottom: openUp ? `${Math.round(window.innerHeight - rect.top + 4)}px` : "",
  });
}

function pick(index) {
  const item = items[index];
  if (!item || item.option.disabled || !current) return;
  const select = current;
  close();
  if (select.selectedIndex !== item.option.index) {
    select.selectedIndex = item.option.index;
    select.dispatchEvent(new Event("input", {bubbles: true}));
    select.dispatchEvent(new Event("change", {bubbles: true}));
  }
  select.focus({preventScroll: true});
}

function move(delta) {
  const count = items.length;
  if (!count) return;
  let index = activeIndex;
  for (let step = 0; step < count; step++) {
    index = (index + delta + count) % count;
    if (!items[index].option.disabled) break;
  }
  setActive(index);
}

function edge(start) {
  const enabled = items.map((it, i) => (it.option.disabled ? -1 : i)).filter((i) => i >= 0);
  if (enabled.length) setActive(start ? enabled[0] : enabled[enabled.length - 1]);
}

function typeToFind(char) {
  clearTimeout(typeaheadTimer);
  typeahead += char.toLowerCase();
  typeaheadTimer = setTimeout(() => { typeahead = ""; }, 600);
  const count = items.length;
  const start = typeahead.length === 1 ? activeIndex + 1 : Math.max(activeIndex, 0);
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    const {option} = items[index];
    if (!option.disabled && (option.label || option.textContent).trim().toLowerCase().startsWith(typeahead)) {
      setActive(index);
      return;
    }
  }
}

function open(select) {
  close();
  current = select;
  menu = document.createElement("ul");
  menu.className = "care-native-menu";
  menu.setAttribute("role", "listbox");
  menu.id = "care-native-menu";
  items = [];

  let index = 0;
  for (const child of Array.from(select.children)) {
    if (child.tagName === "OPTGROUP") {
      const header = document.createElement("li");
      header.className = "care-native-menu__group";
      header.setAttribute("role", "presentation");
      header.textContent = child.label;
      menu.appendChild(header);
      for (const option of Array.from(child.children)) {
        if (option.tagName !== "OPTION" || option.hidden) continue;
        const el = buildItem(option, index++);
        el.classList.add("is-grouped");
        menu.appendChild(el);
        items.push({el, option});
      }
    } else if (child.tagName === "OPTION" && !child.hidden) {
      const el = buildItem(child, index++);
      menu.appendChild(el);
      items.push({el, option: child});
    }
  }

  // Keep focus on the <select>; keep outside-click handlers of surrounding dropdowns quiet
  menu.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  menu.addEventListener("pointerdown", (event) => event.stopPropagation());
  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    const li = event.target.closest(".care-native-menu__option");
    const found = items.findIndex((it) => it.el === li);
    if (found >= 0) pick(found);
  });
  menu.addEventListener("mousemove", (event) => {
    const li = event.target.closest(".care-native-menu__option");
    const found = items.findIndex((it) => it.el === li);
    if (found >= 0 && found !== activeIndex && !items[found].option.disabled) setActive(found, false);
  });

  document.body.appendChild(menu);
  select.classList.add("care-native-open");
  select.setAttribute("aria-expanded", "true");
  select.setAttribute("aria-controls", menu.id);

  const selected = items.findIndex((it) => it.option.selected && !it.option.disabled);
  position();
  setActive(selected >= 0 ? selected : items.findIndex((it) => !it.option.disabled));
  requestAnimationFrame(() => menu?.classList.add("is-open"));
}

function close() {
  if (current) {
    current.classList.remove("care-native-open");
    current.setAttribute("aria-expanded", "false");
    current.removeAttribute("aria-activedescendant");
    current.removeAttribute("aria-controls");
  }
  menu?.remove();
  menu = null;
  current = null;
  items = [];
  activeIndex = -1;
  typeahead = "";
}

function onMousedown(event) {
  if (event.button !== 0) return;
  const select = event.target instanceof Element ? event.target.closest("select") : null;
  if (select && isEnhanced(select)) {
    // Stops the browser popup from opening
    event.preventDefault();
    select.focus({preventScroll: true});
    if (current === select) {
      close();
    } else {
      open(select);
    }
    return;
  }
  if (menu && !menu.contains(event.target)) close();
}

function onKeydown(event) {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) return;

  if (current === select && menu) {
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); move(1); return;
      case "ArrowUp": event.preventDefault(); move(-1); return;
      case "Home": case "PageUp": event.preventDefault(); edge(true); return;
      case "End": case "PageDown": event.preventDefault(); edge(false); return;
      case "Enter": case " ": event.preventDefault(); pick(activeIndex); return;
      case "Escape":
        event.preventDefault();
        event.stopPropagation(); // do not close a surrounding modal
        close();
        return;
      case "Tab": close(); return;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          typeToFind(event.key);
        }
        return;
    }
  }

  if (!isEnhanced(select)) return;
  const opensPopup = event.key === " " || event.key === "F4"
    || (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp"));
  if (opensPopup) {
    event.preventDefault();
    open(select);
  }
}

function onFocusout(event) {
  if (current && event.target === current) close();
}

function onViewportChange(event) {
  if (!menu) return;
  if (event?.type === "scroll" && menu.contains(event.target)) return;
  position();
}

export default {
  install() {
    if (typeof document === "undefined") return;
    document.addEventListener("mousedown", onMousedown, true);
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("focusout", onFocusout, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
  },
};
