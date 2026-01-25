## 2026-01-17 - [Hot Path Allocation]

**Learning:** Instantiating small arrays (e.g., `['a', 'b'].includes(x)`) inside a recursive tree visitor caused significant GC pressure and execution time overhead (~35%).
**Action:** Move static lists of strings to module-level `Set` constants for O(1) lookup and zero allocation during traversal.

## 2026-01-18 - [Object Allocation in Visitor]
**Learning:** Returning fresh objects (e.g., `{ structural: 1, ... }`) from frequently called analysis functions creates massive GC pressure in recursive visitors.
**Action:** Use static constant objects for common return values (like `RESULT_IF`, `RESULT_NONE`) to avoid allocation on hot paths.

## 2026-01-20 - [Closure Allocation in Hot Path]
**Learning:** Defining helper closures (e.g., `const record = () => ...`) inside a method called thousands of times adds unnecessary allocation overhead.
**Action:** Extract closures into private class methods to eliminate repeated function object creation in recursive visitors.

## 2026-02-18 - [Redundant Wrapper Instantiation]
**Learning:** `web-tree-sitter` accessors (like `node.child(1)`) instantiate new wrapper objects on every call. Redundant calls in recursive checks (like `isBinaryContinuation`) double the allocation cost.
**Action:** Pass already-resolved node properties (like `op` string) as arguments to helper methods instead of re-fetching them from the AST node.
