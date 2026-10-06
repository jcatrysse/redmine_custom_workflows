// Administration > Custom workflows: create (with every validation refusal), edit, (de)activate, reorder, delete.
import { e2e } from '../../.codex/e2e/lib.mjs';

const t = await e2e('admin_crud');
const p = () => t.page;
const name = `E2E made in the browser ${Date.now()}`;
const errors = async () => (await p().locator('#errorExplanation').innerText().catch(() => '')).replace(/\s+/g, ' ');

await t.login('admin');
await t.go('/custom_workflows/new');
await t.shot('new-form', 'New workflow form, observable Issue: the save scripts fieldset is closed (angle-right icon)');

// The observable select reloads the form with the fields of that observable
await p().selectOption('#custom_workflow_observable', 'group_users');
await p().waitForSelector('legend:has-text("Adding")', { timeout: 15000 }).catch(() => t.problems.push('group_users form: no add scripts fieldset'));
await t.settle();
t.check('switch observable');
await t.shot('observable-group-users', 'After choosing Group Users the form shows the add/remove script fieldsets, nothing saved yet');

await t.go('/custom_workflows/new');
await p().fill('#custom_workflow_name', '');
await p().click('input[name=commit]');
await t.settle();
t.check('create empty');
// A blank name alone is not refused (no presence validation, the same on 2.1.3); the missing script is
if (!/At least one script/i.test(await errors())) t.problems.push(`no script: ${await errors()}`);
await t.shot('error-blank', 'Refused: no script filled in (the error opens the save scripts fieldset)');

await p().fill('#custom_workflow_name', name);
await p().fill('#custom_workflow_author', 'not an address');
await p().locator('legend', { hasText: /Destroying/ }).click();
if (!(await p().locator('#custom_workflow_before_destroy').isVisible())) t.problems.push('legend click: destroy scripts not shown');
await t.shot('legend-open', 'Clicking the Destroying legend opens that fieldset and turns its icon to angle-down');
await p().fill('#custom_workflow_before_save', 'if true\n  self.subject = "x"\n');
await p().click('input[name=commit]');
await t.settle();
t.check('create invalid');
const e1 = await errors();
if (!/e-mail is invalid/i.test(e1) || !/syntax error/i.test(e1)) t.problems.push(`invalid author/script: ${e1}`);
await t.shot('error-syntax', 'Refused: invalid author address and a syntax error in the before_save script');

await p().fill('#custom_workflow_author', 'admin@example.net');
await p().fill('#custom_workflow_name', 'E2E issue');
await p().fill('#custom_workflow_before_save', "self.custom_workflow_messages[:notice] = 'browser made'");
await p().click('input[name=commit]');
await t.settle();
t.check('create duplicate');
if (!/Name has already been taken/i.test(await errors())) t.problems.push(`duplicate name: ${await errors()}`);
await t.shot('error-duplicate', 'Refused: the name is already used');

await p().fill('#custom_workflow_name', name);
await p().fill('#custom_workflow_description', 'Made by the *admin_crud* scenario.');
await p().click('input[name=commit]');
await t.settle();
t.check('create');
if (!/\/custom_workflows$/.test(p().url())) t.problems.push(`create: still on ${p().url()}: ${await errors()}`);
const row = () => p().locator('table.custom-workflows tr', { hasText: name });
if (!(await row().count())) t.problems.push('create: the new workflow is not listed');
await t.shot('created', 'Created: flash notice and the new workflow at the bottom of the list');

// Edit: limit it to one project
await row().locator('td.name a').click();
await t.settle();
await t.shot('edit-form', 'Edit form: before_save filled so its fieldset is open (angle-down), project list on the right');
await p().uncheck('#custom_workflow_is_for_all').catch(() => {});
await p().locator('#custom_workflow_enabled_projects label', { hasText: 'E2E project' }).first().locator('input').check();
await p().fill('#custom_workflow_after_save', "Rails.logger.info 'browser made after_save'");
await p().click('input[name=commit]');
await t.settle();
t.check('update');
await row().locator('td.name a').click();
await t.settle();
const checked = await p().locator('#custom_workflow_enabled_projects input[type=checkbox]:checked').count();
if (checked !== 1) t.problems.push(`update: ${checked} projects checked, expected 1`);
if ((await p().inputValue('#custom_workflow_after_save')) !== "Rails.logger.info 'browser made after_save'") t.problems.push('update: after_save not saved');
await t.shot('edited', 'After saving: one project checked and the after_save script kept');

// Deactivate and activate
await t.go('/custom_workflows');
await row().locator('a', { hasText: 'Deactivate' }).click();
await t.settle();
t.check('deactivate');
if (!(await p().locator('table.custom-workflows tr.disabled', { hasText: name }).count())) t.problems.push('deactivate: row not greyed');
await t.shot('deactivated', 'Deactivated: the row is greyed and offers Activate');
await row().locator('a', { hasText: 'Activate' }).click();
await t.settle();
t.check('activate');
if (await p().locator('table.custom-workflows tr.disabled', { hasText: name }).count()) t.problems.push('activate: row still greyed');

// Reorder: drag the new (last) row to the top
const names = async () => p().locator('table.custom-workflows td.name').allInnerTexts();
const before = await names();
await row().locator('.sort-handle').dragTo(p().locator('table.custom-workflows tbody tr').first(), { targetPosition: { x: 5, y: 2 } });
await p().waitForLoadState('load');
await t.settle();
t.check('reorder');
const after = await names();
if (after[0] !== name) t.problems.push(`reorder: first is ${after[0]} (before: ${before[0]})`);
await t.shot('reordered', 'Dragged by its handle to the top: the order is saved (the page reloads with the new order)');

// Delete, with the confirmation
p().once('dialog', d => d.accept());
await row().locator('a', { hasText: 'Delete' }).click();
await t.settle();
t.check('delete');
if (await row().count()) t.problems.push('delete: still listed');
await t.shot('deleted', 'Deleted after the confirmation: flash notice, the workflow is gone');

await t.go('/custom_workflows/999999/edit', { status: 404 });
await t.shot('missing-404', 'A workflow that does not exist answers 404');

await t.done();
