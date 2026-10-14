import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const { RENDER_API_KEY, DATABASE_URL } = process.env;
if (!RENDER_API_KEY || !DATABASE_URL) throw new Error("Deployment secrets are required");
const databaseUrl = new URL(DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  throw new Error("DATABASE_URL must use PostgreSQL");
}

async function request(path, body) {
  const response = await fetch(`https://api.render.com/v1${path}`, {
    method: body ? "POST" : "GET",
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
};
await writeFile("render-deployment.json", JSON.stringify(deployment, null, 2));
console.log(JSON.stringify(deployment));

for (let attempt = 0; attempt < 60; attempt++) {
  const deploys = await request(`/services/${service.id}/deploys?limit=1`);
  const status = deploys[0]?.deploy.status;
  console.log(`Render deployment: ${status || "pending"}`);
  if (status === "live") {
    const health = await fetch(`${deployment.url}/api/health`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!health.ok || (await health.json()).status !== "ok") {
      throw new Error("API health check failed");
    }
    console.log("API health check passed");
    break;
  }
  if (["build_failed", "update_failed", "canceled", "pre_deploy_failed"].includes(status)) {
    throw new Error(`Render deployment failed: ${status}`);
  }
  if (attempt === 59) throw new Error("Render deployment timed out");
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}
