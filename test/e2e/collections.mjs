// Observables saved through modal dialogs and uploads: member, group users, issue relation, and the attachment
// collections of issues, projects (Files) and wiki pages.
import fs from 'node:fs';
import { e2e } from '../../.codex/e2e/lib.mjs';

const t = await e2e('collections');
const p = () => t.page;
const stamp = Date.now();
const dialogs = [];
const auth = { Authorization: 'Basic ' + Buffer.from('admin:Redmine7Test!').toString('base64') };
const api = async path => (await p().request.get(`${t.BASE}${path}`, { headers: auth })).json();
function file(name) { const f = `/tmp/${name}`; fs.writeFileSync(f, `E2E ${name}\n`); return f; }
const logFile = `${process.env.REDMINE_DIR || 'redmine'}/log/${process.env.RMP_SERVER_ENV || 'production'}.log`;
const logSize = () => (fs.existsSync(logFile) ? fs.statSync(logFile).size : 0);
const logSince = from => { const b = fs.readFileSync(logFile); return b.subarray(from).toString('utf8'); };
const watchDialogs = () => p().on('dialog', d => { dialogs.push(d.message()); d.accept(); });

// Member: outsider may not join e2e-private (as admin: the manager cannot see a user outside its projects)
await t.login('admin');
watchDialogs();
await t.go('/projects/e2e-private/settings/members');
const memberLog = logSize();
await p().click('#tab-content-members a.icon-add');
await p().waitForSelector('#principal_search');
await p().fill('#principal_search', 'outsider');
await p().waitForSelector('#principals label:has-text("Outsider")');
await p().check('#principals label:has-text("Outsider") input');
await p().check('.roles-selection label:has-text("Reporter") input');
await p().click('#member-add-submit');
await t.sudo();
await p().waitForTimeout(1500);
t.check('member refuse');
if (!/outsider may not join e2e-private/.test(logSince(memberLog))) t.problems.push('member: workflow did not run');
await t.shot('member-refused', `Member: the member workflow refuses outsider in e2e-private; the modal closes without a message (core re-validates the member; alert: ${dialogs.length ? dialogs.at(-1) : 'none'})`);
const outsiderIn = (await api('/projects/e2e-private/memberships.json')).memberships.some(m => m.user?.name?.startsWith('Outsider'));
if (outsiderIn) t.problems.push('member: outsider was added anyway');

await t.login('manager');
watchDialogs();
// Issue relation: blocks is refused, relates is accepted
await t.go('/issues/1');
await p().click('#relations .contextual a, a.icon-link-add, #relations a:has-text("Add")');
await p().selectOption('#relation_relation_type', 'blocks');
await p().fill('#relation_issue_to_id', '2');
await p().click('#new-relation-form input[type=submit]');
await p().waitForSelector('#relation_form .conflict, #relation_form #errorExplanation, #new-relation-form #errorExplanation', { timeout: 5000 }).catch(() => {});
await t.settle();
t.check('relation refuse');
const relErr = (await p().locator('#relations').innerText()).replace(/\s+/g, ' ');
if (!/blocks relations are refused/.test(relErr)) t.problems.push(`relation refuse: "${relErr.slice(0, 200)}"`);
await t.shot('relation-refused', 'Issue relation: "blocks" is refused by the issue relation workflow, shown in the relation form');
await p().selectOption('#relation_relation_type', 'relates');
await p().fill('#relation_issue_to_id', '2');
await p().click('#new-relation-form input[type=submit]');
await p().waitForSelector('#relations table.issues td.subject:has-text("E2E unassigned issue")', { timeout: 8000 }).catch(() => t.problems.push('relation relates: not added'));
await t.shot('relation-added', 'Issue relation: "relates" to #2 is accepted');
const rel = (await api('/issues/1/relations.json')).relations.find(r => r.issue_to_id === 2 || r.issue_id === 2);
if (rel) await p().request.delete(`${t.BASE}/relations/${rel.id}.json`, { headers: auth });

// Issue attachments: refuse.txt is refused by before_add
let mark = logSize();
await t.go('/issues/1/edit');
await p().setInputFiles('#issue-form input[type=file].filedrop, #issue-form input[type=file]', file(`refuse-${stamp}.txt`));
await p().waitForSelector('#issue-form .attachments_fields input.filename', { timeout: 10000 });
await Promise.all([p().waitForNavigation(), p().click('#issue-form input[name=commit]')]);
await t.settle();
t.check('issue attachment refuse');
const issueFiles = (await api('/issues/1.json?include=attachments')).issue.attachments.map(a => a.filename);
// before_add refuses the file: the issue is not saved and the form shows the workflow error (as on 2.1.3)
if (!/E2E: issue file refused/.test(logSince(mark))) t.problems.push('issue attachments: before_add did not run');
const issueErr = (await p().locator('#errorExplanation').innerText().catch(() => '')).trim();
if (!/issue file refused/.test(issueErr)) t.problems.push(`issue attachments: error shown "${issueErr}"`);
if (issueFiles.some(f => f.startsWith(`refuse-${stamp}`))) t.problems.push('issue attachments: refused file attached');
await t.shot('issue-attachment-refused', 'Issue attachments: before_add refuses refuse-*.txt; the update is not saved and the form shows the error');
await t.go('/issues/1/edit');
await p().setInputFiles('#issue-form input[type=file]', file(`ok-${stamp}.txt`));
await p().waitForSelector('#issue-form .attachments_fields input.filename', { timeout: 10000 });
await Promise.all([p().waitForNavigation(), p().click('#issue-form input[name=commit]')]);
await t.settle();
t.check('issue attachment ok');
if (!(await api('/issues/1.json?include=attachments')).issue.attachments.some(a => a.filename === `ok-${stamp}.txt`)) t.problems.push('issue attachment: ok file missing');
await t.shot('issue-attachment-added', 'Issue attachments: another file is attached (after_add logs it)');

