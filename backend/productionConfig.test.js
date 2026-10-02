import test from "node:test";
import assert from "node:assert/strict";
import { parseEnvText, validateProductionConfig } from "../deploy/productionConfig.mjs";

const validConfig = {
  NODE_ENV: "production",
  GALATEE_DATABASE: "postgres",
  DATABASE_URL: "postgresql://galatee:strong%20password@postgres:5432/galatee",
  POSTGRES_USER: "galatee",
  POSTGRES_PASSWORD: "strong password",
  POSTGRES_DB: "galatee",
  GALATEE_ADMIN_TOKEN: "a".repeat(40),
  GALATEE_ALLOWED_ORIGIN: "https://galatee.example",
  GALATEE_UPLOAD_DIR: "/app/backend/data/uploads/menu",
  TRUST_PROXY: "1",
  REDIS_URL: "",
};

test("production config accepts a valid PostgreSQL mono-VPS configuration", () => {
  const result = validateProductionConfig(validConfig);
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join(" "), /REDIS_URL/);
});

test("production config rejects placeholders and unsafe origins", () => {
  const result = validateProductionConfig({
    ...validConfig,
    DATABASE_URL: "postgresql://galatee:CHANGE_ME@postgres:5432/galatee",
    POSTGRES_PASSWORD: "CHANGE_ME",
    GALATEE_ADMIN_TOKEN: "short",
    GALATEE_ALLOWED_ORIGIN: "http://localhost:5173/path",
  });
  assert.ok(result.errors.some((error) => error.includes("POSTGRES_PASSWORD")));
  assert.ok(result.errors.some((error) => error.includes("GALATEE_ADMIN_TOKEN")));
  assert.ok(result.errors.some((error) => error.includes("HTTPS")));
});

test("production env parsing ignores comments and removes matching quotes", () => {
  assert.deepEqual(parseEnvText('# comment\nNODE_ENV="production"\nPORT=3000\n'), {
    NODE_ENV: "production",
    PORT: "3000",
  });
});
