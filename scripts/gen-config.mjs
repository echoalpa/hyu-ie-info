// schema.mjs → admin/config.yml (Sveltia CMS) + .pages.yml (Pages CMS)
import fs from 'node:fs';
import yaml from 'js-yaml';
import { site, collections, files } from '../schema.mjs';

const HEADER = '# 자동 생성 파일입니다. 직접 고치지 말고 schema.mjs를 고친 뒤 `npm run gen-config`를 실행하세요.\n';

// ---------- Sveltia CMS ----------
function svField(f) {
  const o = { name: f.name, label: f.label, widget: f.widget };
  if (f.required === false) o.required = false;
  if (f.hint) o.hint = f.hint;
  if (f.readonly) o.readonly = true;
  if (f.default !== undefined) o.default = f.default;
  if (f.widget === 'select') o.options = f.options;
  if (f.widget === 'date') { o.widget = 'datetime'; o.type = 'date'; o.format = 'YYYY-MM-DD'; }
  if (f.widget === 'datetime') { o.format = 'YYYY-MM-DDTHH:mm'; }
  if (f.widget === 'number') { o.value_type = 'int'; }
  if (f.widget === 'list' && f.fields) { o.fields = f.fields.map(svField); o.summary = f.fields.some((x) => x.name === 'start') ? '{{start}} {{title}}' : `{{${f.fields[0].name}}}`; if (f.readonly) { o.allow_add = false; o.allow_remove = false; o.allow_reorder = false; } }
  return o;
}

const sveltia = {
  backend: {
    name: 'github', repo: site.repo, branch: site.branch, auth_methods: ['token'],
    commit_messages: {
      create: '{{collection}} 추가: {{slug}}', update: '{{collection}} 수정: {{slug}}',
      delete: '{{collection}} 삭제: {{slug}}', uploadMedia: '파일 업로드: {{path}}', deleteMedia: '파일 삭제: {{path}}',
    },
  },
  site_url: site.url,
  display_url: site.url,
  logo: { src: '../img/icon-512.png' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  collections: [
    ...collections.map((c) => ({
      name: c.name, label: c.label, label_singular: c.singular, description: c.description, icon: c.icon,
      folder: `content/${c.name}`, create: true, extension: 'md', format: 'frontmatter',
      slug: '{{year}}{{month}}{{day}}-{{hour}}{{minute}}{{second}}',
      preview_path: `${c.name}/{{slug}}.md`,
      summary: '{{title}}',
      editor: { preview: false },
      ...(c.columns ? { table_columns: c.columns } : {}),
      sortable_fields: c.fields.filter((f) => ['title', 'date', 'updated', 'year'].includes(f.name)).map((f) => f.name),
      view_filters: [
        { label: '공개 중', field: 'published', pattern: true },
        { label: '비공개(임시·예시)', field: 'published', pattern: false },
      ],
      fields: c.fields.map(svField),
    })),
    {
      name: 'settings', label: '설정·바로가기', icon: 'settings',
      editor: { preview: false },
      files: files.filter((f) => !f.readonly).map((f) => ({ name: f.name, label: f.label, file: f.file, fields: f.fields.map(svField) })),
    },
    // 자동으로 채워지는 데이터는 보기 전용 메뉴로 따로
    ...files.filter((f) => f.readonly).map((f) => ({
      name: f.name, label: f.label, icon: f.icon, readonly: true, editor: { preview: false },
      files: [{ name: f.name, label: f.label, file: f.file, fields: f.fields.map(svField) }],
    })),
  ],
};

// ---------- Pages CMS ----------
function pgField(f) {
  const map = { string: 'string', text: 'text', markdown: 'rich-text', boolean: 'boolean', number: 'number', select: 'select', date: 'date', datetime: 'date', list: 'string' };
  const o = { name: f.name, label: f.label, type: map[f.widget] };
  if (f.required !== false && !['boolean', 'markdown'].includes(f.widget)) o.required = true;
  if (f.hint) o.description = f.hint;
  if (f.default !== undefined && f.default !== '{{now}}') o.default = f.default;
  if (f.widget === 'select') o.options = { values: f.options };
  if (f.widget === 'markdown') o.options = { format: 'markdown' };
  if (f.widget === 'date') o.options = { format: 'yyyy-MM-dd' };
  if (f.widget === 'datetime') o.options = { time: true, format: "yyyy-MM-dd'T'HH:mm" };
  if (f.widget === 'list') {
    o.list = true;
    if (f.fields) { o.type = 'object'; o.fields = f.fields.map(pgField); }
  }
  return o;
}

const pages = {
  media: { input: 'static/uploads', output: '/uploads' },
  content: [
    ...collections.map((c) => ({
      name: c.name, label: c.label, type: 'collection', path: `content/${c.name}`,
      filename: '{year}{month}{day}-{hour}{minute}{second}.md',
      view: { fields: c.fields.filter((f) => ['title', 'date', 'category', 'published'].includes(f.name)).map((f) => f.name) },
      fields: c.fields.map(pgField),
    })),
    ...files.map((f) => ({
      name: f.name, label: f.label, type: 'file', path: f.file, format: 'yaml',
      fields: f.fields.map(pgField),
    })),
  ],
};

const dump = (o) => HEADER + yaml.dump(o, { lineWidth: 200, noRefs: true });
fs.writeFileSync('admin/config.yml', dump(sveltia));
fs.writeFileSync('.pages.yml', dump(pages));
console.log('admin/config.yml, .pages.yml 생성 완료');
