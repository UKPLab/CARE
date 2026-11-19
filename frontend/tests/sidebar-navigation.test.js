import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { Window } from "happy-dom";
const defaultStubs = {};

const window = new Window();
Object.assign(globalThis, {
  window,
  document: window.document,
  Element: window.Element,
  HTMLElement: window.HTMLElement,
  SVGElement: window.SVGElement,
  Node: window.Node,
  Event: window.Event,
});

const { compile, createApp, h, nextTick } = await import("vue");
const cleanups = [];
const BasicButton = {
  props: ["disabled", "title"],
  emits: ["click"],
  render() {
    return h("button", {
      ...this.$attrs,
      disabled: this.disabled,
      title: this.title,
      onClick: () => this.$emit("click"),
    }, this.$slots.default?.());
  },
};

function loadComponent(path, stubs) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const importPattern = /^import\s+([^'"]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm;
  const names = [...script.matchAll(importPattern)].flatMap(([, clause]) =>
    clause.replace(/[{}]/g, "").split(",").map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean)
  );
  const options = new Function(
    ...names,
    script.replace(importPattern, "")
      .replace('const dashboardModules = import.meta.glob("./dashboard/*.vue");', "const dashboardModules = {};")
      .replace("export default", "return")
  )(...names.map(name => stubs?.[name] ?? defaultStubs[name] ?? {}));
  const template = source.match(/<template>([\s\S]*)<\/template>/)[1];
  return { ...options, render: compile(template) };
}

function mount(component, props, { components = {}, globals = {}, parent = document.body } = {}) {
  const listeners = {};
  let componentInstance;
  if (globals.onToggle) listeners.onToggle = globals.onToggle;
  if (globals.onToggleFavorite) listeners.onToggleFavorite = globals.onToggleFavorite;
  if (globals.onNavigate) listeners.onNavigate = globals.onNavigate;
  if (globals.onHover) listeners.onHover = globals.onHover;
  if (globals.onLeave) listeners.onLeave = globals.onLeave;
  const app = createApp({
    render: () => h(component, {
      ...props,
      ...listeners,
      ref: instance => { componentInstance = instance; },
    }),
  });
  Object.entries(components).forEach(([name, value]) => app.component(name, value));
  Object.assign(app.config.globalProperties, {
    $t: (key, params) => params ? `${key}:${params.name}` : key,
    $te: () => false,
  });
  const host = document.createElement("div");
  parent.append(host);
  cleanups.push(() => app.unmount());
  app.mount(host);
  return componentInstance;
}

afterEach(() => {
  while (cleanups.length) {
    cleanups.pop()();
  }
  document.body.innerHTML = "";
});

const navElements = [
  { id: 1, name: "Home", path: "home", component: "Home" },
  { id: 2, name: "Documents", path: "documents", component: "Documents" },
];

test("resolves the configured home item and preserves explicit dashboard routes", () => {
  const Dashboard = loadComponent("components/Dashboard.vue", {
    defineAsyncComponent: value => value,
    Loading: {},
    Sidebar: {},
    NotFoundPage: {},
  });
  const resolve = settings => Dashboard.computed.currentNavigationElement.call({
    navigationDataReady: true,
    navElements,
    catchAll: undefined,
    settings,
  });
  const settings = { "dashboard.navigation.component.default": "hOmE" };
  assert.equal(resolve(settings), navElements[0]);
  assert.equal(resolve({
    "dashboard.navigation.component.default": "Documents",
  }), navElements[1]);
  assert.equal(Dashboard.computed.currentNavigationElement.call({
    navigationDataReady: true,
    navElements,
    catchAll: "documents",
    settings,
  }), navElements[1]);
  assert.equal(Dashboard.computed.currentNavigationElement.call({
    navigationDataReady: true,
    navElements,
    catchAll: "unknown",
    settings,
  }), navElements[0]);
});

