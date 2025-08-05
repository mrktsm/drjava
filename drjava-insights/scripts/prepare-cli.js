import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Preparing CLI package...");

// Make CLI script executable
const cliPath = path.resolve(__dirname, "../cli/drjava-insights-cli.js");
try {
  fs.chmodSync(cliPath, "755");
  console.log("Made CLI script executable");
} catch (error) {
  console.warn("Could not make CLI script executable:", error.message);
}

// Create cli directory if it doesn't exist
const cliDir = path.resolve(__dirname, "../cli");
if (!fs.existsSync(cliDir)) {
  fs.mkdirSync(cliDir, { recursive: true });
  console.log("Created CLI directory");
}

// Verify dist directory exists
const distDir = path.resolve(__dirname, "../dist");
if (!fs.existsSync(distDir)) {
  console.error("Error: dist directory not found. Run 'npm run build' first.");
  process.exit(1);
}

console.log("CLI package preparation complete!");
console.log("\nTo test the CLI locally:");
console.log("  npm link");
console.log("  drjava-insights ./logs");
console.log("\nTo publish to npm:");
console.log("  npm publish");
