---
'@finos/legend-application-data-cube': patch
---

Add two experimental settings, off by default, for cached sources, local files and cached Iceberg tables: one generates their SQL in the browser with legend-lite's planner (a WebAssembly build of a Legend compiler that answers `pure/v1` routes) instead of asking the engine server; the other keeps using the engine server and compares its result with the planner's in the background.
