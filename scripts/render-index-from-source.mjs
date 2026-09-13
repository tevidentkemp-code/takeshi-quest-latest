import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const contractRel = 'src/shell/source-contract.json';
const bootstrapRel = 'src/shell/shell-manifest.json';
const defaultRuntimeRel = 'index.html';

function fail(message) {
  console.error(`SC-031 source build FAILED: ${message}`);
  process.exit(1);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function bytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function safeRel(rel, label) {
  if (typeof rel !== 'string' || !rel) fail(`${label} path is missing`);
  const normalized = path.posix.normalize(rel.replaceAll('\\', '/'));
  if (normalized !== rel.replaceAll('\\', '/') || normalized.startsWith('../') || normalized.startsWith('/')) {
    fail(`${label} path is unsafe or non-canonical: ${rel}`);
  }
  return normalized;
}

function abs(rel) {
  const normalized = safeRel(rel, 'repository');
  const resolved = path.resolve(root, normalized);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  if (!resolved.startsWith(rootPrefix)) fail(`path escapes repository root: ${rel}`);
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

function count(value, token) {
  let total = 0;
  let from = 0;
  while (true) {
    const at = value.indexOf(token, from);
    if (at < 0) return total;
    total += 1;
    from = at + token.length;
  }
}

function hasId(html, id) {
  return html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
}

function parseArgs(argv) {
  const options = {
    bootstrapContract: false,
    verifyCurrent: false,
    output: null,
    evidence: null,
  };
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

function bootstrapContract() {
  const bootstrap = JSON.parse(read(bootstrapRel));
  if (bootstrap.schemaVersion !== 1) fail(`unsupported bootstrap shell schemaVersion: ${bootstrap.schemaVersion}`);
  if (bootstrap.stage !== 'source-promotion-only') fail(`unexpected bootstrap shell stage: ${bootstrap.stage}`);
  if (bootstrap.runtimeChanged !== false || bootstrap.sourceAuthorityChanged !== false) {
    fail('bootstrap shell is not the verified pre-inversion checkpoint');
  }
  if (!Array.isArray(bootstrap.fragments) || bootstrap.fragments.length === 0) fail('bootstrap shell has no fragments');
  if (bootstrap.fragmentCount !== bootstrap.fragments.length) fail('bootstrap fragmentCount mismatch');

  const template = read(bootstrap.template);
  if (bytes(template) !== bootstrap.templateEvidence?.bytes || sha256(template) !== bootstrap.templateEvidence?.sha256) {
    fail('bootstrap template differs from verified shell evidence');
  }

  for (const fragment of bootstrap.fragments) {
    const source = read(fragment.file);
    if (bytes(source) !== fragment.bytes || sha256(source) !== fragment.sha256) {
      fail(`bootstrap fragment differs from verified shell evidence: ${fragment.file}`);
    }
  }

  const contract = {
    schemaVersion: 1,
    authority: 'split-source',
    generatedBy: 'scripts/render-index-from-source.mjs',
    template: bootstrap.template,
    generatedRuntime: bootstrap.currentRuntime || defaultRuntimeRel,
    fragmentCount: bootstrap.fragments.length,
    fragments: bootstrap.fragments.map((fragment) => ({
      file: fragment.file,
      token: fragment.token,
      protectedIds: Array.isArray(fragment.protectedIds) ? fragment.protectedIds : [],
    })),
    bootstrapEvidence: {
      source: bootstrapRel,
      runtimeBytes: bootstrap.index?.bytes ?? null,
      runtimeSha256: bootstrap.index?.sha256 ?? null,
      templateBytes: bootstrap.templateEvidence?.bytes ?? null,
      templateSha256: bootstrap.templateEvidence?.sha256 ?? null,
    },
  };
  write(contractRel, `${JSON.stringify(contract, null, 2)}\n`);
  return contract;
}

function loadContract(options) {
  if (fs.existsSync(abs(contractRel))) return JSON.parse(read(contractRel));
  if (!options.bootstrapContract) fail(`${contractRel} is missing; use --bootstrap-contract only for the verified inversion checkpoint`);
  return bootstrapContract();
}

function validateContract(contract) {
  if (contract.schemaVersion !== 1) fail(`unsupported source contract schemaVersion: ${contract.schemaVersion}`);
  if (contract.authority !== 'split-source') fail(`unexpected source authority: ${contract.authority}`);
  if (contract.generatedBy !== 'scripts/render-index-from-source.mjs') fail(`unexpected contract generator: ${contract.generatedBy}`);
  safeRel(contract.template, 'template');
  safeRel(contract.generatedRuntime, 'generatedRuntime');
  if (!Array.isArray(contract.fragments) || contract.fragments.length === 0) fail('source contract has no fragments');
  if (contract.fragmentCount !== contract.fragments.length) fail('source contract fragmentCount mismatch');

  const files = new Set();
  const tokens = new Set();
  const protectedIds = new Set();
  for (const fragment of contract.fragments) {
    safeRel(fragment.file, 'fragment');
    const expectedToken = `<!-- @SQ:SOURCE ${fragment.file} -->`;
    if (fragment.token !== expectedToken) fail(`token/file mismatch for ${fragment.file}`);
    if (files.has(fragment.file)) fail(`duplicate fragment file: ${fragment.file}`);
    if (tokens.has(fragment.token)) fail(`duplicate source token: ${fragment.token}`);
    files.add(fragment.file);
    tokens.add(fragment.token);
    if (!Array.isArray(fragment.protectedIds)) fail(`protectedIds must be an array: ${fragment.file}`);
    for (const id of fragment.protectedIds) {
      if (typeof id !== 'string' || !id) fail(`invalid protected id in ${fragment.file}`);
      if (protectedIds.has(id)) fail(`protected id is owned by more than one fragment: ${id}`);
      protectedIds.add(id);
    }
  }
}

const options = parseArgs(process.argv.slice(2));
const contract = loadContract(options);
validateContract(contract);

const contractText = read(contractRel);
const template = read(contract.template);
const tokenRegex = /<!-- @SQ:SOURCE ([^>]+?) -->/g;
const templateTokens = [...template.matchAll(tokenRegex)].map((match) => match[0]);
const expectedTokens = contract.fragments.map((fragment) => fragment.token);

if (templateTokens.length !== expectedTokens.length) {
  fail(`template contains ${templateTokens.length} source tokens; contract expects ${expectedTokens.length}`);
}
for (let i = 0; i < expectedTokens.length; i += 1) {
  if (templateTokens[i] !== expectedTokens[i]) fail(`template source-token order differs at position ${i + 1}`);
  if (count(template, expectedTokens[i]) !== 1) fail(`source token must occur exactly once: ${expectedTokens[i]}`);
}

let runtime = template;
const fragmentEvidence = [];
for (const fragment of contract.fragments) {
  const source = read(fragment.file);
  for (const id of fragment.protectedIds) {
    if (!hasId(source, id)) fail(`protected id ${id} is missing from ${fragment.file}`);
  }
  runtime = runtime.replace(fragment.token, source);
  fragmentEvidence.push({
    file: fragment.file,
    bytes: bytes(source),
    sha256: sha256(source),
    protectedIds: fragment.protectedIds.length,
  });
}

if ([...runtime.matchAll(tokenRegex)].length !== 0) fail('generated runtime still contains source tokens');

let currentRuntimeMatch = null;
const runtimeRel = contract.generatedRuntime || defaultRuntimeRel;
if (options.verifyCurrent) {
  const current = read(runtimeRel);
  currentRuntimeMatch = runtime === current;
  if (!currentRuntimeMatch) fail(`source-generated runtime differs from current ${runtimeRel}`);
}

if (options.output) write(options.output, runtime);

const evidence = {
  schemaVersion: 1,
  generatedBy: 'scripts/render-index-from-source.mjs',
  authority: 'split-source',
  contract: contractRel,
  contractSha256: sha256(contractText),
  template: contract.template,
  templateBytes: bytes(template),
  templateSha256: sha256(template),
  generatedRuntime: runtimeRel,
  runtimeBytes: bytes(runtime),
  runtimeSha256: sha256(runtime),
  fragmentCount: fragmentEvidence.length,
  fragments: fragmentEvidence,
  verifyCurrent: options.verifyCurrent,
  currentRuntimeMatch,
};

if (options.evidence) write(options.evidence, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
