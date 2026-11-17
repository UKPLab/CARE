export const SIDEBAR_FAVORITES_SETTING = "dashboard.navigation.favorites";

export function parseFavoriteIds(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  let ids;
  try {
    ids = JSON.parse(value);
  } catch (error) {
    console.error("Could not parse saved sidebar favorites.", error);
    return [];
  }

  if (!Array.isArray(ids)) {
    console.error("Saved sidebar favorites must be a JSON array.");
    return [];
  }

  return [...new Set(ids
    .filter(id => (typeof id === "string" && id.trim()) || (typeof id === "number" && Number.isFinite(id)))
    .map(String))];
}

export function toggleFavoriteId(favoriteIds, id) {
  if (id === undefined || id === null || id === "") {
    return favoriteIds;
  }

  const normalizedId = String(id);
  return favoriteIds.includes(normalizedId)
    ? favoriteIds.filter(favoriteId => favoriteId !== normalizedId)
    : [...favoriteIds, normalizedId];
}

export function getFavoriteElements(elements, favoriteIds) {
  const ids = new Set(favoriteIds);
  return elements.filter(element => ids.has(String(element.id)));
}
