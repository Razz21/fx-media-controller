# fx-media-controller

## 0.3.0

### Minor Changes

- 95faae5: - Added `chrome.manifest` to register the JS directory as a content package.
  - Updated `autoconfig.cfg` to register `chrome.manifest` during startup.
  - Changed `fx-media-controller.js` loading from a direct `file://` URI to: `chrome://userscripts/content/fx-media-controller.js`.
  - Updated the installation structure to include `chrome.manifest` in the Firefox profile's chrome directory.

## 0.2.1

### Patch Changes

- 094db4b: Fixed MediaController.pause() require an argument for FF v154.0

## 0.2.0

### Minor Changes

- 3adf5ed: Implemented info popup with version and repo link.

### Patch Changes

- 3adf5ed: Panel re-rendering on every tick.
- 3adf5ed: Missing hour mark in position slider.