// Project files
mark = logSize();
await t.go('/projects/e2e-project/files/new');
await p().setInputFiles('input[type=file]', file(`refuse-files-${stamp}.txt`));
await p().waitForSelector('.attachments_fields input.filename', { timeout: 10000 });
await Promise.all([p().waitForNavigation(), p().click('#content input[type=submit]')]);
await t.settle();
t.check('project file refuse');
const files = (await api('/projects/e2e-project/files.json')).files.map(f => f.filename);
if (!/E2E: project file refused/.test(logSince(mark))) t.problems.push('project attachments: before_add did not run');
await t.shot('project-file-refused', `Project attachments (Files): before_add ran and raised (logged); the file is ${files.some(f => f.startsWith(`refuse-files-${stamp}`)) ? 'added anyway' : 'not added'}`);

// Wiki page attachment
mark = logSize();
await t.go('/projects/e2e-project/wiki/Wiki');
await p().locator('#add_attachment_form input[type=file]').setInputFiles(file(`refuse-wiki-${stamp}.txt`));
await p().waitForSelector('#add_attachment_form .attachments_fields input.filename', { state: 'attached', timeout: 10000 });
await p().waitForTimeout(1000); // the upload finishes before the form may be sent
await Promise.all([p().waitForNavigation(), p().evaluate(() => document.querySelector('#add_attachment_form').submit())]);
await t.settle();
t.check('wiki file refuse');
const wikiFiles = (await api('/projects/e2e-project/wiki/Wiki.json?include=attachments')).wiki_page.attachments.map(a => a.filename);
if (!/E2E: wiki_page file refused/.test(logSince(mark))) t.problems.push('wiki page attachments: before_add did not run');
await p().click('#content legend:has-text("Files")').catch(() => {});
await t.shot('wiki-file-refused', `Wiki page attachments: before_add ran and raised (logged); the file is ${wikiFiles.some(f => f.startsWith(`refuse-wiki-${stamp}`)) ? 'attached anyway' : 'not attached'}`);

// Group users (administration): outsider is refused, reporter is added
await t.login('admin');
watchDialogs();
const group = (await api('/groups.json')).groups.find(g => g.name === 'E2E group');
for (const u of (await api(`/groups/${group.id}.json?include=users`)).group.users) {
  await p().request.delete(`${t.BASE}/groups/${group.id}/users/${u.id}.json`, { headers: auth });
}
await t.go(`/groups/${group.id}/edit?tab=users`);
for (const [who, ok] of [['outsider', false], ['reporter', true]]) {
  mark = logSize();
  await p().click('#tab-content-users a.icon-add');
  await p().waitForSelector('#user_search');
  await p().fill('#user_search', who);
  await p().waitForSelector(`#users label:has-text("${who[0].toUpperCase() + who.slice(1)}")`);
  await p().check(`#users label:has-text("${who[0].toUpperCase() + who.slice(1)}") input`);
  await p().click('#ajax-modal input[type=submit]');
  await t.sudo();
  await p().waitForTimeout(1500);
  await t.go(`/groups/${group.id}/edit?tab=users`);
  const users = (await api(`/groups/${group.id}.json?include=users`)).group.users.map(u => u.name);
  const isIn = users.some(n => n.toLowerCase().startsWith(who));
  if (ok && !isIn) t.problems.push(`group users ${who}: not added`);
  if (!ok && !/outsider may not join a group/.test(logSince(mark))) t.problems.push('group users: before_add did not run');
  await t.shot(`group-users-${who}`, ok ? 'Group users: reporter is added' :
    `Group users: before_add ran and raised for outsider (logged); outsider is ${isIn ? 'added anyway: a collection callback cannot refuse' : 'not added'}`);
  if (!ok && isIn) {
    const o = (await api(`/groups/${group.id}.json?include=users`)).group.users.find(u => u.name.startsWith('Outsider'));
    await p().request.delete(`${t.BASE}/groups/${group.id}/users/${o.id}.json`, { headers: auth });
  }
}
const rep = (await api(`/groups/${group.id}.json?include=users`)).group.users.find(u => u.name.startsWith('Reporter'));
if (rep) await p().request.delete(`${t.BASE}/groups/${group.id}/users/${rep.id}.json`, { headers: auth });

await t.done();
