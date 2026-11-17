// node scripts/make-ota.mjs <webDir> <version> <baseUrl>
// e.g.  node scripts/make-ota.mjs www 2.5.017 https://notoz.netlify.app/ota
//
// Output (in ./ota-out):
//   notoz-<version>.zip   -> contents of webDir, index.html at zip root
//   latest.json           -> { version, url, native }
//
// `native` = the native build number the zip is compatible with. Bump it
// (NATIVE_VERSION env or package.json "nativeVersion") only when you change
// plugins / permissions / Capacitor version. Older installed shells will then
// know they need a full APK instead of an OTA zip.

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [webDir = 'www', version, baseUrl] = process.argv.slice(2);
if (!version || !baseUrl) {
  console.error('usage: make-ota.mjs <webDir> <version> <baseUrl>');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const native = process.env.NATIVE_VERSION || pkg.nativeVersion || '1';

const out = 'ota-out';
mkdirSync(out, { recursive: true });

const zipName = `notoz-${version}.zip`;
const zipPath = path.resolve(out, zipName);

// cd INTO webDir so index.html lands at the zip root
if (process.platform === 'win32') {
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path * -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`, { cwd: webDir, stdio: 'inherit' });
} else {
  execSync(`zip -r -q "${zipPath}" .`, { cwd: webDir, stdio: 'inherit' });
}

// Compute SHA-256 checksum of the generated zip bundle (required by Capgo updater)
const zipBytes = readFileSync(zipPath);
const checksum = createHash('sha256').update(zipBytes).digest('hex');

const manifest = {
  version,
  native,
  checksum,
  url: `${baseUrl.replace(/\/$/, '')}/${zipName}`,
};
writeFileSync(path.join(out, 'latest.json'), JSON.stringify(manifest, null, 2));
console.log('OTA bundle ready with checksum:', manifest);
