// admin/config.yml 이 Sveltia CMS 스키마에 맞는지 검사 (스키마 파일이 있을 때만)
import fs from 'node:fs';
import yaml from 'js-yaml';
import Ajv from 'ajv';
const schemaPath = process.argv[2];
if (!schemaPath || !fs.existsSync(schemaPath)) { console.log('사용법: node scripts/check-config.mjs <sveltia-cms.json>'); process.exit(0); }
const ajv = new Ajv({ allErrors: true, strict: false });
const ok = ajv.validate(JSON.parse(fs.readFileSync(schemaPath, 'utf8')), yaml.load(fs.readFileSync('admin/config.yml', 'utf8')));
console.log(ok ? 'config OK' : ajv.errors.slice(0, 20));
process.exit(ok ? 0 : 1);
