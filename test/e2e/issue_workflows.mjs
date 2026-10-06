// Issue workflows (observable "issue") as users see them: messages, a field changed by before_save, a refusal by
// before_save, shared code, the remote IP, after_save failures (HTTP 500 on 3.1.1 as released), before_destroy
// refusing a delete; through the form and through the REST API.
import { e2e } from '../../.codex/e2e/lib.mjs';

const t = await e2e('issue_workflows');
const p = () => t.page;
const flash = async kind => (await p().locator(`#flash_${kind}`).innerText().catch(() => '')).trim();
const errors = async () => (await p().locator('#errorExplanation').innerText().catch(() => '')).replace(/\s+/g, ' ');

async function edit(id, subject, step) {
  await t.go(`/issues/${id}/edit`);
  await p().fill('#issue_subject', subject);
  const [res] = await Promise.all([p().waitForNavigation(), p().click('#issue-form input[name=commit]')]);
  await t.settle();
  t.check(step);
  return res.status();
}
const subjectOf = async id => (await (await p().request.get(`${t.BASE}/issues/${id}.json`, { headers: auth('admin') })).json()).issue;
const auth = user => ({ Authorization: 'Basic ' + Buffer.from(`${user}:Redmine7Test!`).toString('base64') });

await t.login('manager');
await edit(2, 'E2E unassigned issue [cw]', 'cw');
if (!/done ratio set to 50%/.test(await flash('notice'))) t.problems.push(`[cw]: notice "${await flash('notice')}"`);
if ((await subjectOf(2)).done_ratio !== 50) t.problems.push('[cw]: done ratio not 50');
await t.shot('before-save-changes', 'before_save set % Done to 50 and its notice is shown with the core one');

await edit(2, 'E2E unassigned issue [refuse]', 'refuse');
if (!/with \[refuse\] is refused/.test(await errors())) t.problems.push(`[refuse]: errors "${await errors()}"`);
if ((await subjectOf(2)).subject.includes('[refuse]')) t.problems.push('[refuse]: saved anyway');
await t.shot('before-save-refuses', 'A WorkflowError raised in before_save is shown as a validation error; nothing saved');

await edit(2, 'E2E unassigned issue [env]', 'env');
if (!/remote IP 127\.0\.0\.1/.test(await flash('warning'))) t.problems.push(`[env]: warning "${await flash('warning')}"`);
await t.shot('env-remote-ip', 'custom_workflow_env[:remote_ip] is filled in by the controller (warning flash)');

await edit(2, 'E2E unassigned issue [shared]', 'shared');
if (!(await subjectOf(2)).subject.endsWith(' [shared]')) t.problems.push('[shared]: shared code method not used');
await t.shot('shared-code', 'A method defined in the shared code workflow is used by the issue workflow');

const s1 = await edit(2, 'E2E unassigned issue [after-fail]', 'after-fail');
if (s1 !== 200 || !(await flash('notice'))) t.problems.push(`[after-fail]: HTTP ${s1}, notice "${await flash('notice')}"`);
if (!(await subjectOf(2)).subject.includes('[after-fail]')) t.problems.push('[after-fail]: change rolled back');
await t.shot('after-save-fails', 'A WorkflowError in after_save no longer gives HTTP 500: the issue is saved (as on 2.1.3)');

const s2 = await edit(2, 'E2E unassigned issue [after-crash]', 'after-crash');
if (s2 !== 200 || !(await subjectOf(2)).subject.includes('[after-crash]')) t.problems.push(`[after-crash]: HTTP ${s2}`);
await t.shot('after-save-crashes', 'A runtime error in after_save is logged; the issue is saved and the user sees the normal page');
await edit(2, 'E2E unassigned issue', 'reset');

// REST API
const put = (id, subject) => p().request.put(`${t.BASE}/issues/${id}.json`,
  { headers: { ...auth('manager'), 'Content-Type': 'application/json' }, data: { issue: { subject } } });
const r1 = await put(2, 'E2E unassigned issue [refuse]');
const r1body = await r1.text();
if (r1.status() !== 422 || !/refused by a custom workflow/.test(r1body)) t.problems.push(`API [refuse]: ${r1.status()} ${r1body}`);
const r2 = await put(2, 'E2E unassigned issue [after-fail]');
if (r2.status() !== 204) t.problems.push(`API [after-fail]: HTTP ${r2.status()}`);
await put(2, 'E2E unassigned issue');
await t.go('/issues/2');
await p().evaluate(([a, b]) => {
  const d = document.createElement('pre');
  d.id = 'e2e-api'; d.style.cssText = 'background:#ffe;border:1px solid #cc9;padding:8px;margin:8px';
  d.textContent = a + '\n' + b;
  document.querySelector('#content').prepend(d);
}, [`PUT /issues/2.json subject "[refuse]" -> HTTP ${r1.status()} ${r1body}`,
    `PUT /issues/2.json subject "[after-fail]" -> HTTP ${r2.status()} (3.1.1 as released: 500)`]);
await t.shot('rest-api', 'REST API: the refusal is a 422 with the workflow message; a failing after_save is a 204');

// A member without any plugin permission is subject to the workflows too
await t.login('reporter');
await t.go('/projects/e2e-project/issues/new');
await p().fill('#issue_subject', `E2E reporter issue [cw] ${Date.now()}`);
await Promise.all([p().waitForNavigation(), p().click('#issue-form input[name=commit]')]);
await t.settle();
t.check('reporter create');
if (!/done ratio set to 50%/.test(await flash('notice'))) t.problems.push('reporter [cw]: no notice');
await t.shot('reporter-create', 'Reporter (no plugin permission) creates an issue: the workflows run for every user');

// before_destroy
await t.login('manager');
await t.go('/projects/e2e-project/issues/new');
await p().fill('#issue_subject', `E2E keep me [keep] ${Date.now()}`);
await Promise.all([p().waitForNavigation(), p().click('#issue-form input[name=commit]')]);
await t.settle();
const keepPath = new URL(p().url()).pathname;
p().once('dialog', d => d.accept());
await p().click('#content .contextual .drdn-trigger >> nth=0');
await Promise.all([p().waitForNavigation(), p().click('#content .contextual .drdn-items a.icon-del >> nth=0')]);
await t.settle();
t.check('delete keep');
if (!/cannot be deleted/.test(await flash('error'))) t.problems.push(`[keep] delete: error "${await flash('error')}"`);
const still = await p().request.get(`${t.BASE}${keepPath}.json`, { headers: auth('admin') });
if (still.status() !== 200) t.problems.push(`[keep] delete: issue gone (HTTP ${still.status()})`);
await t.shot('before-destroy-refuses', 'before_destroy refuses the delete: its error flash is shown and the issue stays (core still adds "Successful deletion", the same on 5.1)');

await t.go(`${keepPath}/edit`);
await p().fill('#issue_subject', 'E2E delete me');
await Promise.all([p().waitForNavigation(), p().click('#issue-form input[name=commit]')]);
p().once('dialog', d => d.accept());
await p().click('#content .contextual .drdn-trigger >> nth=0');
await Promise.all([p().waitForNavigation(), p().click('#content .contextual .drdn-items a.icon-del >> nth=0')]);
await t.settle();
t.check('delete');
const gone = await p().request.get(`${t.BASE}${keepPath}.json`, { headers: auth('admin') });
if (gone.status() !== 404) t.problems.push(`delete: HTTP ${gone.status()} afterwards`);
await t.shot('deleted', 'Without the marker the same issue is deleted');

await t.done();
