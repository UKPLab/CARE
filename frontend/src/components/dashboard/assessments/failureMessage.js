/**
 * Text for a failed assessment request that is always understandable.
 *
 * The backend answers with an i18n key and parameters (`{success: false, key, params, message}`). The text is only
 * built from them when the frontend knows the key AND every `{placeholder}` of its message has a value; otherwise
 * (a backend that is older or newer than the frontend: unknown key, other parameter names) the backend's own English
 * `message` is shown, and when even that is unusable a generic sentence. This keeps "Unknown error" and sentences with
 * empty gaps ("Cannot delete '' (version )") from reaching the user.
 *
 * No `@/` imports, so the module also runs in plain Node tests.
 *
 * @author Eyad Mohamed
 */

const PLACEHOLDER = /\{(\w+)\}/g;

/** @returns {string|undefined} the raw (uncompiled) message of a key in the active locale, if it is plain text */
function rawMessage(vm, key) {
  try {
    const messages = vm.$i18n.getLocaleMessage(vm.$i18n.locale);
    const raw = key.split(".").reduce((node, part) => (node === null || typeof node !== "object" ? undefined : node[part]), messages);
    return typeof raw === "string" ? raw : undefined;
  } catch (_error) {
    return undefined;
  }
}

/**
 * @param {Error & {response?: Object}} error - AssessmentRequestError or any error
 * @param {Object} vm - component instance (uses `$te`, `$t`, `$i18n`)
 * @returns {string}
 */
export function failureText(error, vm) {
  const response = error?.response ?? {};
  const params = response.params ?? {};
  if (response.key && vm.$te(response.key)) {
    const raw = rawMessage(vm, response.key);
    const names = raw ? [...raw.matchAll(PLACEHOLDER)].map((match) => match[1]) : [];
    const missing = names.filter((name) => params[name] === undefined || params[name] === null || params[name] === "");
    if (missing.length === 0) {
      return vm.$t(response.key, params);
    }
  }
  const text = typeof response.message === "string" ? response.message.trim() : "";
  const looksLikeKey = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(text);
  if (text && !looksLikeKey && !/\{\w+\}/.test(text)) {
    return text;
  }
  const plain = typeof error?.message === "string" && !/^[\w.]+$/.test(error.message) ? error.message : "";
  return plain || vm.$t("assessmentManagement.messages.requestFailed");
}
