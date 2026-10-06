// Administration > Custom workflows: export as XML, import (an export made by 2.1.3 on Redmine 5.1, a round trip,
// an invalid file), and the refusal for a non-admin.
import fs from 'node:fs';
import { e2e } from '../../.codex/e2e/lib.mjs';

const t = await e2e('export_import');
const p = () => t.page;
const out = process.env.RMP_E2E_OUT || 'docs/e2e';

async function importFile(file, caption, shot) {
  await t.go('/custom_workflows');
  await p().click('.contextual .drdn-trigger');
  await p().click('text=Import workflow');
  await p().setInputFiles('#import-dialog input[type=file]', file);
  await t.shot(`${shot}-dialog`, `Import dialog with ${caption}`, { full: false });
  await Promise.all([p().waitForNavigation(), p().click('#import-dialog input[type=submit][value=Import]')]);
  await t.settle();
  t.check(`import ${shot}`);
}

await t.login('admin');
await t.go('/custom_workflows');
const [download] = await Promise.all([
  p().waitForEvent('download'),
  p().locator('table.custom-workflows tr').filter({ has: p().locator('td.name a', { hasText: /^E2E issue relation$/ }) })
    .locator('a', { hasText: 'Export' }).click(),
]);
const exported = `${out}/export_import-download.xml`;
await download.saveAs(exported);
const xml = fs.readFileSync(exported, 'utf8');
if (download.suggestedFilename() !== 'E2E issue relation.xml') t.problems.push(`export: file name ${download.suggestedFilename()}`);
if (!/<observable>issue_relation<\/observable>/.test(xml) || !/<plugin-version>3\.1\.1<\/plugin-version>/.test(xml)) {
  t.problems.push('export: XML without observable or plugin version');
}
await t.shot('export', `Export clicked: "${download.suggestedFilename()}" downloaded (${xml.length} bytes, saved next to the screenshots)`, { full: false });

const stamp = Date.now();
const old = fs.readFileSync('test/fixtures/files/custom_workflow_2.1.3.xml', 'utf8')
  .replace('GEOxyz 5.x export', `E2E import from 2.1.3 ${stamp}`);
const oldFile = `/tmp/e2e-import-2.1.3-${stamp}.xml`;
fs.writeFileSync(oldFile, old);
await importFile(oldFile, 'an export made by plugin 2.1.3 on Redmine 5.1', 'from-2-1-3');
if (!(await p().locator('#flash_notice').count())) t.problems.push(`import 2.1.3: no notice (${await p().locator('#flash_error').innerText().catch(() => '')})`);
const imported = p().locator('table.custom-workflows tr.disabled', { hasText: `E2E import from 2.1.3 ${stamp}` });
if (!(await imported.count())) t.problems.push('import 2.1.3: not listed as inactive');
await t.shot('from-2-1-3', 'Imported: success notice, the workflow is listed and inactive until an admin activates it');

await imported.locator('td.name a').click();
await t.settle();
if (!/from 5\.x/.test(await p().inputValue('#custom_workflow_before_save'))) t.problems.push('import 2.1.3: before_save lost');
await t.shot('from-2-1-3-edit', 'The imported workflow keeps its scripts, author and description');

const copies = async () => p().locator('table.custom-workflows td.name', { hasText: /^E2E issue relation_\d+$/ }).count();
await t.go('/custom_workflows');
const copiesBefore = await copies();
await importFile(exported, 'the export just downloaded', 'round-trip');
if ((await copies()) !== copiesBefore + 1) t.problems.push('round trip: no new copy with a _n suffix');
await t.shot('round-trip', 'Re-importing an export of an existing workflow adds a copy named "..._1", inactive');

const bad = `/tmp/e2e-import-bad-${stamp}.xml`;
fs.writeFileSync(bad, 'this is not XML <<<');
await importFile(bad, 'a file that is not XML', 'invalid');
if (!/Error importing/i.test(await p().locator('#flash_error').innerText().catch(() => ''))) t.problems.push('invalid import: no error shown');
await t.shot('invalid', 'An invalid file is refused with an error, nothing is added');

const bogus = `/tmp/e2e-import-bogus-${stamp}.xml`;
fs.writeFileSync(bogus, old.replace(/<before-save>.*<\/before-save>/, '<before-save>if true</before-save>').replace(`${stamp}`, `${stamp} bad`)
  .replace('<active type="boolean">true</active>', '<active type="boolean">true</active>'));
await importFile(bogus, 'a workflow whose script has a syntax error', 'syntax');
await t.shot('syntax', 'Imported inactive even with a syntax error (scripts are only checked for active workflows)');

await t.login('manager');
const res = await p().request.get(`${t.BASE}/custom_workflows/1/export`);
if (res.status() !== 403) t.problems.push(`export as manager: HTTP ${res.status()}`);
await t.go('/custom_workflows/1/export', { status: 403 });
await t.shot('manager-refused', `Export as a non-admin: HTTP ${res.status()}`);

await t.done();
