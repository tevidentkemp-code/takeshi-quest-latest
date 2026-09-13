import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const CONTRACT_REL = 'src/core-js-source-contract.json';
const BOOTSTRAP_REL = 'src/core-domain-manifest.json';
const RUNTIME_REL = 'src/legacy/scripts/inline-005.js';
const EXPECTED_DOMAINS = 10;
const MAX_DOMAIN_BYTES = 500000;

function fail(message) {
  console.error(`SC-031 JS source build FAILED: ${message}`);
  process.exit(1);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function bytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function safeRel(value, label) {
  if (typeof value !== 'string' || !value) fail(`${label} path is missing`);
  const unix = value.replaceAll('\\', '/');
  const normalized = path.posix.normalize(unix);
  if (normalized !== unix || normalized.startsWith('../') || normalized.startsWith('/')) {
    fail(`${label} path is unsafe or non-canonical: ${value}`);
  }
  return normalized;
}

function abs(rel) {
  const normalized = safeRel(rel, 'repository');
  const resolved = path.resolve(ROOT, normalized);
  const prefix = `${path.resolve(ROOT)}${path.sep}`;
  if (!resolved.startsWith(prefix)) fail(`path escapes repository root: ${rel}`);
  return resolved;
}

function read(rel) {
  const file = abs(rel);
  if (!fs.existsSync(file)) fail(`required file is missing: ${rel}`);
  return fs.readFileSync(file, 'utf8');
}

function write(rel, content) {
  const file = abs(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function syntaxCheckFile(rel) {
  try {
    execFileSync(process.execPath, ['--check', abs(rel)], { stdio: 'pipe' });
  } catch (error) {
    const detail = error?.stderr?.toString?.() || error?.message || String(error);
    fail(`JavaScript syntax check failed for ${rel}:\n${detail}`);
  }
}

function syntaxCheckText(text, label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-sc031-js-'));
  const file = path.join(dir, 'runtime.js');
  try {
    fs.writeFileSync(file, text, 'utf8');
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    const detail = error?.stderr?.toString?.() || error?.message || String(error);
    fail(`JavaScript syntax check failed for ${label}:\n${detail}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = { bootstrapContract: false, verifyCurrent: false, output: null, evidence: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--bootstrap-contract') {
      options.bootstrapContract = true;
    } else if (arg === '--verify-current') {
      options.verifyCurrent = true;
    } else if (arg === '--output' || arg === '--evidence') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) fail(`${arg} requires a repository-relative path`);
      options[arg.slice(2)] = safeRel(value, arg.slice(2));
      i += 1;
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function validateDomainShape(domain, index, seen) {
  if (!domain || domain.order !== index + 1) fail(`non-contiguous JS domain order at position ${index + 1}`);
  if (typeof domain.owner !== 'string' || !domain.owner) fail(`missing JS owner at position ${index + 1}`);
  if (typeof domain.marker !== 'string' || !domain.marker.startsWith('@SEC:JS:')) {
    fail(`invalid JS marker at position ${index + 1}`);
  }
  if (!Number.isInteger(domain.occurrence) || domain.occurrence < 1) {
    fail(`invalid JS marker occurrence at position ${index + 1}`);
  }
  const file = safeRel(domain.file, 'JS domain');
  if (!file.startsWith('src/')) fail(`JS domain must remain under src/: ${file}`);
  const allowed = [
    'src/app/',
    'src/live-game/',
    'src/game/',
    'src/services/',
    'src/ui/',
    'src/legacy/quarantine/',
  ];
  if (!allowed.some((prefix) => file.startsWith(prefix))) {
    fail(`JS domain is outside approved source roots: ${file}`);
  }
  if (seen.has(file)) fail(`duplicate JS domain file: ${file}`);
  seen.add(file);
}

function bootstrapContract() {
  const bootstrap = JSON.parse(read(BOOTSTRAP_REL));
  if (bootstrap.schemaVersion !== 1) fail(`unsupported bootstrap JS schemaVersion: ${bootstrap.schemaVersion}`);
  if (bootstrap.generatedBy !== 'scripts/split-core-domains.mjs') {
    fail(`unexpected bootstrap JS generator: ${bootstrap.generatedBy}`);
  }
  if (bootstrap.strategy !== 'semantic-source-byte-identical-classic-runtime') {
    fail(`unexpected bootstrap JS strategy: ${bootstrap.strategy}`);
  }
  if (!Array.isArray(bootstrap.domains) || bootstrap.domains.length !== EXPECTED_DOMAINS) {
    fail(`bootstrap JS must contain exactly ${EXPECTED_DOMAINS} domains`);
  }

  const runtimeTarget = safeRel(bootstrap.runtimeTarget, 'runtimeTarget');
  if (runtimeTarget !== RUNTIME_REL) fail(`unexpected bootstrap JS compatibility runtime: ${runtimeTarget}`);
  const runtime = read(runtimeTarget);
  if (bytes(runtime) !== bootstrap.runtimeBytes || sha256(runtime) !== bootstrap.runtimeSha256) {
    fail('current JS compatibility runtime differs from verified bootstrap evidence');
  }
  syntaxCheckFile(runtimeTarget);

  const seen = new Set();
  const parts = [];
  for (let i = 0; i < bootstrap.domains.length; i += 1) {
    const domain = bootstrap.domains[i];
    validateDomainShape(domain, i, seen);
    const source = read(domain.file);
    if (bytes(source) !== domain.bytes || sha256(source) !== domain.sha256) {
      fail(`JS source differs from verified bootstrap evidence: ${domain.file}`);
    }
    if (!source.includes(domain.marker)) fail(`JS source lost protected marker: ${domain.file}`);
    syntaxCheckFile(domain.file);
    parts.push(source);
  }

  const rebuilt = parts.join('');
  if (rebuilt !== runtime) fail('verified JS source does not reconstruct compatibility runtime at bootstrap');

  const contract = {
    schemaVersion: 1,
    authority: 'semantic-js-source',
    generatedBy: 'scripts/build-core-js-from-source.mjs',
    runtimeTarget,
    domainCount: bootstrap.domains.length,
    domains: bootstrap.domains.map(({ order, marker, occurrence, owner, file }) => ({
      order,
      marker,
      occurrence,
      owner,
      file,
    })),
    bootstrapEvidence: {
      source: BOOTSTRAP_REL,
      runtimeBytes: bootstrap.runtimeBytes,
      runtimeSha256: bootstrap.runtimeSha256,
    },
  };
  write(CONTRACT_REL, `${JSON.stringify(contract, null, 2)}\n`);
  return contract;
}

function loadContract(options) {
  if (fs.existsSync(abs(CONTRACT_REL))) return JSON.parse(read(CONTRACT_REL));
  if (!options.bootstrapContract) {
    fail(`${CONTRACT_REL} is missing; --bootstrap-contract is allowed only at the verified JS authority transition`);
  }
  return bootstrapContract();
}

function validateContract(contract) {
  if (contract.schemaVersion !== 1) fail(`unsupported JS source contract schemaVersion: ${contract.schemaVersion}`);
  if (contract.authority !== 'semantic-js-source') fail(`unexpected JS authority: ${contract.authority}`);
  if (contract.generatedBy !== 'scripts/build-core-js-from-source.mjs') {
    fail(`unexpected JS generator: ${contract.generatedBy}`);
  }
  const runtimeTarget = safeRel(contract.runtimeTarget, 'runtimeTarget');
  if (runtimeTarget !== RUNTIME_REL) fail(`unexpected JS compatibility runtime: ${runtimeTarget}`);
  if (!Array.isArray(contract.domains) || contract.domains.length !== EXPECTED_DOMAINS) {
    fail(`JS source contract must contain exactly ${EXPECTED_DOMAINS} domains`);
  }
  if (contract.domainCount !== contract.domains.length) fail('JS source contract domainCount mismatch');
  const seen = new Set();
  contract.domains.forEach((domain, index) => validateDomainShape(domain, index, seen));
}

const options = parseArgs(process.argv.slice(2));
const contract = loadContract(options);
validateContract(contract);
const contractText = read(CONTRACT_REL);

const parts = [];
const domainEvidence = [];
for (const domain of contract.domains) {
  const source = read(domain.file);
  const sourceBytes = bytes(source);
  if (sourceBytes === 0) fail(`empty JS source domain: ${domain.file}`);
  if (sourceBytes > MAX_DOMAIN_BYTES) {
    fail(`${domain.file} exceeds ${MAX_DOMAIN_BYTES}-byte domain budget (${sourceBytes})`);
  }
  if (!source.includes(domain.marker)) fail(`JS source lost protected marker: ${domain.file}`);
  syntaxCheckFile(domain.file);
  parts.push(source);
  domainEvidence.push({
    order: domain.order,
    marker: domain.marker,
    occurrence: domain.occurrence,
    owner: domain.owner,
    file: domain.file,
    bytes: sourceBytes,
    sha256: sha256(source),
  });
}

const runtime = parts.join('');
syntaxCheckText(runtime, contract.runtimeTarget);

let currentRuntimeMatch = null;
if (options.verifyCurrent) {
  const current = read(contract.runtimeTarget);
  currentRuntimeMatch = current === runtime;
  if (!currentRuntimeMatch) fail(`source-generated JS differs from current ${contract.runtimeTarget}`);
}

if (options.output) write(options.output, runtime);

const evidence = {
  schemaVersion: 1,
  generatedBy: 'scripts/build-core-js-from-source.mjs',
  authority: contract.authority,
  contract: CONTRACT_REL,
  contractSha256: sha256(contractText),
  runtimeTarget: contract.runtimeTarget,
  runtimeBytes: bytes(runtime),
  runtimeSha256: sha256(runtime),
  domainCount: domainEvidence.length,
  domains: domainEvidence,
  verifyCurrent: options.verifyCurrent,
  currentRuntimeMatch,
};

if (options.evidence) write(options.evidence, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
