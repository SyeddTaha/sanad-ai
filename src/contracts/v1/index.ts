/** Frozen bounded contract baseline. Read README.md for deferred integration gates. */
export const CONTRACT_REVISION = "v1.0.0" as const;
export const API_BASE_PATH = "/api/v1" as const;
export * from "./scalars";
export * from "./notice";
export * from "./consent";
export * from "./authorization";
export * from "./case";
export * from "./evidence";
export * from "./assessment";
export * from "./ai-metadata";
export * from "./api";
