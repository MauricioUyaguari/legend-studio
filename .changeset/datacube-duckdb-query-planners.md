---
'@finos/legend-application-data-cube': patch
---

Add `LegendDataCubeApplicationPlugin.getExtraDuckDBQueryPlanners()`, through which a plugin can contribute a planner other than the engine server for cached sources, local files and cached Iceberg tables (whose SQL DataCube runs on its own DuckDB). Each contributed planner adds two experimental settings, off by default: one uses the planner instead of the engine server; the other keeps using the engine server and compares its result with the planner's in the background. With no planner contributed, nothing changes. `LegendDataCubeApplicationPlugin` is now exported.
