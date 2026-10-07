// Jan's decisions of 2026-10-07, per user. q1: an error in an after_save script is logged and the save goes through.
// q2: a before_add script of group users / wiki attachments cannot stop the add (documented), only logs.
import fs from 'node:fs';
import { e2e } from '../../.codex/e2e/lib.mjs';

const t = await e2e('decisions');
const p = () => t.page;
const stamp = Date.now();
const auth = { Authorization: 'Basic ' + Buffer.from('admin:Redmine7Test!').toString('base64') };
const api = async path => (await p().request.get(`${t.BASE}${path}`, { headers: auth })).json();
const flash = async kind => (await p().locator(`#flash_${kind}`).innerText().catch(() => '')).trim();

async function createIssue(project, subject, step) {
  await t.go(`/projects/${project}/issues/new`);
  await p().fill('#issue_subject', subject);
  const [res] = await Promise.all([p().waitForNavigation(), p().click('#issue-form input[name=commit]')]);
  await t.settle();
  t.check(step);
  return res.status();
}

// q1 for every user who may create an issue in the public project
for (const user of ['admin', 'manager', 'reporter', 'outsider']) {
  await t.login(user);
  const subject = `E2E q1 ${user} [after-fail] ${stamp}`;
  const status = await createIssue('e2e-project', subject, `q1 ${user}`);
  const found = (await api(`/projects/e2e-project/issues.json?status_id=*&subject=~${encodeURIComponent(`q1 ${user}`)}`)).issues
    .some(i => i.subject === subject);
  if (status !== 200 || !found || !/\/issues\/\d+$/.test(p().url())) t.problems.push(`q1 ${user}: HTTP ${status}, saved=${found}, at ${p().url()}`);
  await t.shot(`q1-${user}`, `q1 as ${user}: the after_save script raises, the issue is still created (HTTP ${status}, notice "${await flash('notice')}")`);
}

// refusal paths around q1: outsider in the private project, reporter cannot reach the administration
await t.login('outsider');
await t.go('/projects/e2e-private/issues/new', { status: 403 });
await t.shot('q1-outsider-private-refused', 'Outsider: no issue form in the private project (403), so no workflow runs there');

// q2, group users: only an administrator manages groups
await t.login('admin');
const group = (await api('/groups.json')).groups.find(g => g.name === 'E2E group');
for (const u of (await api(`/groups/${group.id}.json?include=users`)).group.users) {
  await p().request.delete(`${t.BASE}/groups/${group.id}/users/${u.id}.json`, { headers: auth });
}
const logFile = `${process.env.REDMINE_DIR || 'redmine'}/log/${process.env.RMP_SERVER_ENV || 'production'}.log`;
const mark = fs.statSync(logFile).size;
await t.go(`/groups/${group.id}/edit?tab=users`);
await p().click('#tab-content-users a.icon-add');
await p().waitForSelector('#user_search');
await p().fill('#user_search', 'outsider');
await p().waitForSelector('#users label:has-text("Outsider")');
await p().check('#users label:has-text("Outsider") input');
await p().click('#ajax-modal input[type=submit]');
await t.sudo();
await p().waitForTimeout(1500);
await t.go(`/groups/${group.id}/edit?tab=users`);
const logged = fs.readFileSync(logFile).subarray(mark).toString('utf8').includes('outsider may not join a group');
const added = (await api(`/groups/${group.id}.json?include=users`)).group.users.some(u => u.name.startsWith('Outsider'));
if (!logged || !added) t.problems.push(`q2 group users: logged=${logged}, added=${added}`);
await t.shot('q2-admin-group-users', `q2 as admin: before_add raised for outsider (logged: ${logged}) and outsider is added anyway, as documented`);
for (const u of (await api(`/groups/${group.id}.json?include=users`)).group.users) {
  await p().request.delete(`${t.BASE}/groups/${group.id}/users/${u.id}.json`, { headers: auth });
}
for (const user of ['manager', 'reporter', 'outsider']) {
  await t.login(user);
  await t.go(`/groups/${group.id}/edit?tab=users`, { status: 403 });
  await t.shot(`q2-${user}-groups-refused`, `q2 as ${user}: group membership is administration only (403)`);
}

// q2, wiki page attachments: the manager may attach, the reporter and outsider may not
await t.login('manager');
const f = `/tmp/refuse-q2-${stamp}.txt`;
fs.writeFileSync(f, 'q2\n');
await t.go('/projects/e2e-project/wiki/Wiki');
await p().locator('#add_attachment_form input[type=file]').setInputFiles(f);
await p().waitForSelector('#add_attachment_form .attachments_fields input.filename', { state: 'attached', timeout: 10000 });
await p().waitForTimeout(1000);
await Promise.all([p().waitForNavigation(), p().evaluate(() => document.querySelector('#add_attachment_form').submit())]);
await t.settle();
t.check('q2 wiki manager');
const wikiFiles = (await api('/projects/e2e-project/wiki/Wiki.json?include=attachments')).wiki_page.attachments.map(a => a.filename);
if (!wikiFiles.includes(`refuse-q2-${stamp}.txt`)) t.problems.push('q2 wiki: file not attached');
await p().click('#content legend:has-text("Files")').catch(() => {});
await t.shot('q2-manager-wiki-file', 'q2 as manager: the wiki page before_add raised for refuse-*.txt (logged), the file is attached anyway, as documented');
await t.login('reporter');
await t.go('/projects/e2e-project/wiki/Wiki');
if (await p().locator('#add_attachment_form').count()) t.problems.push('q2 wiki: reporter has the attach form');
await t.shot('q2-reporter-wiki', 'q2 as reporter: no attach form on the wiki page (no edit permission)');
await t.login('outsider');
await t.go('/projects/e2e-private/wiki/Wiki', { status: 403 });
await t.shot('q2-outsider-private-wiki-refused', 'q2 as outsider: the private wiki is refused (403)');

await t.done();
