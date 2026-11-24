/**
 * In-document sprite for Bootstrap icons.
 *
 * Icons used to point `<use>` at the external file `bootstrap-icons.svg#name`. That file holds
 * ~2000 symbols (1.1 MB), and the browser parses it as a separate SVG document before the first
 * icon can paint: 4.1 s of main-thread time in a 20x-throttled trace, shown as "System".
 *
 * Now the sprite comes in as a plain string, and the first time an icon name is used only that
 * one `<symbol>` is cut out of the string and appended to a hidden `<svg>` in the page. `<use>`
 * then points at `#care-bi-<name>` in the same document. The markup stays `<svg><use>`, so every
 * style aimed at icon `svg` elements keeps working.
 */
import spriteText from "bootstrap-icons/bootstrap-icons.svg?raw";
import spriteUrl from "bootstrap-icons/bootstrap-icons.svg";

const PREFIX = "care-bi-";
const SYMBOL_END = "</symbol>";
const known = new Map(); // name -> href
let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  container.setAttribute("aria-hidden", "true");
  container.setAttribute("focusable", "false");
  container.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  container.id = "care-icon-sprite";
  document.body.prepend(container);
  return container;
}

/**
 * Href for `<use>` that shows the icon `name`, adding its symbol to the page on first use.
 * Unknown names fall back to the external sprite (same result as before for typos: nothing).
 * @param {string} name Bootstrap icon name, e.g. "trash"
 * @returns {string}
 */
export function iconHref(name) {
  const cached = known.get(name);
  if (cached) return cached;
  let href = `${spriteUrl}#${name}`;
  if (typeof document !== "undefined" && document.body) {
    const at = spriteText.indexOf(`id="${name}">`);
    if (at !== -1) {
      const start = spriteText.lastIndexOf("<symbol", at);
      const end = spriteText.indexOf(SYMBOL_END, at);
      if (start !== -1 && end !== -1) {
        const markup = spriteText
          .slice(start, end + SYMBOL_END.length)
          .replace(`id="${name}">`, `id="${PREFIX}${name}">`);
        ensureContainer().insertAdjacentHTML("beforeend", markup);
        href = `#${PREFIX}${name}`;
      }
    }
  }
  known.set(name, href);
  return href;
}
