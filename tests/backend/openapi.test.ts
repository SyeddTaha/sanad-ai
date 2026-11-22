import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import SwaggerParser from "@apidevtools/swagger-parser";
import { GET } from "../../src/app/api/v1/openapi/route";
import { operations } from "../../src/backend/openapi/operations";

test("public OpenAPI is a valid machine-readable document and covers exactly the implemented operations", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  const document = await response.json();
  await SwaggerParser.validate(structuredClone(document), { resolve: { external: false } });
  const actual: string[] = [];
  async function visit(directory: string, path: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await visit(directory + "/" + entry.name, path + "/" + entry.name.replace(/^\[(.+)\]$/, "{$1}"));
      else if (entry.name === "route.ts") {
        const code = await readFile(directory + "/route.ts", "utf8");
        for (const match of code.matchAll(/export (?:async )?(?:function|const) (GET|POST|PATCH|PUT|DELETE)\b/g)) actual.push(match[1].toLowerCase() + " " + path);
      }
    }
  }
  await visit("src/app/api/v1", "/api/v1");
  const documented = Object.entries(document.paths).flatMap(([path, methods]) => Object.keys(methods as object).filter((method) => ["get", "post", "patch", "put", "delete"].includes(method)).map((method) => method + " " + path));
  assert.deepEqual(documented.sort(), actual.sort());
  assert.equal(document.components.securitySchemes.ApiKey.name, "X-API-Key");
  assert.deepEqual(document.paths["/api/v1/cases/{caseId}"].get["x-api-key-scopes"], ["READ_CASE"]);
  assert.ok(document.paths["/api/v1/api-keys"].post.security.every((scheme: object) => !("ApiKey" in scheme)));
  assert.ok(!JSON.stringify(document.paths).includes("/mock/"));
});

test("published synthetic request examples validate against the implemented request schemas", () => {
  for (const operation of operations) {
    if (operation.request) assert.ok(operation.request.safeParse(operation.example).success, operation.id + " example");
  }
});
