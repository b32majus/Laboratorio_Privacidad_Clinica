import crypto from "crypto";
import fs from "fs";
import path from "path";

const repoRoot = process.cwd();

function parseArgs(argv) {
  let manifestPath = path.join("scripts", "ci", "vendor-manifest.json");
  for (const arg of argv) {
    if (arg.startsWith("--manifest=")) {
      manifestPath = arg.slice("--manifest=".length);
    }
  }
  return manifestPath;
}

function sha256File(absolutePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

function getAllFiles(dir) {
  const output = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...getAllFiles(absolute));
    } else {
      output.push(absolute);
    }
  }
  return output;
}

function fail(violations) {
  console.error("Violaciones de integridad del vendor manifest:");
  for (const violation of violations) {
    console.error("- " + violation);
  }
  process.exit(1);
}

const manifestRelPath = parseArgs(process.argv.slice(2));
const manifestAbsPath = path.resolve(repoRoot, manifestRelPath);

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestAbsPath, "utf8"));
} catch (error) {
  fail(["manifest JSON malformado o ilegible en " + manifestRelPath + " (" + error.message + ")"]);
}

if (!Array.isArray(manifest)) {
  fail(["manifest debe ser un array JSON en " + manifestRelPath]);
}

const violations = [];
const manifestPaths = new Set();

for (const [index, entry] of manifest.entries()) {
  if (typeof entry !== "object" || entry === null) {
    violations.push("entrada #" + index + ": no es un objeto");
    continue;
  }

  if (typeof entry.path !== "string" || entry.path.length === 0) {
    violations.push("entrada #" + index + ": falta 'path'");
    continue;
  }

  manifestPaths.add(path.normalize(entry.path));

  const fileAbsPath = path.resolve(repoRoot, entry.path);
  if (!fs.existsSync(fileAbsPath) || !fs.statSync(fileAbsPath).isFile()) {
    violations.push(entry.path + ": el fichero no existe en el repositorio");
    continue;
  }

  if (typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
    violations.push(entry.path + ": 'sha256' no es un hash SHA-256 hexadecimal valido");
    continue;
  }

  const actualHash = sha256File(fileAbsPath);
  if (actualHash !== entry.sha256) {
    violations.push(
      entry.path +
        ": sha256 no coincide (manifest " +
        entry.sha256 +
        ", actual " +
        actualHash +
        ")"
    );
  }

  if (typeof entry.version !== "string" || entry.version.length === 0) {
    violations.push(entry.path + ": falta 'version'");
  }
  if (typeof entry.upstream !== "string" || entry.upstream.length === 0) {
    violations.push(entry.path + ": falta 'upstream'");
  }
}

for (const vendoredDir of ["lib", "fonts"]) {
  const dirAbsPath = path.join(repoRoot, vendoredDir);
  if (!fs.existsSync(dirAbsPath)) continue;
  const files = getAllFiles(dirAbsPath).map((f) => path.normalize(path.relative(repoRoot, f)));
  for (const filePath of files) {
    if (!manifestPaths.has(filePath)) {
      violations.push(filePath + ": fichero vendido sin entrada en el manifest");
    }
  }
}

if (violations.length > 0) {
  fail(violations);
}

console.log(
  "OK: vendor manifest verificado (" +
    manifest.length +
    " entradas, hashes y cobertura de lib/ y fonts/ correctos)."
);
