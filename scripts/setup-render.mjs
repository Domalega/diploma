import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const {
  RENDER_API_KEY,
  DATABASE_URL,
  GOOGLE_MAIL_URL,
  GOOGLE_MAIL_SECRET,
  GITHUB_SHA,
  GITHUB_TOKEN,
} = process.env;
if (!RENDER_API_KEY) throw new Error("Render API key is required");
if (DATABASE_URL && !["postgres:", "postgresql:"].includes(new URL(DATABASE_URL).protocol)) {
  throw new Error("DATABASE_URL must use PostgreSQL");
}

async function request(path, body, method = body ? "POST" : "GET") {
  const response = await fetch(`https://api.render.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${RENDER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Render ${path}: HTTP ${response.status}`);
  return response.json();
}

const owners = await request("/owners?limit=100");
const services = await request("/services?limit=100");
let service = services.find(
  ({ service: item }) =>
    item.name === "diploma-api" && item.repo === "https://github.com/Domalega/diploma",
)?.service;

if (!service) {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required for a new service");
  if (owners.length !== 1) throw new Error("Select a Render workspace before creating the service");
  const env = {
    NODE_VERSION: "22",
    NODE_ENV: "production",
    DB_DIALECT: "postgres",
    DB_SSL: "true",
    DATABASE_URL,
    SECRET_KEY: randomBytes(32).toString("hex"),
    CLIENT_ORIGIN: "https://domalega.github.io",
  };
  const result = await request("/services", {
    type: "web_service",
    name: "diploma-api",
    ownerId: owners[0].owner.id,
    repo: "https://github.com/Domalega/diploma",
    branch: "redesign",
    rootDir: "server",
    autoDeployTrigger: "checksPass",
    envVars: Object.entries(env).map(([key, value]) => ({ key, value })),
    serviceDetails: {
      runtime: "node",
      plan: "free",
      region: "frankfurt",
      numInstances: 1,
      healthCheckPath: "/api/health",
      envSpecificDetails: { buildCommand: "npm ci --omit=dev", startCommand: "npm start" },
    },
  });
  service = result.service;
}
if (!service?.id) throw new Error("Render returned no service ID");
service = await request(`/services/${service.id}`);
if (service.branch !== "redesign" || service.serviceDetails.plan !== "free") {
  throw new Error("Expected the redesign branch and free plan");
}
const deployment = {
  id: service.id,
  url: service.serviceDetails.url,
  branch: service.branch,
  plan: service.serviceDetails.plan,
  commit: GITHUB_SHA,
};
await writeFile("render-deployment.json", JSON.stringify(deployment, null, 2));
console.log(JSON.stringify(deployment));

if (GOOGLE_MAIL_URL || GOOGLE_MAIL_SECRET) {
  if (
    !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
      GOOGLE_MAIL_URL || "",
    ) ||
    !/^[a-f0-9]{64}$/.test(GOOGLE_MAIL_SECRET || "")
  ) {
    throw new Error("A deployed Google mail URL and 32-byte shared secret are required");
  }
}

// Public repository URL services require an explicit deploy, even with checksPass configured.
if (!GITHUB_SHA || !GITHUB_TOKEN) throw new Error("GitHub verification context is required");
let verified = false;
for (let attempt = 0; attempt < 120; attempt++) {
  const response = await fetch(
    `https://api.github.com/repos/Domalega/diploma/commits/${GITHUB_SHA}/check-runs`,
    {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new Error(`GitHub checks: HTTP ${response.status}`);
  const checks = await response.json();
  const check = checks.check_runs.find(
    (item) => item.name === "verify" && item.app?.slug === "github-actions",
  );
  if (check?.status === "completed") {
    if (check.conclusion !== "success") throw new Error("Project verification did not pass");
    verified = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
if (!verified) throw new Error("Project verification timed out");
if (GOOGLE_MAIL_URL || GOOGLE_MAIL_SECRET) {
  for (const [key, value] of Object.entries({
    GOOGLE_MAIL_URL,
    GOOGLE_MAIL_SECRET,
    MAIL_TRANSPORT: "google",
    PASSWORD_RESET_URL: "https://domalega.github.io/diploma/#/reset-password",
  })) {
    await request(`/services/${service.id}/env-vars/${key}`, { value }, "PUT");
  }
}

await request(`/services/${service.id}/deploys`, { commitId: GITHUB_SHA });
console.log("Deployment requested for the verified commit");

for (let attempt = 0; attempt < 60; attempt++) {
  const deploys = await request(`/services/${service.id}/deploys?limit=1`);
  const status = deploys[0]?.deploy.status;
  console.log(`Render deployment: ${status || "pending"}`);
  if (status === "live" && deploys[0]?.deploy.commit?.id === GITHUB_SHA) {
    const health = await fetch(`${deployment.url}/api/health`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!health.ok || (await health.json()).status !== "ok") {
      throw new Error("API health check failed");
    }
    console.log("API health check passed");
    if (GOOGLE_MAIL_URL) {
      const recovery = await fetch(`${deployment.url}/api/user/password-recovery`, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!recovery.ok || !(await recovery.json()).available)
        throw new Error("Password recovery is not configured");
      console.log("Password recovery is available");
    }
    break;
  }
  if (["build_failed", "update_failed", "canceled", "pre_deploy_failed"].includes(status)) {
    throw new Error(`Render deployment failed: ${status}`);
  }
  if (attempt === 59) throw new Error("Render deployment timed out");
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}
