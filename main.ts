// Entry point: copy game/ and screenshots/ to the output directory and write the dossier.
// Node 22 runs this TypeScript as-is (erasable syntax only), standard library only.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-threejs.ts';

const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const here = import.meta.dirname;
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

rmSync(join(output, 'game'), { recursive: true, force: true });
rmSync(join(output, 'screenshots'), { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(join(here, 'game'), join(output, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(output, 'screenshots'), { recursive: true });
const dossier = buildDossier(output, caps);
writeFileSync(join(output, 'dossier.json'), dossier);
console.log(`siteline: wrote ${join(output, 'dossier.json')} (${dossier.byteLength} bytes)`);
