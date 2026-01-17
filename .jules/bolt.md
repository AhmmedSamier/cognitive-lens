## 2026-01-17 - [Hot Path Allocation]
**Learning:** Instantiating small arrays (e.g., `['a', 'b'].includes(x)`) inside a recursive tree visitor caused significant GC pressure and execution time overhead (~35%).
**Action:** Move static lists of strings to module-level `Set` constants for O(1) lookup and zero allocation during traversal.
