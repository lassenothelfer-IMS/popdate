/// <reference types="vite/client" />

/** Every function module in `convex/`, for `convexTest`. Files with two dots (tests, this file) are left out. */
export const modules = import.meta.glob('./**/!(*.*.*)*.*s');
