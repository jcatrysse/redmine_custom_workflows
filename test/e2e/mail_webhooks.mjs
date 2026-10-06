// Side effects of the workflows outside the page: a mail sent by a script (CustomWorkflowMailer) and the issue
// webhooks of Redmine 7. A webhook must carry what the workflow saved, and nothing for a save it refused.
import http from 'node:http';
import { e2e } from '../../.codex/e2e/lib.mjs';

const t = await e2e('mail_webhooks');
const p = () => t.page;
const received = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => { try { received.push(JSON.parse(body)); } catch { received.push({ raw: body }); } res.end('ok'); });
}).listen(3999, '0.0.0.0');

async function edit(id, subject) {
  await t.go(`/issues/${id}/edit`);
  await p().fill('#issue_subject', subject);
  await Promise.all([p().waitForNavigation(), p().click('#issue-form input[name=commit]')]);
  await t.settle();
  t.check(`edit ${subject}`);
}
const waitFor = async (cond, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end && !cond()) await new Promise(r => setTimeout(r, 250)); return cond(); };
const hooksFor = subject => received.filter(h => h.data?.issue?.subject === subject);
function note(lines) {
  return p().evaluate(text => {
    const d = document.createElement('pre');
    d.style.cssText = 'background:#ffe;border:1px solid #cc9;padding:8px;margin:8px;white-space:pre-wrap';
    d.textContent = text;
    document.querySelector('#content').prepend(d);
  }, lines.join('\n'));
}

await t.login('manager');

// Mail from an after_save script
const since = Date.now();
const mailSubject = `E2E unassigned issue [mail] ${since}`;
await edit(2, mailSubject);
await waitFor(() => t.mails(since).some(m => m.body.includes('E2E custom mail for issue #2')));
const mail = t.mails(since).find(m => m.body.includes('E2E custom mail for issue #2'));
if (!mail) t.problems.push('mail: no custom mail written to tmp/mails');
else if (!/To: manager@example\.net/.test(mail.body) || !mail.body.includes(`Issue '${mailSubject}' was saved.`)) t.problems.push('mail: wrong recipient or body');
await note(mail ? [`Mail file ${mail.to}:`, ...mail.body.split('\n').filter(l => /^(To|Subject):|was saved/.test(l))] : ['no mail']);
await t.shot('mail', 'An after_save script sent a mail with CustomWorkflowMailer (file delivery, recipient and body shown)');

// Webhooks
const changed = `E2E unassigned issue [cw] hook ${Date.now()}`;
await edit(2, changed);
await waitFor(() => hooksFor(changed).length > 0);
const h1 = hooksFor(changed)[0];
if (!h1) t.problems.push('webhook: nothing received for the [cw] save');
else if (h1.data.issue.done_ratio !== 50) t.problems.push(`webhook: done_ratio ${h1.data.issue.done_ratio}, expected the 50 set by before_save`);

const refused = `E2E unassigned issue [refuse] hook ${Date.now()}`;
await edit(2, refused);
const afterFail = `E2E unassigned issue [after-fail] hook ${Date.now()}`;
await edit(2, afterFail);
await waitFor(() => hooksFor(afterFail).length > 0);
await new Promise(r => setTimeout(r, 2000));
if (hooksFor(refused).length) t.problems.push('webhook: sent for a save the workflow refused');
if (!hooksFor(afterFail).length) t.problems.push('webhook: nothing for the save whose after_save failed (it is saved)');
await edit(2, 'E2E unassigned issue');
await t.go('/issues/2');
await note([
  `webhook receiver on :3999 got ${received.length} payload(s) during this scenario`,
  `[cw] save      -> ${h1 ? `${h1.type} ${h1.action || ''} done_ratio=${h1.data.issue.done_ratio}` : 'nothing'}`,
  `[refuse] save  -> ${hooksFor(refused).length} payload(s) (refused by before_save, not saved)`,
  `[after-fail]   -> ${hooksFor(afterFail).length} payload(s) (saved; on 3.1.1 as released: HTTP 500 and rollback)`,
]);
await t.shot('webhooks', 'Webhooks follow the workflows: the payload has the value set by before_save, a refused save sends nothing');

await t.login('admin');
await t.go('/webhooks');
await t.shot('webhook-config', 'The webhook used (core Redmine 7, set up by the seed for the manager)', { full: false });

server.close();
await t.done();
