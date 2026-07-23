(function () {
  "use strict";

  chrome.webNavigation.onCommitted.addListener(
    function handle_committed_navigation(details) {
      if (details.frameId !== 0) {
        return;
      }

      inject_fetch_interceptor(details.tabId, details.url);
    },
    {
      url: [{ hostEquals: "open.spotify.com" }],
    },
  );

  chrome.webNavigation.onCompleted.addListener(
    function handle_completed_navigation(details) {
      if (details.frameId !== 0) {
        return;
      }

      inject_fetch_interceptor(details.tabId, details.url);
      inject_playlist_search(details.tabId, details.url);
    },
    {
      url: [{ hostEquals: "open.spotify.com" }],
    },
  );

  chrome.webNavigation.onHistoryStateUpdated.addListener(
    function handle_history_navigation(details) {
      if (details.frameId !== 0) {
        return;
      }

      inject_fetch_interceptor(details.tabId, details.url);
      inject_playlist_search(details.tabId, details.url);
    },
    {
      url: [{ hostEquals: "open.spotify.com" }],
    },
  );

  chrome.commands.onCommand.addListener(async function handle_command(command) {
    if (command !== "toggle-search") {
      return;
    }

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id || !is_spotify_playlist_url(tab.url)) {
      return;
    }

    await inject_playlist_search(tab.id, tab.url);

    try {
      await chrome.tabs.sendMessage(tab.id, { action: "toggle-search" });
    } catch (error) {
      // The tab may have navigated before injection finished.
    }
  });

  async function inject_fetch_interceptor(tab_id, url) {
    if (!tab_id || !is_spotify_url(url)) {
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab_id },
        files: ["page-fetch-interceptor.js"],
        world: "MAIN",
        injectImmediately: true,
      });
    } catch (error) {
      // Spotify tabs can close or navigate while the extension is injecting.
    }
  }

  async function inject_playlist_search(tab_id, url) {
    if (!tab_id || !is_spotify_playlist_url(url)) {
      return;
    }

    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab_id },
        files: ["content-script.css"],
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab_id },
        files: ["content-script.js"],
      });
    } catch (error) {
      // Spotify tabs can close or navigate while the extension is injecting.
    }
  }

  function is_spotify_url(url) {
    return Boolean(url && url.startsWith("https://open.spotify.com/"));
  }

  function is_spotify_playlist_url(url) {
    return Boolean(
      url &&
        (url.startsWith("https://open.spotify.com/playlist/") ||
          url.startsWith("https://open.spotify.com/collection/tracks")),
    );
  }
})();
