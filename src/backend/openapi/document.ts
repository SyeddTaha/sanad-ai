import "server-only";
import { z } from "zod";
import { ApiErrorEnvelopeSchema, ErrorHttpStatus } from "@/contracts/v1";
import { ApiKeyScopesByRole } from "@/lib/api-key-contract";
import { operations } from "./operations";

export function openApiDocument() {
  const schemas: Record<string, unknown> = { Error: z.toJSONSchema(ApiErrorEnvelopeSchema) };
  const paths: Record<string, Record<string, unknown>> = {};
  const human = [{ HumanBearer: [] }, { HumanCookie: [] }];
  for (const operation of operations) {
    const path = "/api/v1" + operation.path;
    const parameters: object[] = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({ name: match[1], in: "path", required: true, schema: { type: "string", format: "uuid" } }));
    const parameter = (name: string, schema: object, required = false) => parameters.push({ name, in: "query", required, schema });
    if (operation.pagination) {
      parameter("cursor", { type: "string", format: "uuid" });
      // Existing handlers parse decimal query text rather than coercing JSON numbers.
      parameter("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 });
    }
    if (operation.queue) {
      parameter("sort", { type: "string", enum: operation.queue === "officer" ? ["priority", "confidence", "oldest"] : ["priority", "oldest"], default: "priority" });
      parameter("status", { type: "string", enum: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_EVIDENCE", "PENDING_CONSENT", "RESOLVED", "CLOSED"] });
    }
    if (operation.id === "auditMetadata") parameter("caseId", { type: "string", format: "uuid" }, true);
    if (operation.id === "currentRule") parameter("programRef", { type: "string", enum: ["program_demo"] });
    if (operation.id === "evidencePassport") parameter("assessmentId", { type: "string", format: "uuid" });
    if (operation.request && operation.id !== "login") parameters.push({ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" }, description: "Retain for identical retries; changed validated payload returns IDEMPOTENCY_CONFLICT. Current authorization is rechecked before replay." });
    if (operation.method !== "get") parameters.push({ name: "Origin", in: "header", required: operation.id === "login" || operation.id === "logout", schema: { type: "string", format: "uri" }, description: "Must equal the request origin for cookie mutations, login and logout." });
    const status = operation.status ?? 200;
    const responseName = operation.id + "Response";
    schemas[responseName] = z.toJSONSchema(operation.response);
    const success = { description: "Successful response", content: { "application/json": { schema: { $ref: "#/components/schemas/" + responseName } } } };
    const responses: Record<string, unknown> = { [status]: success };
    if (operation.id === "issueApiKey") responses[200] = { ...success, description: "Identical issuance retry; key is null. Only original metadata is retained." };
    if (!operation.public || operation.id === "login") {
      const statuses = operation.method === "get" ? [400, 401, 403, 404, 409, 422, 429, 503] : [400, 401, 403, 404, 409, 413, 415, 422, 429, 503];
      for (const code of statuses) responses[code] = { description: Object.entries(ErrorHttpStatus).filter(([, value]) => value === code).map(([name]) => name).join(", "), content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
    }
    let requestBody;
    if (operation.request) {
      const name = operation.id + "Request";
      schemas[name] = z.toJSONSchema(operation.request, { io: "input" });
      requestBody = { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/" + name }, example: operation.example } } };
    }
    paths[path] ??= {};
    paths[path][operation.method] = {
      operationId: operation.id, summary: operation.summary,
      description: [operation.description, operation.scopes ? "API key scopes are necessary; current roles, ownership/delegation, assignment, department membership and applicable consent are also enforced. Keys act as SERVICE, never Citizen confirmation." : operation.public ? "Public document or login operation." : "Verified human session only. API keys are not accepted."].filter(Boolean).join(" "),
      security: operation.public ? [] : operation.scopes ? [...human, { ApiKey: [] }] : human,
      ...(operation.scopes ? { "x-api-key-scopes": operation.scopes } : {}),
      parameters, ...(requestBody ? { requestBody } : {}), responses,
    };
  }
  return {
    openapi: "3.1.0", info: { title: "SANAD Public REST API", version: "1.0.0",
      description: "Synthetic prototype, not an official government or banking service. All paths describe implemented operations. Use exactly one credential scheme. Sensitive responses are private/no-store. Keys are self-issued SERVICE credentials bound to the issuing profile, its current roles and explicit consent; no blanket owner access. Mutations require bounded JSON (8 KiB, or 64 KiB for Case input), Idempotency-Key, and current expected revisions where specified. JSON schema projects shared Zod types; semantic refinements, consent purposes and transactional checks remain server-enforced. Missing Developer 2 identity/payment/program mock adapters are not exposed or claimed live. See docs/b05-public-api.md." },
    servers: [{ url: "/" }], paths,
    components: { schemas, securitySchemes: {
      HumanBearer: { type: "http", scheme: "bearer", bearerFormat: "Supabase JWT", description: "Verified human JWT bound to a live Auth session." },
      HumanCookie: { type: "apiKey", in: "cookie", name: "sanad-session", description: "HttpOnly verified human session; mutations require same-origin Origin." },
      ApiKey: { type: "apiKey", in: "header", name: "X-API-Key", description: "One-time-disclosed sanad_ credential; send only in this header, never URLs. Per-operation scopes appear in x-api-key-scopes; role ceilings in x-api-key-scopes-by-role. Scope cannot bypass consent, assignment or department membership." },
    } },
    "x-api-key-scopes-by-role": ApiKeyScopesByRole,
  };
}