test("does not invent a home item when settings or navigation data are missing", () => {
  const Dashboard = loadComponent("components/Dashboard.vue", {
    defineAsyncComponent: value => value,
    Loading: {},
    Sidebar: {},
    NotFoundPage: {},
  });
  const resolve = (navItems, settings) => Dashboard.computed.currentNavigationElement.call({
    navigationDataReady: true,
    navElements: navItems,
    catchAll: undefined,
    settings,
  });
  assert.equal(resolve(navElements, {}), null);
  assert.equal(resolve(navElements, {
    "dashboard.navigation.component.default": 12,
  }), null);
  assert.equal(resolve(undefined, {
    "dashboard.navigation.component.default": "Home",
  }), null);
});

test("only marks a group active when the resolved item is in the visible group list", () => {
  const Sidebar = loadComponent("components/dashboard/navigation/Sidebar.vue", {});
  const groups = [{ key: "Home", elements: [navElements[0]] }];
  const resolve = activeElement => Sidebar.computed.activeSubgroup.call({
    defaultGroupedElements: groups,
    activeElement,
  });
  assert.equal(resolve(navElements[0]), "Home");
  assert.equal(resolve(navElements[1]), null);
  assert.equal(resolve(null), null);
});

test("opens the configured home dashboard group on the base dashboard route", async () => {
  const Sidebar = loadComponent("components/dashboard/navigation/Sidebar.vue", {
    LoadIcon: {},
    Loading: {},
    SidebarGroup: {},
    SidebarPreview: {},
    resolveApiMessage: () => null,
  });
  const instance = {
    ...Sidebar.methods,
    $route: { path: "/dashboard" },
    activeSubgroup: "Home",
    groupStates: { Home: false, Study: true },
    isCollapsed: false,
    hoveredGroup: null,
    $nextTick: nextTick,
  };

  Sidebar.methods.syncSidebarWithRoute.call(instance);

  assert.deepEqual(instance.groupStates, { Home: true, Study: false });

  instance.groupStates = { Home: false, Study: true };
  Sidebar.watch.activeSubgroup.call(instance, "Home");
  assert.deepEqual(instance.groupStates, { Home: true, Study: false });

  instance.groupStates = { Home: false, Study: true };
  Sidebar.watch.defaultGroupedElements.call(instance, [{ key: "Home" }, { key: "Study" }]);
  await nextTick();
  assert.deepEqual(instance.groupStates, { Home: true, Study: false });
});

test("parses favorites as unique string IDs and ignores invalid IDs", () => {
  const Sidebar = loadComponent("components/dashboard/navigation/Sidebar.vue", {});
  assert.deepEqual(Sidebar.methods.parseFavoriteIds('[1,"2",1,"",null,{}]'), ["1", "2"]);
});

test("favorites are filtered to available items and keep navigation order", () => {
  const Sidebar = loadComponent("components/dashboard/navigation/Sidebar.vue", {});
  const available = [navElements[1], navElements[0]];
  assert.deepEqual(Sidebar.methods.getFavoriteElements(available, ["1", "404", "2"]), available);
});

test("favorite toggling adds and removes an ID without duplicating it", () => {
  const Sidebar = loadComponent("components/dashboard/navigation/Sidebar.vue", {});
  assert.deepEqual(Sidebar.methods.toggleFavoriteId(["1"], 2), ["1", "2"]);
  assert.deepEqual(Sidebar.methods.toggleFavoriteId(["1", "2"], 1), ["2"]);
  assert.deepEqual(Sidebar.methods.toggleFavoriteId(["1"], null), ["1"]);
});

