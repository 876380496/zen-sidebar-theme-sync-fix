// ==UserScript==
// @name           sidebar-theme-sync.uc.js
// @description    Syncs Zen default sidebar text colors with system appearance.
// @author         876380496
// @version        1.2.0
// @include        main
// @grant          none
// ==/UserScript==

(function () {
  "use strict";

  const root = document.documentElement;
  const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const marker = "zen-sidebar-theme-sync-fix";
  const managedProperties = [
    "--toolbox-textcolor",
    "--toolbar-color",
    "--tab-selected-textcolor",
    "color",
    "fill",
  ];
  const originals = new WeakMap();
  let updateQueued = false;

  function isDefaultWorkspaceTheme() {
    if (root.getAttribute("zen-default-theme") === "true") {
      return true;
    }

    // During some startup/theme-switch paths Zen does not expose
    // zen-default-theme. Explicit workspace gradients do expose
    // zen-should-be-dark-mode, so the absence of both is the safe fallback.
    return (
      !root.hasAttribute("zen-should-be-dark-mode") &&
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
    document
      .querySelectorAll(
        "zen-workspace, zen-workspace .tabbrowser-tab, zen-workspace .tab-content, " +
          "zen-workspace .tab-label, zen-workspace .tab-text, " +
          "zen-workspace .zen-tab-sublabel, #zen-sidebar-top-buttons, " +
          "#zen-sidebar-foot-buttons, #zen-sidebar-top-buttons toolbarbutton, " +
          "#zen-sidebar-foot-buttons toolbarbutton, zen-workspace toolbarbutton, " +
          "#zen-sidebar-top-buttons .toolbarbutton-text, " +
          "#zen-sidebar-foot-buttons .toolbarbutton-text"
      )
      .forEach(restore);
    root.removeAttribute(marker);
  }

  function applyForeground() {
    updateQueued = false;

    if (!isDefaultWorkspaceTheme()) {
      clearAppliedStyles();
      return;
    }

    const foreground = darkModeQuery.matches
      ? "rgba(255, 255, 255, 0.9)"
      : "rgb(32, 33, 36)";

    root.setAttribute(marker, darkModeQuery.matches ? "dark" : "light");

    for (const workspace of document.querySelectorAll("zen-workspace")) {
      for (const property of [
        "--toolbox-textcolor",
        "--toolbar-color",
        "--tab-selected-textcolor",
      ]) {
        setImportant(workspace, property, foreground);
      }
      setImportant(workspace, "color", foreground);

      for (const tab of workspace.querySelectorAll(
        ".tabbrowser-tab, .tab-content, .tab-label, .tab-text, .zen-tab-sublabel"
      )) {
        setImportant(tab, "--tab-selected-textcolor", foreground);
        setImportant(tab, "color", foreground);
      }

      for (const button of workspace.querySelectorAll("toolbarbutton")) {
        setImportant(button, "color", foreground);
        setImportant(button, "fill", foreground);
      }
    }

    for (const selector of [
      "#zen-sidebar-top-buttons",
      "#zen-sidebar-foot-buttons",
    ]) {
      const toolbar = document.querySelector(selector);
      if (!toolbar) {
        continue;
      }
      setImportant(toolbar, "--toolbox-textcolor", foreground);
      setImportant(toolbar, "--toolbar-color", foreground);
      setImportant(toolbar, "color", foreground);

      for (const element of toolbar.querySelectorAll(
        "toolbarbutton, .toolbarbutton-text, label, image"
      )) {
        setImportant(element, "color", foreground);
        setImportant(element, "fill", foreground);
      }
    }
  }

  function scheduleUpdate() {
    if (updateQueued) {
      return;
    }
    updateQueued = true;
    window.requestAnimationFrame(applyForeground);
  }

  darkModeQuery.addEventListener("change", scheduleUpdate);
  root.addEventListener("TabOpen", scheduleUpdate, true);
  root.addEventListener("TabSelect", scheduleUpdate, true);

  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "zen-default-theme",
      "zen-should-be-dark-mode",
      "zen-unsynced-window",
      "zen-private-window",
    ],
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleUpdate, {
      once: true,
    });
  } else {
    scheduleUpdate();
  }

  window.addEventListener(
    "unload",
    () => {
      darkModeQuery.removeEventListener("change", scheduleUpdate);
      root.removeEventListener("TabOpen", scheduleUpdate, true);
      root.removeEventListener("TabSelect", scheduleUpdate, true);
      observer.disconnect();
      clearAppliedStyles();
    },
    { once: true }
  );
})();
