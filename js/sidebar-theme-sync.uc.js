// ==UserScript==
// @name           sidebar-theme-sync.uc.js
// @description    Syncs only Zen sidebar and tab text colors with macOS appearance.
// @author         876380496
// @version        2.2.0
// @include        main
// @grant          none
// ==/UserScript==

(function () {
  "use strict";

  const MOD_ID = "8154795f-86ee-40c5-b980-2c843d6df65f";
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const logPath = PathUtils.join(
    PathUtils.profileDir,
    "chrome",
    "sine-mods",
    MOD_ID,
    "sidebar-theme-sync.log"
  );
  const textSelectors = [
    "zen-workspace .tabbrowser-tab",
    "zen-workspace .tab-content",
    "zen-workspace .tab-label",
    "zen-workspace .tab-text",
    "zen-workspace .tab-label-container",
    "zen-workspace .zen-tab-sublabel",
    "zen-workspace .zen-current-workspace-indicator-name",
    "#zen-workspaces-button .zen-workspace-sidebar-name",
    "#zen-sidebar-top-buttons .toolbarbutton-text",
    "#zen-sidebar-foot-buttons .toolbarbutton-text",
  ];
  const iconSelectors = [
    "#zen-sidebar-top-buttons toolbarbutton",
    "#zen-sidebar-foot-buttons toolbarbutton",
    "#zen-workspaces-button .zen-workspace-sidebar-icon",
    "zen-workspace .zen-current-workspace-indicator-icon",
  ];
  let queued = false;
  let logChain = Promise.resolve();

  function foreground() {
    return darkQuery.matches
      ? "rgba(255, 255, 255, 0.9)"
      : "rgb(32, 33, 36)";
  }

  function writeLog(event) {
    const line = `${new Date().toISOString()} ${event} ${JSON.stringify({
      dark: darkQuery.matches,
      foreground: foreground(),
      textCount: document.querySelectorAll(textSelectors.join(",")).length,
      iconCount: document.querySelectorAll(iconSelectors.join(",")).length,
    })}\n`;
    console.log(`[SidebarThemeSyncFix] ${line.trim()}`);
    logChain = logChain.then(() =>
      IOUtils.writeUTF8(logPath, line, { mode: "appendOrCreate" }).catch(() => {})
    );
  }

  function apply(reason) {
    queued = false;
    const color = foreground();

    // Deliberately change only the rendered text and icon colors. Do not set
    // any root/workspace variables, backgrounds, or color-scheme properties.
    for (const element of document.querySelectorAll(textSelectors.join(","))) {
      element.style.setProperty("color", color, "important");
    }
    for (const element of document.querySelectorAll(iconSelectors.join(","))) {
      element.style.setProperty("color", color, "important");
      element.style.setProperty("fill", color, "important");
    }
    writeLog(`apply:${reason}`);
  }

  function schedule(reason) {
    if (queued) {
      return;
    }
    queued = true;
    window.requestAnimationFrame(() => apply(reason));
  }

  const onAppearanceChange = () => schedule("system-appearance-change");
  const observer = new MutationObserver(() => schedule("sidebar-dom-change"));

  darkQuery.addEventListener("change", onAppearanceChange);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  schedule("initial");

  window.addEventListener(
    "unload",
    () => {
      darkQuery.removeEventListener("change", onAppearanceChange);
      observer.disconnect();
      writeLog("unload");
    },
    { once: true }
  );
})();