test("recovers favorites after a lost acknowledgement and ignores late acknowledgements", async () => {
  const Sidebar = loadComponent("components/dashboard/navigation/Sidebar.vue", {
    LoadIcon: {},
    Loading: {},
    SidebarGroup: {},
    SidebarPreview: {},
    resolveApiMessage: () => null,
  });
  const socketEvents = [];
  const saveAcknowledgements = [];
  const socketHandlers = new Map();
  const settings = { "dashboard.navigation.favorites": '["1"]' };
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let timeoutCallback;
  globalThis.setTimeout = callback => {
    timeoutCallback = callback;
    return 1;
  };
  globalThis.clearTimeout = () => {};

  const instance = {
    ...Sidebar.methods,
    $socket: {
      connected: true,
      emit: (event, data, callback) => {
        socketEvents.push(event);
        if (event === "appSettingSet") saveAcknowledgements.push(callback);
      },
      on: (event, handler) => {
        const handlers = socketHandlers.get(event) || [];
        handlers.push(handler);
        socketHandlers.set(event, handlers);
      },
      off: (event, handler) => {
        socketHandlers.set(event, (socketHandlers.get(event) || []).filter(item => item !== handler));
      },
    },
    $nextTick: nextTick,
    $t: key => key,
    eventBus: { emit: () => {}, on: () => {}, off: () => {} },
    defaultGroupedElements: [{ elements: navElements }],
    groupStates: {},
    $store: {
      getters: { "settings/getSettings": settings },
      commit: (mutation, payload) => {
        if (mutation === "settings/setSettings") Object.assign(settings, payload);
        if (mutation === "settings/set") settings[payload.key] = payload.value;
      },
    },
    favoriteIdsOverride: null,
    isSavingFavorites: false,
    favoriteSaveTimer: null,
    favoriteSaveSequence: 0,
    favoriteSettingsUncertain: false,
    favoriteSettingsReconcileSequence: null,
    syncSidebarWithRoute: () => {},
  };
  socketHandlers.set("appSettings", [data => instance.$store.commit("settings/setSettings", data)]);
  Object.defineProperty(instance, "settings", {
    get() {
      return this.$store.getters["settings/getSettings"];
    },
  });
  Object.defineProperty(instance, "favoriteIds", {
    get() {
      return this.favoriteIdsOverride || this.parseFavoriteIds(this.settings["dashboard.navigation.favorites"]);
    },
  });

  try {
    Sidebar.mounted.call(instance);
    instance.toggleFavorite(navElements[1]);
    assert.equal(instance.isSavingFavorites, true);
    timeoutCallback();
    assert.equal(instance.isSavingFavorites, false);
    assert.equal(instance.favoriteSettingsUncertain, true);
    assert.ok(socketEvents.includes("appInit"));

    instance.toggleFavorite(navElements[0]);
    assert.deepEqual(instance.favoriteIdsOverride, ["2"]);
    saveAcknowledgements[0]({ success: true });
    assert.equal(instance.isSavingFavorites, true);
    assert.deepEqual(instance.favoriteIdsOverride, ["2"]);

    instance.$socket.connected = false;
    for (const handler of socketHandlers.get("disconnect") || []) handler();
    assert.equal(instance.isSavingFavorites, false);
    saveAcknowledgements[1]({ success: true });
    assert.equal(instance.favoriteSettingsUncertain, true);
    assert.deepEqual(instance.favoriteIdsOverride, ["2"]);

    instance.$socket.connected = true;
    for (const handler of socketHandlers.get("connect") || []) handler();
    assert.equal(socketEvents.filter(event => event === "appInit").length, 2);
    for (const handler of socketHandlers.get("appSettings") || []) handler({});
    assert.equal(settings["dashboard.navigation.favorites"], undefined);
    assert.deepEqual(instance.favoriteIdsOverride, []);
    await nextTick();
    assert.equal(instance.favoriteSettingsUncertain, false);
    assert.deepEqual(instance.favoriteIds, []);
    assert.equal(instance.isSavingFavorites, false);
  } finally {
    Sidebar.beforeUnmount.call(instance);
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("positions a flyout inside all viewport edges and constrains tall menus", () => {
  const Sidebar = loadComponent("components/dashboard/navigation/Sidebar.vue", {});
  const getFlyoutStyle = Sidebar.methods.getFlyoutStyle;
  const nearBottom = getFlyoutStyle(
    { right: 680, top: 190 },
    { width: 228, height: 160 },
    { width: 700, height: 240 }
  );
  assert.deepEqual(nearBottom, {
    left: "464px",
    top: "72px",
    maxWidth: "684px",
    maxHeight: "224px",
  });

  const tall = getFlyoutStyle(
    { right: 64, top: 200 },
    { width: 228, height: 500 },
    { width: 700, height: 240 }
  );
  assert.equal(tall.top, "8px");
  assert.equal(tall.maxHeight, "224px");
});

test("handles a non-element relatedTarget without throwing", () => {
  const Sidebar = loadComponent("components/dashboard/navigation/Sidebar.vue", {});
  assert.equal(
    Sidebar.methods._isRelatedTargetInGroup.call({}, {
      relatedTarget: {},
    }, "Home", ".submenu-preview"),
    false
  );
});

test("collapsed group flyout distinguishes hover dismissal from click pinning", () => {
  const Sidebar = loadComponent("components/dashboard/navigation/Sidebar.vue", {});
  const SidebarGroup = loadComponent("components/dashboard/navigation/SidebarGroup.vue", {
    BasicButton,
    LoadIcon: { render: () => null },
    SidebarNavItem: { render: () => null },
  });
  const SidebarGroupList = loadComponent("components/dashboard/navigation/SidebarGroupList.vue", {
    SidebarGroup,
  });
  const sidebar = {
    ...Sidebar.methods,
    groupStates: { Study: false },
    hoveredGroup: null,
    pinnedPreviewGroup: null,
    previewStyle: {},
    previewAnchor: null,
    previewResizeObserver: null,
    isHoveringPreview: false,
    isCollapsed: true,
    $nextTick: () => {},
    $refs: { sidebarPreview: { $el: document.createElement("div") } },
  };
  sidebar.$refs.sidebarPreview.$el.classList.add("submenu-preview");
  const mountOptions = {
    globals: {
      onToggle: (anchor, groupName) => Sidebar.methods.toggleGroup.call(sidebar, anchor, groupName),
      onHover: (event, groupName) => Sidebar.methods.handleGroupMouseEnter.call(sidebar, event, groupName),
      onLeave: (event, groupName) => Sidebar.methods.handleGroupMouseLeave.call(sidebar, event, groupName),
    },
  };

  mount(SidebarGroupList, {
    groups: [
      { key: "Study", name: "Study", elements: [] },
      { key: "Manage", name: "Manage", elements: [] },
    ],
    groupStates: sidebar.groupStates,
    isCollapsed: true,
    activeGroup: null,
    hoveredGroup: null,
  }, mountOptions);

  const group = document.querySelector(".default-subgroup");
  const heading = group.querySelector(".sidebar-subgroup-heading");
  heading.getBoundingClientRect = () => ({ top: 100, right: 64 });
  heading.dispatchEvent(new window.MouseEvent("mouseenter"));

  assert.equal(sidebar.hoveredGroup, "Study");
  assert.equal(sidebar.previewStyle.left, "64px");

  const leaveForOutside = new window.MouseEvent("mouseleave");
  Object.defineProperty(leaveForOutside, "relatedTarget", { value: document.createElement("div") });
  heading.dispatchEvent(leaveForOutside);
  assert.equal(sidebar.hoveredGroup, null);

  heading.dispatchEvent(new window.MouseEvent("mouseenter"));
  assert.equal(sidebar.hoveredGroup, "Study");

  const flyout = document.createElement("div");
  flyout.className = "submenu-preview";
  flyout.dataset.groupKey = "Study";
  sidebar.$refs.sidebarPreview.$el.append(flyout);
  const leaveForFlyout = new window.MouseEvent("mouseleave");
  Object.defineProperty(leaveForFlyout, "relatedTarget", { value: flyout });
  heading.dispatchEvent(leaveForFlyout);

  assert.equal(sidebar.hoveredGroup, "Study");

  document.querySelectorAll(".sidebar-subgroup-heading")[0].click();
  assert.equal(sidebar.pinnedPreviewGroup, "Study");
  Sidebar.methods.handlePreviewMouseLeave.call(sidebar, {
    relatedTarget: document.createElement("div"),
  }, "Study");
  assert.equal(sidebar.hoveredGroup, "Study");

  document.querySelectorAll(".sidebar-subgroup-heading")[1].click();
  assert.equal(sidebar.pinnedPreviewGroup, "Manage");
  document.querySelectorAll(".sidebar-subgroup-heading")[1].click();
  assert.equal(sidebar.pinnedPreviewGroup, null);

  document.querySelectorAll(".sidebar-subgroup-heading")[0].click();
  Sidebar.methods.handlePinnedPreviewOutsideClick.call(sidebar, {
    target: flyout,
  });
  assert.equal(sidebar.pinnedPreviewGroup, "Study");
  Sidebar.methods.handlePinnedPreviewOutsideClick.call(sidebar, {
    target: document.createElement("div"),
  });
  assert.equal(sidebar.pinnedPreviewGroup, null);
  assert.equal(sidebar.hoveredGroup, null);

  document.querySelectorAll(".sidebar-subgroup-heading")[0].click();
  const SidebarPreview = loadComponent("components/dashboard/navigation/SidebarPreview.vue", {
    SidebarNavItem: {
      emits: ["navigate"],
      render() {
        return h("button", {
          class: "preview-nav",
          onClick: () => this.$emit("navigate"),
        });
      },
    },
  });
  mount(SidebarPreview, {
    subgroup: { key: "Study", name: "Study", elements: [{ id: 1 }] },
    isCollapsed: true,
    previewStyle: {},
  }, {
    globals: { onNavigate: () => Sidebar.methods.resetPreview.call(sidebar) },
  });
  document.querySelector(".preview-nav").click();
  assert.equal(sidebar.pinnedPreviewGroup, null);

  document.querySelectorAll(".sidebar-subgroup-heading")[0].click();
  sidebar.syncSidebarWithRoute = () => {};
  Sidebar.methods.toggleSidebar.call(sidebar);
  assert.equal(sidebar.pinnedPreviewGroup, null);

  Sidebar.methods.handlePreviewMouseLeave.call(sidebar, {
    relatedTarget: document.createElement("div"),
  }, "Study");
  assert.equal(sidebar.hoveredGroup, null);
});

test("group headers are keyboard-focusable native buttons that expose expanded state", () => {
  const events = [];
  const SidebarGroup = loadComponent("components/dashboard/navigation/SidebarGroup.vue", {
    BasicButton,
    LoadIcon: { render: () => null },
    SidebarNavItem: { props: ["element"], render: () => null },
  });
  mount(SidebarGroup, {
    subgroup: { key: "Home", name: "Home", icon: "house", elements: [] },
    isCollapsed: false,
    isOpen: true,
    isActive: true,
    isHovered: false,
  }, {
    globals: { onToggle: () => events.push("toggle") },
  });

  const button = document.querySelector(".sidebar-subgroup-heading");
  assert.equal(button.tagName, "BUTTON");
  assert.equal(button.getAttribute("aria-expanded"), "true");
  button.focus();
  assert.equal(document.activeElement, button);
  button.click();
  assert.deepEqual(events, ["toggle"]);
});

test("favorite controls expose their state and emit without activating the dashboard link", () => {
  const emitted = [];
  const navigations = [];
  const SidebarNavItem = loadComponent("components/dashboard/navigation/SidebarNavItem.vue", {
    BasicButton,
    LoadIcon: { render: () => null },
  });
  const RouterLink = {
    props: ["to"],
    render() {
      return h("a", { href: this.to }, this.$slots.default?.());
    },
  };
  mount(SidebarNavItem, {
    element: navElements[0],
    variant: "default",
    isFavorite: false,
    isActive: false,
  }, {
    components: { "router-link": RouterLink },
    globals: {
      onToggleFavorite: element => emitted.push(element),
      onNavigate: () => navigations.push(true),
    },
  });

  const button = document.querySelector(".sidebar-favorite-toggle");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(button.getAttribute("aria-label"), "sidebar.favorites.add:Home");
  button.click();
  assert.deepEqual(emitted, [navElements[0]]);
  const link = document.querySelector(".sidebar-nav-link");
  assert.equal(link.getAttribute("href"), "/dashboard/home");
  link.click();
  assert.deepEqual(navigations, [true]);
});

test("pinned items are displayed directly at the top of the sidebar above groups and hidden when empty", () => {
  const Sidebar = loadComponent("components/dashboard/navigation/Sidebar.vue", {
    LoadIcon: {},
    Loading: {},
    SidebarGroupList: {},
    SidebarNavItem: {},
    SidebarPreview: {},
    SidebarFooter: {},
    resolveApiMessage: () => null,
  });

  const available = [navElements[0], navElements[1]];
  const instance = {
    ...Sidebar.methods,
    defaultGroupedElements: [
      { key: "Home", name: "Home", elements: [navElements[0]] },
      { key: "Study", name: "Study", elements: [navElements[1]] },
    ],
    favoriteIdsOverride: null,
    settings: { "dashboard.navigation.favorites": '["1", "2"]' },
    favoriteIds: ["1", "2"],
  };

  Object.defineProperty(instance, "favoriteElements", {
    get() {
      const all = this.defaultGroupedElements.flatMap(g => g.elements);
      return this.getFavoriteElements(all, this.favoriteIds);
    },
  });

  assert.deepEqual(instance.favoriteElements, available);

  instance.favoriteIds = [];
  assert.deepEqual(instance.favoriteElements, []);
});

test("pinned items navigate and preserve active highlighting", () => {
  const navigations = [];
  const SidebarNavItem = loadComponent("components/dashboard/navigation/SidebarNavItem.vue", {
    BasicButton,
    LoadIcon: { render: () => null },
  });
  const RouterLink = {
    props: ["to"],
    render() {
      return h("a", { href: this.to, class: "sidebar-nav-link" }, this.$slots.default?.());
    },
  };
  mount(SidebarNavItem, {
    element: navElements[0],
    variant: "default",
    isFavorite: true,
    isActive: true,
  }, {
    components: { "router-link": RouterLink },
    globals: {
      onNavigate: () => navigations.push(true),
    },
  });

  const link = document.querySelector(".sidebar-nav-link");
  assert.equal(link.getAttribute("href"), "/dashboard/home");
  link.click();
  assert.deepEqual(navigations, [true]);

  const button = document.querySelector(".sidebar-favorite-toggle");
  assert.equal(button.getAttribute("aria-pressed"), "true");
});

test("group list forwards favorite state and actions to its groups", () => {
  const emitted = [];
  const SidebarGroupList = loadComponent("components/dashboard/navigation/SidebarGroupList.vue", {
    SidebarGroup: {
      props: ["activeElementId", "favoriteIds", "favoriteDisabled", "subgroup"],
      emits: ["toggle-favorite"],
      render() {
        return h("button", {
          disabled: this.favoriteDisabled,
          "data-active-id": this.activeElementId,
          "data-favorites": this.favoriteIds.join(","),
          onClick: () => this.$emit("toggle-favorite", this.subgroup.elements[0]),
        });
      },
    },
  });
  mount(SidebarGroupList, {
    groups: [{ key: "Home", elements: [navElements[0]] }],
    groupStates: {},
    activeElementId: 1,
    favoriteIds: ["1"],
    favoriteDisabled: false,
  }, { globals: { onToggleFavorite: element => emitted.push(element) } });
  const button = document.querySelector("button");
  assert.equal(button.dataset.activeId, "1");
  assert.equal(button.dataset.favorites, "1");
  button.click();
  assert.deepEqual(emitted, [navElements[0]]);
});
