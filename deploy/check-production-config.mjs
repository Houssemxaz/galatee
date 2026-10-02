import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnvText, validateProductionConfig } from "./productionConfig.mjs";

const filePath = resolve(process.argv[2] || process.env.PRODUCTION_ENV_FILE || ".env.production");

try {
  const values = parseEnvText(await readFile(filePath, "utf8"));
  const { errors, warnings } = validateProductionConfig(values);
  for (const warning of warnings) console.warn(`[production config] warning: ${warning}`);
  if (errors.length > 0) {
    console.error(`[production config] ${errors.length} erreur(s) dans ${filePath}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[production config] OK: ${filePath}`);
  }
} catch (error) {
  console.error(`[production config] impossible de lire ${filePath}: ${error.message}`);
  process.exitCode = 1;
}
