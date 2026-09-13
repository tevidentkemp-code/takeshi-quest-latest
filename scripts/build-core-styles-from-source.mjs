import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

const ROOT = process.cwd();
const CONTRACT_REL = 'src/styles/core-source-contract.json';
const BOOTSTRAP_REL = 'src/styles/core-source-manifest.json';
const RUNTIME_REL = 'src/legacy/styles/inline-002.css';
const EXPECTED_DOMAINS = 27;
const MAX_DOMAIN_BYTES = 60000;

function fail(message) {
  console.error(`SC-031 CSS source build FAILED: ${message}`);
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

function parseCss(text, file) {
  try {
    postcss.parse(text, { from: file });
  } catch (error) {
    fail(`CSS parse failed for ${file}: ${error?.message || error}`);
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
  if (!domain || domain.order !== index + 1) fail(`non-contiguous CSS domain order at position ${index + 1}`);
  if (typeof domain.owner !== 'string' || !domain.owner) fail(`missing CSS owner at position ${index + 1}`);
  const file = safeRel(domain.file, 'CSS domain');
  if (!file.startsWith('src/styles/')) fail(`CSS domain must remain under src/styles: ${file}`);
  if (seen.has(file)) fail(`duplicate CSS domain file: ${file}`);
  seen.add(file);
  if (domain.anchor !== null && (typeof domain.anchor !== 'string' || !domain.anchor.startsWith('/*'))) {
    fail(`invalid CSS domain anchor for ${file}`);
  }
  if (domain.anchor === null && index !== 0) fail(`only first CSS domain may omit an anchor: ${file}`);
}

function bootstrapContract() {
  const bootstrap = JSON.parse(read(BOOTSTRAP_REL));
  if (bootstrap.schemaVersion !== 2) fail(`unsupported bootstrap CSS schemaVersion: ${bootstrap.schemaVersion}`);
  if (bootstrap.generatedBy !== 'scripts/split-core-styles-v2.mjs') fail(`unexpected bootstrap CSS generator: ${bootstrap.generatedBy}`);
  if (bootstrap.stage !== 'semantic-source-ownership') fail(`unexpected bootstrap CSS stage: ${bootstrap.stage}`);
  if (bootstrap.strategy !== '27-semantic-sources-byte-identical-compatibility-runtime') {
    fail(`unexpected bootstrap CSS strategy: ${bootstrap.strategy}`);
  }
  if (!Array.isArray(bootstrap.domains) || bootstrap.domains.length !== EXPECTED_DOMAINS) {
    fail(`bootstrap CSS must contain exactly ${EXPECTED_DOMAINS} domains`);
  }
  if (bootstrap.domainCount !== bootstrap.domains.length) fail('bootstrap CSS domainCount mismatch');

  const runtimeTarget = safeRel(bootstrap.runtimeTarget, 'runtimeTarget');
  if (runtimeTarget !== RUNTIME_REL) fail(`unexpected bootstrap compatibility runtime: ${runtimeTarget}`);
  const runtime = read(runtimeTarget);
  if (bytes(runtime) !== bootstrap.runtimeBytes || sha256(runtime) !== bootstrap.runtimeSha256) {
    fail('current CSS compatibility runtime differs from verified bootstrap evidence');
  }
  parseCss(runtime, runtimeTarget);

  const seen = new Set();
  const parts = [];
  for (let i = 0; i < bootstrap.domains.length; i += 1) {
    const domain = bootstrap.domains[i];
    validateDomainShape(domain, i, seen);
    const source = read(domain.file);
    if (bytes(source) !== domain.bytes || sha256(source) !== domain.sha256) {
      fail(`CSS source differs from verified bootstrap evidence: ${domain.file}`);
    }
    if (domain.anchor && !source.startsWith(domain.anchor)) fail(`CSS source lost protected anchor: ${domain.file}`);
    parseCss(source, domain.file);
    parts.push(source);
  }

  const rebuilt = parts.join('');
  if (rebuilt !== runtime) fail('verified CSS source does not reconstruct compatibility runtime at bootstrap');

  const contract = {
    schemaVersion: 1,
    authority: 'semantic-css-source',
    generatedBy: 'scripts/build-core-styles-from-source.mjs',
    runtimeTarget,
    domainCount: bootstrap.domains.length,
    domains: bootstrap.domains.map(({ order, owner, file, anchor }) => ({ order, owner, file, anchor })),
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
    fail(`${CONTRACT_REL} is missing; --bootstrap-contract is allowed only at the verified CSS authority transition`);
  }
  return bootstrapContract();
}

function validateContract(contract) {
  if (contract.schemaVersion !== 1) fail(`unsupported CSS source contract schemaVersion: ${contract.schemaVersion}`);
  if (contract.authority !== 'semantic-css-source') fail(`unexpected CSS authority: ${contract.authority}`);
  if (contract.generatedBy !== 'scripts/build-core-styles-from-source.mjs') fail(`unexpected CSS generator: ${contract.generatedBy}`);
  const runtimeTarget = safeRel(contract.runtimeTarget, 'runtimeTarget');
  if (runtimeTarget !== RUNTIME_REL) fail(`unexpected CSS compatibility runtime: ${runtimeTarget}`);
  if (!Array.isArray(contract.domains) || contract.domains.length !== EXPECTED_DOMAINS) {
    fail(`CSS source contract must contain exactly ${EXPECTED_DOMAINS} domains`);
  }
  if (contract.domainCount !== contract.domains.length) fail('CSS source contract domainCount mismatch');
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
  if (sourceBytes === 0) fail(`empty CSS source domain: ${domain.file}`);
  if (sourceBytes > MAX_DOMAIN_BYTES) fail(`${domain.file} exceeds ${MAX_DOMAIN_BYTES}-byte domain budget (${sourceBytes})`);
  if (domain.anchor && !source.startsWith(domain.anchor)) fail(`CSS source lost protected anchor: ${domain.file}`);
  parseCss(source, domain.file);
  parts.push(source);
  domainEvidence.push({
    order: domain.order,
    owner: domain.owner,
    file: domain.file,
    bytes: sourceBytes,
    sha256: sha256(source),
  });
}

const runtime = parts.join('');
parseCss(runtime, contract.runtimeTarget);

let currentRuntimeMatch = null;
if (options.verifyCurrent) {
  const current = read(contract.runtimeTarget);
  currentRuntimeMatch = current === runtime;
  if (!currentRuntimeMatch) fail(`source-generated CSS differs from current ${contract.runtimeTarget}`);
}

if (options.output) write(options.output, runtime);

const evidence = {
  schemaVersion: 1,
  generatedBy: 'scripts/build-core-styles-from-source.mjs',
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
