---
'fx-media-controller': minor
---

- Added `chrome.manifest` to register the JS directory as a content package.
- Updated `autoconfig.cfg` to register `chrome.manifest` during startup.
- Changed `fx-media-controller.js` loading from a direct `file://` URI to: `chrome://userscripts/content/fx-media-controller.js`.
- Updated the installation structure to include `chrome.manifest` in the Firefox profile's chrome directory.
