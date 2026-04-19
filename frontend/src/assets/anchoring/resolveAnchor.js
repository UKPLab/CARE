

export function resolveAnchor(anchor) {
  if (!anchor.range) {
    return null;
  }
  try {
    return anchor.range.toRange();
  } catch (_error) {
    return null;
  }
}