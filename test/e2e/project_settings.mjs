// Project settings > Custom workflows tab (permission manage_project_workflow): enable a workflow for one project,
// and the refusals without the permission.
import { e2e } from '../../.codex/e2e/lib.mjs';

const t = await e2e('project_settings');
const p = () => t.page;
const tab = '/projects/e2e-project/settings/custom_workflows';
const exact = name => new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\s*(\\(|$)`);
const box = name => p().locator('#tab-content-custom_workflows label', { hasText: exact(name) }).locator('input[type=checkbox]');

async function editSubject(subject) {
  await t.go('/issues/1/edit');
  await p().fill('#issue_subject', subject);
  await Promise.all([p().waitForNavigation(), p().click('#issue-form input[name=commit]')]);
  await t.settle();
}

await t.login('manager');
await t.go(tab);
if (!(await p().locator('#tab-custom_workflows').count())) t.problems.push('manager: no Custom workflows tab');
if (!(await box('E2E issue').isDisabled()) || !(await box('E2E issue').isChecked())) t.problems.push('is_for_all workflow not checked and disabled');
if (!(await p().locator('#tab-content-custom_workflows dt.disabled', { hasText: 'E2E inactive' }).count())) t.problems.push('inactive workflow not greyed');
if (await p().locator('#tab-content-custom_workflows label', { hasText: 'E2E user' }).count()) t.problems.push('a non-project workflow (user) is listed');
await box('E2E project only').uncheck();
await p().locator('#tab-content-custom_workflows input[type=submit]').click();
await t.settle();
await t.shot('tab', 'Manager: the tab lists the project workflows; for-all ones checked and locked, the inactive one greyed');

await editSubject('E2E assigned issue [project-only]');
if (await p().locator('#flash_warning', { hasText: 'project-only' }).count()) t.problems.push('project-only workflow ran while not enabled');
await t.shot('not-enabled', 'Not enabled for this project: saving the issue does not run "E2E project only"');

await t.go(tab);
await box('E2E project only').check();
await Promise.all([p().waitForNavigation(), p().locator('#tab-content-custom_workflows input[type=submit]').click()]);
await t.settle();
t.check('save tab');
if (!(await p().locator('#flash_notice').count())) t.problems.push('save tab: no notice');
if (!/\/settings\/custom_workflows$/.test(p().url())) t.problems.push(`save tab: back on ${p().url()}, not on the tab`);
if (!(await box('E2E project only').isChecked())) t.problems.push('save tab: workflow not enabled');
await t.shot('enabled', 'Saved: notice, back on the Custom workflows tab, "E2E project only" enabled');

await editSubject('E2E assigned issue [project-only] again');
if (!(await p().locator('#flash_warning', { hasText: 'project-only workflow ran' }).count())) t.problems.push('project-only workflow did not run once enabled');
await t.shot('runs', 'Enabled: saving an issue of this project now runs it (warning flash)');
await editSubject('E2E assigned issue');

await t.login('reporter');
await t.go(tab, { status: 403 });
await t.shot('reporter-refused', 'Reporter (no project settings permission) is refused');

// e2e-private: reporter may edit the project but lacks manage_project_workflow
await t.go('/projects/e2e-private/settings');
if (await p().locator('#tab-custom_workflows').count()) t.problems.push('reporter: tab shown without the permission');
await t.shot('no-tab', 'With every permission but "Manage project workflows": the settings have no Custom workflows tab');
// a forged custom_workflow_ids in the project form is ignored (safe_attributes)
await p().evaluate(() => {
  const f = document.querySelector('#tab-content-info form');
  const i = document.createElement('input');
  i.type = 'hidden'; i.name = 'project[custom_workflow_ids][]'; i.value = '1'; f.appendChild(i);
});
await Promise.all([p().waitForNavigation(), p().locator('#tab-content-info input[type=submit]').click()]);
await t.settle();
t.check('forged submit');
await t.login('admin');
await t.go('/projects/e2e-private/settings/custom_workflows');
if (await box('Duration/Done Ratio/Status correlation').isChecked()) t.problems.push('forged custom_workflow_ids was saved');
await t.shot('forged-ignored', `A forged custom_workflow_ids from that user was ignored: nothing enabled for e2e-private`);

await t.login('outsider');
await t.go('/projects/e2e-private/settings/custom_workflows', { status: 403 });
await t.shot('outsider-refused', 'A non-member is refused the private project');

await t.done();
