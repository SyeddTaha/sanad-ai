// Read-only release probes except synthetic Auth login/logout. Never print credentials.
import assert from "node:assert/strict";

const base = new URL(process.argv[2] ?? "http://localhost:3600").origin;
let failures = 0;
async function probe(name: string, work: () => Promise<unknown>) {
  try {
    console.log(JSON.stringify({ check: name, status: "PASS", evidence: await work() }));
  } catch (error) {
    failures++;
    console.log(JSON.stringify({ check: name, status: "FAIL", reason: error instanceof Error ? error.message : "Probe failed" }));
  }
}
const call = (path: string, init?: RequestInit) => fetch(base + path, { ...init, signal: AbortSignal.timeout(30_000) });

async function main() {
  console.log(JSON.stringify({ base, at: new Date().toISOString() }));
  for (const path of ["/", "/login", "/citizen", "/citizen/verify", "/citizen/results", "/citizen/dispute", "/citizen/case", "/citizen/consent"]) {
    await probe(`page ${path}`, async () => {
      const response = await call(path);
      assert.equal(response.status, 200, `HTTP ${response.status}`);
      const html = await response.text();
      assert.match(html, /SANAD|Ø³ÙŽÙ†ÙŽØ¯|Ø³Ù†Ø¯/i, "SANAD content missing");
      if (path === "/") assert.ok(!html.includes("To get started, edit"), "Entry page is the Next.js starter template");
      return { http: response.status, finalPath: new URL(response.url).pathname };
    });
    if (process.argv.includes("--entry-only")) {
      process.exitCode = failures ? 1 : 0;
      return;
    }
  }
  await probe("public OpenAPI", async () => {
    const response = await call("/api/v1/openapi");
    assert.equal(response.status, 200, `HTTP ${response.status}`);
    const spec = await response.json();
    assert.equal(spec.openapi, "3.1.0");
    assert.ok(spec.paths["/api/v1/cases/{caseId}/resolve"]);
    return { http: response.status, paths: Object.keys(spec.paths).length };
  });
  await probe("anonymous session denied", async () => {
    const response = await call("/api/v1/session");
    assert.equal(response.status, 401, `HTTP ${response.status}`);
    assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    return { http: response.status };
  });
  await probe("invalid API key denied", async () => {
    const response = await call("/api/v1/cases", { headers: { "x-api-key": "sanad_" + "x".repeat(43) } });
    assert.equal(response.status, 401, `HTTP ${response.status}`);
    assert.equal((await response.json()).error.code, "INVALID_API_KEY");
    return { http: response.status };
  });
  for (const actor of ["CITIZEN_A", "OFFICER", "ADMIN", "HELPER", "AUDITOR"]) {
    await probe(`authenticated ${actor}`, async () => {
      const password = process.env[`DEMO_${actor}_PASSWORD`];
      assert.ok(password, "Synthetic test password is not configured");
      const response = await call("/api/v1/auth/login", { method: "POST", headers: { origin: base, "content-type": "application/json" },
        body: JSON.stringify({ email: actor.toLowerCase().replaceAll("_", "-") + "@demo.sanad.test", password }) });
      assert.equal(response.status, 200, `Login HTTP ${response.status}; code ${(await response.clone().json().catch(() => null))?.error?.code ?? "unknown"}`);
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      assert.ok(cookie, "Session cookie missing");
      try {
        const session = await call("/api/v1/session", { headers: { cookie } });
        assert.equal(session.status, 200, `Session HTTP ${session.status}`);
        const body = await session.json();
        assert.ok(body.data.principal.roles.includes(actor.startsWith("CITIZEN") ? "CITIZEN" : actor));
        assert.match(session.headers.get("cache-control") ?? "", /no-store/);
        if (actor === "OFFICER" || actor === "ADMIN") {
          const path = actor === "OFFICER" ? "/api/v1/cases?limit=1" : "/api/v1/admin/dispatch?limit=1";
          const queue = await call(path, { headers: { cookie } });
          assert.equal(queue.status, 200, `${path} HTTP ${queue.status}; code ${(await queue.clone().json().catch(() => null))?.error?.code ?? "unknown"}`);
        }
        return { loginHttp: response.status, sessionHttp: session.status, roles: body.data.principal.roles };
      } finally {
        const logout = await call("/api/v1/auth/logout", { method: "POST", headers: { origin: base, cookie } });
        assert.equal(logout.status, 200, `Logout HTTP ${logout.status}`);
      }
    });
  }
  console.log(JSON.stringify({ verdict: failures ? "FAIL" : "PASS", failures }));
  process.exitCode = failures ? 1 : 0;
}

void main().catch(() => { console.error("Release HTTP audit could not complete"); process.exitCode = 1; });
