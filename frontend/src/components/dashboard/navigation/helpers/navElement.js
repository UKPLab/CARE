const DEFAULT_DASHBOARD_SETTING = "dashboard.navigation.component.default";

export function resolveNavigationElement(navElements, catchAll, settings) {
  if (!Array.isArray(navElements)) {
    return null;
  }

  if (typeof catchAll === "string" && catchAll.trim()) {
    const explicitElement = navElements.find(
      element => element && typeof element.path === "string" && element.path.toLowerCase() === catchAll.toLowerCase()
    );
    if (explicitElement) {
      return explicitElement;
    }
  }

  const defaultName = settings?.[DEFAULT_DASHBOARD_SETTING];
  if (typeof defaultName !== "string" || !defaultName.trim()) {
    return null;
  }

  return navElements.find(
    element => element && typeof element.name === "string" && element.name.toLowerCase() === defaultName.trim().toLowerCase()
  ) || null;
}

export function resolveNavigationGroup(groupedElements, element) {
  if (!Array.isArray(groupedElements) || !element) {
    return null;
  }

  return groupedElements.find(group =>
    Array.isArray(group.elements) && group.elements.some(item => String(item.id) === String(element.id))
  )?.key || null;
}
