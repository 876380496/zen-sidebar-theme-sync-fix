// ==UserScript==
// @name           sidebar-theme-sync.uc.js
// @description    Syncs Zen default sidebar text colors with system appearance.
// @author         876380496
// @version        1.6.0
// @include        main
// @grant          none
// ==/UserScript==

(function () {
  "use strict";

  const MOD_ID = "8154795f-86ee-40c5-b980-2c843d6df65f";
  const root = document.documentElement;
  const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const marker = "zen-sidebar-theme-sync-fix";
  const logPath = PathUtils.join(
    PathUtils.profileDir,
    "chrome",
    "sine-mods",
    MOD_ID,
    "sidebar-theme-sync.log"
  );
  const managedProperties = [
    "--toolbox-textcolor",
    "--toolbar-color",
    "--tab-selected-textcolor",
    "--toolbar-color-scheme",
    "--tab-selected-color-scheme",
    "color",
    "color-scheme",
    "background",
    "background-color",
    "fill",
  ];
  const originals = new WeakMap();
  let updateQueued = false;
  let logChain = Promise.resolve();
  let lastState = "";

  function attributes(element) {
    return Object.fromEntries(
      [...element.attributes].map(attribute => [attribute.name, attribute.value])
    );
  }

  function describe(element) {
    if (!element) {
      return null;
    }
    const computed = getComputedStyle(element);
    return {
      tag: element.localName,
      id: element.id || "",
      className: typeof element.className === "string" ? element.className : "",
      inline: Object.fromEntries(
        managedProperties.map(property => [
          property,
          {
            value: element.style.getPropertyValue(property),
            priority: element.style.getPropertyPriority(property),
          },
        ])
      ),
      computed: Object.fromEntries(
        managedProperties.map(property => [property, computed.getPropertyValue(property)])
      ),
      computedColor: computed.color,
      computedFill: computed.fill,
      computedBackgroundColor: computed.backgroundColor,
      computedBackgroundImage: computed.backgroundImage,
      colorScheme: computed.colorScheme,
    };
  }

  function writeLog(event, data = {}) {
    const line = `${new Date().toISOString()} ${event} ${JSON.stringify(data)}\n`;
    console.log(`[SidebarThemeSyncFix] ${line.trim()}`);

    logChain = logChain
      .then(async () => {
        try {
          await IOUtils.writeUTF8(logPath, line, { mode: "appendOrCreate" });
        } catch (error) {
          console.error(
            `[SidebarThemeSyncFix] Cannot write ${logPath}:`,
            error
          );
        }
      })
      .catch(error => console.error("[SidebarThemeSyncFix] Log queue error:", error));
  }

  function shouldSyncSidebar() {
    // zen-should-be-dark-mode is not a reliable signal that the user has a
    // custom workspace theme. Zen can leave it set while the system theme
    // changes, which is the exact case this Mod fixes.
    //
    // Do not touch private or unsynced windows, where Zen intentionally uses
    // a fixed foreground color.
    return (
      !root.hasAttribute("zen-unsynced-window") &&
      !root.hasAttribute("zen-private-window")
    );
  }

  function remember(element) {
    if (originals.has(element)) {
      return;
    }

    const values = new Map();
    for (const property of managedProperties) {
      values.set(property, {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property),
      });
    }
    originals.set(element, values);
  }

  function setImportant(element, property, value) {
    if (!element?.style) {
      return;
    }
    if (
      element.style.getPropertyValue(property) === value &&
      element.style.getPropertyPriority(property) === "important"
    ) {
      return;
    }
    remember(element);
    element.style.setProperty(property, value, "important");
  }

  function restore(element) {
    const values = originals.get(element);
    if (!values) {
      return;
    }

    for (const [property, { value, priority }] of values) {
      if (value) {
        element.style.setProperty(property, value, priority);
      } else {
        element.style.removeProperty(property);
      }
    }
    originals.delete(element);
  }

  function clearAppliedStyles() {
    [
      root,
      document.querySelector("#browser"),
      document.querySelector("#navigator-toolbox"),
      document.querySelector("#tabbrowser-tabs"),
      ...document.querySelectorAll(
        "zen-workspace, zen-workspace .tabbrowser-tab, zen-workspace .tab-content, " +
          "zen-workspace .tab-label-container, zen-workspace .tab-label, " +
          "zen-workspace .tab-text, zen-workspace .zen-tab-sublabel, " +
          ".zen-current-workspace-indicator, " +
          ".zen-current-workspace-indicator .zen-current-workspace-indicator-name, " +
          "#zen-sidebar-top-buttons, #zen-sidebar-foot-buttons, " +
          "#zen-sidebar-top-buttons toolbarbutton, " +
          "#zen-sidebar-foot-buttons toolbarbutton, zen-workspace toolbarbutton, " +
          "#zen-sidebar-top-buttons .toolbarbutton-text, " +
          "#zen-sidebar-foot-buttons .toolbarbutton-text, " +
          "#urlbar .urlbar-background, #zen-workspaces-button > toolbarbutton"
      ),
    ]
      .filter(Boolean)
      .forEach(restore);
    root.removeAttribute(marker);
  }

  function stateSnapshot(reason) {
    const workspaces = [...document.querySelectorAll("zen-workspace")];
    const tabs = [...document.querySelectorAll("zen-workspace .tabbrowser-tab")];
    const state = {
      reason,
      href: location.href,
      readyState: document.readyState,
      darkMode: darkModeQuery.matches,
      mediaLight: window.matchMedia("(prefers-color-scheme: light)").matches,
      rootAttributes: attributes(root),
      rootComputed: describe(root),
      browser: describe(document.querySelector("#browser")),
      navigatorToolbox: describe(document.querySelector("#navigator-toolbox")),
      tabStrip: describe(document.querySelector("#tabbrowser-tabs")),
      urlbarBackground: describe(document.querySelector("#urlbar .urlbar-background")),
      workspaceButton: describe(document.querySelector("#zen-workspaces-button > toolbarbutton")),
      workspaceCount: workspaces.length,
      tabCount: tabs.length,
      topToolbar: describe(document.querySelector("#zen-sidebar-top-buttons")),
      footToolbar: describe(document.querySelector("#zen-sidebar-foot-buttons")),
      workspace: describe(workspaces.find(workspace => workspace.hasAttribute("active")) || workspaces[0]),
      selectedTab: describe(tabs.find(tab => tab.hasAttribute("selected"))),
      unsafeJS: Services.prefs.getBoolPref("sine.allow-unsafe-js", false),
      logPath,
    };
    return state;
  }

  function applyForeground(reason = "update") {
    updateQueued = false;

    if (!shouldSyncSidebar()) {
      clearAppliedStyles();
      const state = stateSnapshot(`${reason}:skipped-special-window`);
      const serialized = JSON.stringify(state);
      if (serialized !== lastState) {
        lastState = serialized;
        writeLog("skip-special-window", state);
      }
      return;
    }

    const foreground = darkModeQuery.matches
      ? "rgba(255, 255, 255, 0.9)"
      : "rgb(32, 33, 36)";

    const colorScheme = darkModeQuery.matches ? "dark" : "light";
    root.setAttribute(marker, colorScheme);

    // Zen's background follows light-dark(), but its background variables are
    // declared above the elements that use them. Sync the variables on the
    // actual toolbar containers as well as the color-scheme, otherwise the
    // text can change while the search box/workspace tiles keep stale tinting.
    const elementBackground = `color-mix(in oklch, ${foreground} ${darkModeQuery.matches ? 15 : 8}%, transparent)`;
    const elementHoverBackground = darkModeQuery.matches
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(0, 0, 0, 0.08)";
    for (const element of [
      document.querySelector("#browser"),
      document.querySelector("#navigator-toolbox"),
      document.querySelector("#TabsToolbar"),
      document.querySelector("#nav-bar"),
      document.querySelector("#tabbrowser-tabs"),
      document.querySelector("#zen-sidebar-top-buttons"),
      document.querySelector("#zen-sidebar-foot-buttons"),
      document.querySelector("#urlbar"),
      document.querySelector("#zen-workspaces-button"),
    ].filter(Boolean)) {
      setImportant(element, "color-scheme", colorScheme);
      setImportant(element, "--toolbar-color-scheme", colorScheme);
      setImportant(element, "--tab-selected-color-scheme", colorScheme);
      setImportant(element, "--toolbox-textcolor", foreground);
      setImportant(element, "--toolbar-color", foreground);
      setImportant(element, "--zen-toolbar-element-bg", elementBackground);
      setImportant(element, "--zen-toolbar-element-bg-hover", elementHoverBackground);
    }
    setImportant(root, "color-scheme", colorScheme);
    setImportant(root, "--toolbar-color-scheme", colorScheme);
    setImportant(root, "--tab-selected-color-scheme", colorScheme);

    for (const workspace of document.querySelectorAll("zen-workspace")) {
      setImportant(workspace, "color-scheme", colorScheme);
      setImportant(workspace, "--toolbar-color-scheme", colorScheme);
      setImportant(workspace, "--tab-selected-color-scheme", colorScheme);
      for (const property of [
        "--toolbox-textcolor",
        "--toolbar-color",
        "--tab-selected-textcolor",
      ]) {
        setImportant(workspace, property, foreground);
      }
      setImportant(workspace, "color", foreground);

      for (const tab of workspace.querySelectorAll(
        ".tabbrowser-tab, .tab-content, .tab-label-container, .tab-label, " +
          ".tab-text, .zen-tab-sublabel"
      )) {
        setImportant(tab, "color-scheme", colorScheme);
        setImportant(tab, "--toolbar-color-scheme", colorScheme);
        setImportant(tab, "--tab-selected-color-scheme", colorScheme);
        setImportant(tab, "--tab-selected-textcolor", foreground);
        setImportant(tab, "color", foreground);
      }

      for (const button of workspace.querySelectorAll("toolbarbutton")) {
        setImportant(button, "color-scheme", colorScheme);
        setImportant(button, "color", foreground);
        setImportant(button, "fill", foreground);
      }
    }

    const urlbarBackground = document.querySelector("#urlbar .urlbar-background");
    if (urlbarBackground) {
      setImportant(urlbarBackground, "color-scheme", colorScheme);
      setImportant(urlbarBackground, "--zen-toolbar-element-bg", elementBackground);
      setImportant(urlbarBackground, "background", elementBackground);
    }

    for (const button of document.querySelectorAll(
      "#zen-workspaces-button > toolbarbutton"
    )) {
      setImportant(button, "color-scheme", colorScheme);
      setImportant(button, "--zen-toolbar-element-bg", elementBackground);
      setImportant(button, "background-color", elementBackground);
    }

    for (const element of document.querySelectorAll(
      ".zen-current-workspace-indicator, " +
        ".zen-current-workspace-indicator .zen-current-workspace-indicator-name"
    )) {
      setImportant(element, "color-scheme", colorScheme);
      setImportant(element, "color", foreground);
      setImportant(element, "fill", foreground);
    }

    for (const selector of [
      "#zen-sidebar-top-buttons",
      "#zen-sidebar-foot-buttons",
    ]) {
      const toolbar = document.querySelector(selector);
      if (!toolbar) {
        continue;
      }
      setImportant(toolbar, "color-scheme", colorScheme);
      setImportant(toolbar, "--toolbar-color-scheme", colorScheme);
      setImportant(toolbar, "--tab-selected-color-scheme", colorScheme);
      setImportant(toolbar, "--toolbox-textcolor", foreground);
      setImportant(toolbar, "--toolbar-color", foreground);
      setImportant(toolbar, "color", foreground);

      for (const element of toolbar.querySelectorAll(
        "toolbarbutton, .toolbarbutton-text, label, image"
      )) {
        setImportant(element, "color-scheme", colorScheme);
        setImportant(element, "color", foreground);
        setImportant(element, "fill", foreground);
      }
    }

    const state = stateSnapshot(`${reason}:applied`);
    state.foreground = foreground;
    const serialized = JSON.stringify(state);
    if (serialized !== lastState) {
      lastState = serialized;
      writeLog("apply", state);
    }
  }

  function scheduleUpdate(reason = "scheduled") {
    if (updateQueued) {
      return;
    }
    updateQueued = true;
    window.requestAnimationFrame(() => applyForeground(reason));
  }

  const onSystemColorSchemeChange = () =>
    scheduleUpdate("system-color-scheme-change");
  const onTabOpen = () => scheduleUpdate("tab-open");
  const onTabSelect = () => scheduleUpdate("tab-select");

  writeLog("script-start", stateSnapshot("script-start"));

  darkModeQuery.addEventListener("change", onSystemColorSchemeChange);
  root.addEventListener("TabOpen", onTabOpen, true);
  root.addEventListener("TabSelect", onTabSelect, true);

  const observer = new MutationObserver(mutations => {
    const changed = mutations.some(mutation => {
      return (
        mutation.type === "childList" ||
        (mutation.type === "attributes" &&
          [
            "style",
            "zen-default-theme",
            "zen-should-be-dark-mode",
            "zen-unsynced-window",
            "zen-private-window",
          ].includes(mutation.attributeName))
      );
    });
    if (changed) {
      scheduleUpdate("dom-theme-or-tab-change");
    }
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "style",
      "zen-default-theme",
      "zen-should-be-dark-mode",
      "zen-unsynced-window",
      "zen-private-window",
    ],
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => scheduleUpdate("DOMContentLoaded"), {
      once: true,
    });
  } else {
    scheduleUpdate("initial");
  }

  window.addEventListener(
    "unload",
    () => {
      darkModeQuery.removeEventListener("change", onSystemColorSchemeChange);
      root.removeEventListener("TabOpen", onTabOpen, true);
      root.removeEventListener("TabSelect", onTabSelect, true);
      observer.disconnect();
      clearAppliedStyles();
      writeLog("script-unload");
    },
    { once: true }
  );
})();
