// The other observable objects through their own core pages: version, time entry, project, wiki content, user,
// group, attachment. Each has a workflow that shows a notice when it runs and refuses "[refuse]" (test/e2e/seed.rb).
import { e2e } from '../../.codex/e2e/lib.mjs';

const t = await e2e('observables');
const p = () => t.page;
const stamp = Date.now();
const api = async path => (await p().request.get(`${t.BASE}${path}`, {
  headers: { Authorization: 'Basic ' + Buffer.from('admin:Redmine7Test!').toString('base64') } })).json();
const text = async sel => (await p().locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
async function submit(selector, step) {
  await Promise.all([p().waitForNavigation().catch(() => {}), p().click(selector)]);
  await t.sudo();
  await t.settle();
  t.check(step);
}
function expectRefused(what) {
  return text('#errorExplanation').then(e => { if (!/refused by a custom workflow/.test(e)) t.problems.push(`${what} [refuse]: "${e}"`); });
}
function expectNotice(what, re) {
  return text('#flash_notice').then(n => { if (!re.test(n)) t.problems.push(`${what}: notice "${n}"`); });
}

await t.login('manager');

// Version
await t.go('/projects/e2e-project/versions/new');
await p().fill('#version_name', `E2E [refuse] ${stamp}`);
await submit('#new_version input[name=commit]', 'version refuse');
await expectRefused('version');
await t.shot('version-refused', 'Version: the workflow refuses a name with [refuse]');
await p().fill('#version_name', `E2E version ${stamp}`);
await submit('#new_version input[name=commit]', 'version ok');
await expectNotice('version', /version custom workflow ran/);
await t.shot('version-saved', 'Version: created, with the workflow notice');

// Time entry
await t.go('/projects/e2e-project/time_entries/new');
await p().fill('#time_entry_hours', '1');
await p().selectOption('#time_entry_activity_id', { index: 1 });
await p().fill('#time_entry_comments', '[refuse] time');
await submit('#new_time_entry input[name=commit]', 'time refuse');
await expectRefused('time entry');
await t.shot('time-entry-refused', 'Time entry: refused by its workflow');
await p().fill('#time_entry_comments', `E2E time ${stamp}`);
await submit('#new_time_entry input[name=commit]', 'time ok');
await expectNotice('time entry', /time entry custom workflow ran/);
await t.shot('time-entry-saved', 'Time entry: logged, with the workflow notice');

// Project
await t.go('/projects/e2e-project/settings');
await p().fill('#project_name', 'E2E project [refuse]');
await submit('#tab-content-info input[type=submit]', 'project refuse');
await expectRefused('project');
await t.shot('project-refused', 'Project settings: the project workflow refuses the new name');
await t.go('/projects/e2e-project/settings');
await p().fill('#project_name', 'E2E project [cw]');
await submit('#tab-content-info input[type=submit]', 'project ok');
await expectNotice('project', /project custom workflow ran/);
await t.shot('project-saved', 'Project settings: saved, with the workflow notice');
await t.go('/projects/e2e-project/settings');
await p().fill('#project_name', 'E2E project');
await submit('#tab-content-info input[type=submit]', 'project reset');

// Wiki content
await t.go('/projects/e2e-project/wiki/Wiki/edit');
await p().fill('#content_text', 'Wiki start page. [refuse]');
await submit('#wiki_form input[name=commit]', 'wiki refuse');
await expectRefused('wiki');
await t.shot('wiki-refused', 'Wiki: the wiki content workflow refuses the text');
await p().fill('#content_text', `Wiki start page. See [[Child page]]. Edited ${stamp}.`);
await submit('#wiki_form input[name=commit]', 'wiki ok');
await expectNotice('wiki', /wiki content custom workflow ran/);
await t.shot('wiki-saved', 'Wiki: saved, with the workflow notice');

// Attachment description
await t.go('/attachments/issues/1/edit');
await p().locator('input[name*="[description]"]').first().fill('[refuse] description');
await submit('#content input[type=submit]', 'attachment refuse');
const attErr = await text('#errorExplanation');
if (!/refused by a custom workflow/.test(attErr)) t.problems.push(`attachment [refuse]: "${attErr}"`);
await t.shot('attachment-refused', 'Attachment: editing a description that the attachment workflow refuses');
await p().locator('input[name*="[description]"]').first().fill(`E2E description ${stamp}`);
await submit('#content input[type=submit]', 'attachment ok');
await t.shot('attachment-saved', 'Attachment: description saved');

// User and group (administration)
await t.login('admin');
const reporterId = (await api('/users.json?name=reporter')).users[0].id;
await t.go(`/users/${reporterId}/edit`);
await p().fill('#user_firstname', 'Reporter [refuse]');
await submit('#user_form input[name=commit], #content input[name=commit] >> nth=0', 'user refuse');
await expectRefused('user');
await t.shot('user-refused', 'User: the user workflow refuses the first name');
await t.go(`/users/${reporterId}/edit`);
await p().fill('#user_firstname', 'Reporter');
await submit('#content input[name=commit] >> nth=0', 'user ok');
await expectNotice('user', /user custom workflow ran/);
await t.shot('user-saved', 'User: saved, with the workflow notice');

const groupId = (await api('/groups.json')).groups.find(g => g.name === 'E2E group').id;
await t.go(`/groups/${groupId}/edit`);
await p().fill('#group_name', 'E2E group [refuse]');
await submit('#content input[name=commit] >> nth=0', 'group refuse');
await expectRefused('group');
await t.shot('group-refused', 'Group: the group workflow refuses the name');
await t.go(`/groups/${groupId}/edit`);
await p().fill('#group_name', 'E2E group');
await submit('#content input[name=commit] >> nth=0', 'group ok');
await expectNotice('group', /group custom workflow ran/);
await t.shot('group-saved', 'Group: saved, with the workflow notice');

await t.done();
