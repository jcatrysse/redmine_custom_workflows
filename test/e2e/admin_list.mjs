// Administration > Custom workflows: the list, the menu entry, and who may see it.
import { e2e } from '../../.codex/e2e/lib.mjs';

const t = await e2e('admin_list');

await t.login('admin');
await t.go('/admin');
if (!(await t.page.locator('#admin-menu a.custom-workflows, #admin-menu a[href="/custom_workflows"]').count())) {
  t.problems.push('admin menu: no Custom workflows entry');
}
await t.shot('admin-menu', 'Administration menu with the Custom workflows entry and its icon', { full: false });

await t.go('/custom_workflows');
const rows = await t.page.locator('table.custom-workflows tbody tr').count();
if (rows < 17) t.problems.push(`list: ${rows} rows, expected the 17 seeded workflows at least`);
if (!(await t.page.locator('table.custom-workflows tr.disabled td.name', { hasText: 'E2E inactive' }).count())) {
  t.problems.push('list: the inactive workflow is not greyed out');
}
if ((await t.page.locator('table.custom-workflows td.buttons svg').count()) < rows * 3) {
  t.problems.push('list: action icons are not SVG');
}
await t.shot('list', 'All workflows in order, inactive one greyed, SVG icons for reorder, (de)activate, export, delete');

await t.page.click('.contextual .drdn-trigger');
await t.shot('actions-menu', 'The actions menu with Import', { full: false });

await t.login('manager');
await t.go('/custom_workflows', { status: 403 });
await t.shot('manager-refused', 'A project manager with every project permission is refused: administrators only');

await t.login('reporter');
await t.go('/custom_workflows/new', { status: 403 });
await t.shot('reporter-refused', 'A member without the plugin permission is refused the new form');

await t.anonymous();
await t.go('/custom_workflows');
if (!new URL(t.page.url()).pathname.startsWith('/login')) t.problems.push(`anonymous: not sent to login (${t.page.url()})`);
await t.shot('anonymous-login', 'Anonymous is sent to the login page');

await t.done();
