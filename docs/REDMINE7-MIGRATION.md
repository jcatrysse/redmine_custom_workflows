# Redmine 7 migration: redmine_custom_workflows

Start a Claude Code (or Codex) session on this repository, branch `redmine70-migration`, with:

> Read CLAUDE.md and docs/REDMINE7-MIGRATION.md, then carry out the Redmine 7 migration of this
> plugin as described there, on branch redmine70-migration. That includes the plugin's tests on
> PostgreSQL, every function exercised end to end on a real running Redmine in a
> browser (with and without permissions, failure paths included) with screenshots you looked at,
> and an OpenAI review of the diff when OPENAI_API_KEY is set. Report to me in Dutch at the end.

## Decided by Jan

General decisions (2026-10-07, for every GEOxyz plugin):

- GEOxyz goes straight to Redmine 7: no backports to 5.1. Nothing is cherry-picked to the default branch or to the
  branch production runs today; `redmine70-migration` is what goes live with Redmine 7. Redmine 5.1 compatibility is
  no longer a requirement; no code paths that exist only for 5.1.
- GEOxyz does not use MariaDB or MySQL; production runs PostgreSQL 16. Tests and the e2e set run on PostgreSQL only.
  SQL stays portable where that costs nothing; a MariaDB-only problem is a note here, not a blocker.
- A plugin that depends on deface requires it without a version constraint. (This plugin does not use deface.)
- A Redmine core method that other installed plugins also patch is patched with `prepend`, never with
  `alias_method`. (This plugin has no `alias_method`: models and controllers are patched with `prepend`, the project
  settings tab through a helper module that calls `super`. Checked 2026-10-07, see "Together" in Results.)
- GitHub Actions stay manual only (`workflow_dispatch`).

Decisions for this plugin (2026-10-07):

1. **q1, failing after_save/after_destroy script**: A, "Zoals vandaag: fout loggen, opslaan gaat door" (Gebruikers
   merken geen verschil met 5.x, maar zien de melding van zo'n script niet, dus controles horen in een script dat vóór
   het opslaan loopt.). Already built in dbdcf48; nothing more to do.
2. **q2, collection before_add cannot refuse** (group users, project files, wiki attachments): A, "Zo laten en
   documenteren" (Er verandert niets voor gebruikers; wie wil weigeren, zet die controle in het script dat bij het
   opslaan loopt.). Nothing changed in code; documented in README and in "After the upgrade".
3. **q3, report the four bugs upstream**: B, "Niet melden" (Geen extern contact; de oplossingen blijven alleen in de
   GEOxyz-versie.). Nothing reported; the fixes stay in this branch only.

This file is the plan and the memory of that work. Update it as you go: verdicts, results,
what is left. Written 2026-10-06 from a measured analysis (report at the bottom).

## Status

| | |
|---|---|
| Plugin id | `redmine_custom_workflows` |
| GEOxyz runs today | `5.x` @ 0398974 (2.1.3 devel). Note: `origin/5.x` now points at upstream 38d6a53 (fast-forwarded since the analysis) |
| Upstream | anteo/redmine_custom_workflows master @ 38d6a53e11975a8f0a0d9c6cb5af3540607c6e5e (v3.1.1, 2026-07-24) |
| Runs on Redmine 7 as is | NEE (5.x does not boot) |
| Upstream sync | DONE: v3.1.1 merged (19bf326) |
| After sync + this branch | JA: all work list items done and Jan's decisions of 2026-10-07 recorded; tests and e2e green on PostgreSQL, alone and with 25 other GEOxyz plugins |
| Complexity (1 trivial .. 5 rewrite) | 2 |
| Measured on | Redmine 7.0-stable-GEOxyz @ 8067e23 (7.0.1), Rails 8.1.3.1, Ruby 3.3.6, PostgreSQL 16.15 and MariaDB 10.11.14; before: Redmine 5.1-stable @ 16eb9e6 (5.1.13) with 0398974 |
| Branch head | see `git log`; last full verification on the commit that updated this file |
| 5.1 compatibility | not a requirement (decided 2026-10-07); the 3.1 line requires Redmine 6.0+ anyway |
| Database | PostgreSQL 16 only (decided 2026-10-07); the MariaDB run of 2026-10-06 is kept as a note |

### Results after Jan's decisions (2026-10-07, PostgreSQL 16.15, Redmine 7.0-stable-GEOxyz @ 8067e23)

| check | result |
|---|---|
| Plugin tests alone | 108 runs, 279 assertions, 0 failures, 0 errors, 0 skips (109 runs on 2026-10-06 included two route helpers, `test_email_path/_url`, that are no tests; fixed in the test base) |
| Plugin tests with 25 other GEOxyz plugins (list below) | 108 runs, 279 assertions, 0 failures, 0 errors, 0 skips |
| e2e alone (`e2e.sh`: smoke, core, 9 scenarios) | 11 scripts, 108 screenshots, 0 problems (`docs/e2e/`) |
| e2e with the same 25 plugins | 11 scripts, 108 screenshots, 0 problems; Project > Settings, the issue list and an issue page answer 200 |

Together, the 25 plugins (`redmine70-migration` of each): bless-this-redmine-sso, redmine_plugin_computed_custom_field,
redmine_ai_summary, redmine_description_macros, redmine_drawio, redmine_editauthor, redmine_extended_api,
redmine_impersonate, redmine_inline_edit_issues, redmine_issue_field_visibility, redmine_issue_templates,
redmine_issue_todo_lists2, redmine_issue_view_columns, redmine_mermaid_macro, redmine_more_previews,
redmine_parent_child_filters, redmine_paste_as_wiki_tables, redmine_project_workflows, redmine_reporter_dashboards,
redmine_stealth, redmine_subtask, redmine_tint_issues, redmine_user_specific_theme, redmine_wiki_extensions,
redmine-view-customize. Private plugins (RedmineUP and others) were not installed.

Findings with all 30 public plugins installed (none caused by this plugin; this plugin has no `alias_method`):

- **Project > Settings HTTP 500**: `super: no superclass method 'project_settings_tabs'`. redmine_mail_digest,
  redmine_itil_priority and redmine_depending_custom_fields patch `ProjectsHelper#project_settings_tabs` with
  `alias_method`, redmine_ai_summary and redmine_wiki_extensions prepend into `ProjectsHelper`. Measured: still 500
  with this plugin removed; 200 with this plugin and without those three. This plugin adds its tab through
  `ProjectsController.helper` (outside `ProjectsHelper.ancestors`), the pattern redmine_reporter_dashboards and
  redmine_project_workflows also use. To fix in those three plugins (their sessions).
- **Issue pages 403 for core roles**: redmine_view_issue_description refuses issue details to a role without its own
  permission (`vid_authorize_issue_detail`), by design. With it installed the core Reporter (kit `core.mjs`) and this
  plugin's fixture role get 403 on `/issues/1`; GEOxyz roles need that permission.
- **Route helpers named `test_*`** (redmine_ldap_sync `test_ldap_setting`, redmine_reporter_dashboards
  `test_send_project_reporter_schedule`, redmine_ai_summary): Minitest ran them as tests in this plugin's
  integration test that includes the route helpers, they errored, and a shoulda-context reporter from another bundle
  aborted the run. Fixed on this side in 0d78541.

### Results (2026-10-06, measured in this session)

| check | PostgreSQL 16 | MariaDB 10.11 |
|---|---|---|
| Baseline before any change (65 upstream tests) | 65 runs, 106 assertions, 0 failures, 0 errors | not run before (same code) |
| Plugin tests at the end (`test_plugin.sh`) | 108 runs, 268 assertions, 0 failures, 0 errors, 0 skips | 108 runs, 268 assertions, 0 failures, 0 errors, 0 skips |
| Migrations down to 0 and up (test DB) | 16 reverted, 16 migrated | 16 reverted, 16 migrated |
| Eager load (`rails zeitwerk:check`, production) | All is good | (same code) |
| Baseline e2e before any change | smoke 15 pages, 1 problem (export download, a harness false alarm, fixed in e3439a8); core 6 shots, 0 problems | - |
| e2e at the end (`e2e.sh`: smoke + core + 8 scenarios) | 10 scripts, 96 screenshots, 0 problems (`docs/e2e/`) | 10 scripts, 96 screenshots, 0 problems (`docs/e2e/mariadb/*.md`, screenshots not committed twice) |
| Together with redmine_plugin_computed_custom_field, redmine_depending_custom_fields, redmine_parent_child_filters, redmine_subtask, redmine_issue_templates (all `redmine70-migration`, PostgreSQL) | tests 108 runs, 0 failures; e2e 10 scripts, 96 screenshots, 0 problems | - |
| RuboCop (`.rubocop.yml` of the plugin) on lib, app, test | 2 offenses, both in unchanged upstream code (Rails/StrongParametersExpect in the controller) | |
| OpenAI review (gpt-5) | this session's range: no findings; whole range from 0398974: 7 findings, 1 fixed, 6 not defects or upstream (`docs/reviews/`) | |

Before pictures (`docs/e2e/before/`, Redmine 5.1.13 + 2.1.3, Ruby 3.3.6 with the Gemfile's `< 3.3` bound relaxed
for the measurement): admin_crud 13/0, admin_list 6/1 (icons not SVG on 5.1, expected), project_settings 8/1 (the
settings tab bug, also on 5.x), issue_workflows 10/0, collections 9/0, observables 14/0. export_import cannot run on
5.1 (other menu markup); the import itself fails there too (measured with `rails runner`).

## Already on this branch

- `19bf326` Merge upstream anteo/redmine_custom_workflows master (38d6a53) for Redmine 7
- `e3439a8` Test kit: provision PostgreSQL as root; smoke counts an export download as a page
- `dbdcf48` A failing after_save/after_destroy script no longer turns a save into HTTP 500 (work list 1, 3)
- `e6f19ac` Workflow form: SVG expand/collapse icons on the script fieldsets (work list 5)
- `46c4a60` Import of an exported workflow no longer fails on an empty field (work list 4)
- `4f6b6c1` `rake redmine:custom_workflows:audit` for stored scripts (work list 2)
- `220a906` Project settings: saving the Custom workflows tab returns to that tab
- `c425ebf` Issue attachments: a refusing before_add script stops the issue save again
- `457a89f`, `6fc4136`, `3876ceb` e2e seed, scenarios and evidence; `ff56e73` RuboCop; `572775f` mailer test

## Work list for the migration session

In this order: things that break, security, the GEOxyz changes, the open items, then the checks.

**Priority items**

1. DONE (dbdcf48). Decide on the upstream 3.1 behaviour change: a failing after_save/after_destroy script now raises (HTTP 500, rollback) where 5.x only logged it.
   Verdict: restored the 2.x behaviour (log it, add the error to the object, the save goes through). It came from
   RuboCop's Naming/PredicateMethod in upstream a224ad1, not from a design decision; Rails never catches `:abort` in
   an after callback. 30 unit tests + 1 functional test, e2e `issue_workflows-after-save-fails` (and the REST API
   answers 204, was 500). See "Open questions for Jan" 1.

**Open items from the analysis** (Dutch; where they conflict with a decision or a priority item above, those win)

2. DONE (4f6b6c1). Audit the custom workflow scripts stored in the production DB for Rails 8/Ruby 3.3 breakers before upgrading (to_s(:db), update_attributes, File.exists?, errors[:x] <<, URI.escape)
   Verdict: `bundle exec rake redmine:custom_workflows:audit RAILS_ENV=production`, read-only (scripts are parsed with
   `RubyVM::InstructionSequence.compile`, never run). Reports syntax errors, removed Ruby/Rails API, methods renamed
   in 3.x (`run_custom_workflows` -> `run_custom_workflows?`, `run_shared_code` -> `run_shared_code?`,
   `attachments_callback` -> `attachments_callback?`), `icon icon-*` and errors raised in after_* scripts. Measured
   on the e2e instance with a planted script:
   ```
   #115 E2E issue (issue, active) after_save: raises or adds an error in an after_* script: the record is already saved, the user does not see it; move the check to before_save/before_destroy
   #131 E2E audit sample (issue, inactive) before_save:2: to_s(:format) was removed in Rails 7.1, use to_fs(:format)
   #131 E2E audit sample (issue, inactive) before_save:3: update_attributes was removed in Rails 6.1, use update
   #131 E2E audit sample (issue, inactive) after_save: raises or adds an error in an after_* script: ...
   4 finding(s) in 19 workflow(s)
   ```
   The production database itself is out of reach here: run it there (see "After the upgrade").
3. DONE, same as 1 (dbdcf48).
4. DONE (46c4a60). Verify import of workflow XML exports made on 5.x.
   Verdict: it did not work, on 5.x either: every export has an empty `<string>` (a NOT NULL column left by a typo in
   migration 20120601054047) and often an empty `<description>`; `Hash.from_xml` makes them nil and the insert failed
   with PG::NotNullViolation ("Error importing custom workflow"). Fixed; a real 2.1.3 export made on Redmine 5.1 is
   in `test/fixtures/files/custom_workflow_2.1.3.xml`, imported in a functional test and in the browser on both
   databases (`export_import-from-2-1-3`).
5. DONE (e6f19ac). Cosmetic: icon icon-collapsed legends in _form.html.erb.
   Verdict: core markup (`sprite_icon` angle-right/angle-down) and the real open/closed state (the legend always said
   "collapsed" before, so the first click inverted it).

**Checks**

6. DONE. Test suite on 7.0-stable-GEOxyz with PostgreSQL and MariaDB: numbers in "Results". 5.1-stable: not
   applicable (the 3.1 line requires Redmine 6.0). The official 7.0-stable was not run separately (the GEOxyz branch
   was; the analysis measured both).
7. DONE, nothing to change. Webhooks: core sends `issue.*` webhooks after commit, from the saved record. Measured with
   a receiver in `mail_webhooks.mjs`: a value set by a before_save script (done_ratio 50) is in the payload; a save
   refused by a workflow sends nothing; a save whose after_save script failed is saved and sends its webhook (on 3.1.1
   as released it was rolled back and sent nothing). The plugin adds no data to issues of its own, so nothing for the
   payload to show. Core refuses loopback webhook targets: the seed uses the machine's own address.
8. DONE. Every function in the browser on a real production-mode Redmine 7: see "Inventory".

After Jan's decisions (2026-10-07):

- 1b9079c: decisions recorded (q1 A, q2 A, q3 B, general rules); the plan's rules: no 5.1, PostgreSQL only, prepend
  instead of alias_method.
- 87a3507: q2, README "Where an error stops the change" and a test pinning the documented collection behaviour.
- 0d78541: test base runs only real test methods (found running together with the other plugins).
- d943c57: e2e scenario `decisions` (q1, q2 per user, refusals).
- q1 (already built in dbdcf48) and q3 (nothing reported upstream) needed no code.

Further fixes found while testing in the browser (not on the original list):

- 220a906: saving the project settings tab "Custom workflows" landed on the "Project" tab (form posted
  `tab=custom_workflow`, the tab is `custom_workflows`). Also on 2.1.3 (before picture).
- c425ebf: on 3.1.1 an `issue_attachments` before_add script that raises no longer stopped the issue update: the
  re-declared `acts_as_attachable` moved core's `attach_saved_attachments` behind the plugin's before_save. On 2.1.3
  the update is refused with the message (before picture `collections-issue-attachment-refused`). Order restored.
- 572775f: the upstream mailer tests returned early when no mail was sent; they assert again. The test kit's
  `configuration.yml` no longer forces file delivery on the test environment.

## Inventory of functions

Screenshots in `docs/e2e/` (PostgreSQL run; the `.md` per scenario lists user, URL and what each one shows),
before pictures in `docs/e2e/before/`, MariaDB tables in `docs/e2e/mariadb/`.

| function | how a user reaches it | scenario | screenshots |
|---|---|---|---|
| Admin menu entry "Custom workflows" | Administration | admin_list | admin_list-admin-menu, smoke-11 |
| List of workflows (order, inactive greyed, actions) | Administration > Custom workflows | admin_list | admin_list-list, admin_list-actions-menu |
| Refusal for non-admins (manager, reporter) and anonymous | same URLs | admin_list, export_import | admin_list-manager-refused, -reporter-refused, -anonymous-login, export_import-manager-refused |
| Create, with observable switch and every validation (no script, syntax error, author address, duplicate name) | Create a custom workflow | admin_crud | admin_crud-new-form, -observable-group-users, -error-blank, -legend-open, -error-syntax, -error-duplicate, -created |
| Edit, projects, is_for_all | name link in the list | admin_crud | admin_crud-edit-form, -edited |
| Activate / deactivate | lock icon | admin_crud | admin_crud-deactivated |
| Reorder (drag handle) | handle in the list | admin_crud | admin_crud-reordered |
| Delete (with confirmation), missing id 404 | Delete | admin_crud | admin_crud-deleted, -missing-404 |
| Export XML | Export | export_import | export_import-export (+ export_import-download.xml) |
| Import XML: a 2.1.3 export, a round trip, an invalid file, a script with a syntax error | ... > Import workflow | export_import | export_import-from-2-1-3(-dialog, -edit), -round-trip, -invalid, -syntax |
| Project settings tab (permission manage_project_workflow) | Project > Settings > Custom workflows | project_settings | project_settings-tab, -enabled, -not-enabled, -runs |
| ... without the permission, forged custom_workflow_ids, non-member | same | project_settings | project_settings-no-tab, -forged-ignored, -reporter-refused, -outsider-refused |
| Issue: before_save changes a field, message flash, refusal, shared code, remote IP | issue form | issue_workflows | issue_workflows-before-save-changes, -before-save-refuses, -shared-code, -env-remote-ip |
| Issue: after_save failing / crashing (the 3.1.1 HTTP 500) | issue form | issue_workflows | issue_workflows-after-save-fails, -after-save-crashes |
| Issue: before_destroy refuses, delete | Delete issue | issue_workflows | issue_workflows-before-destroy-refuses, -deleted |
| Issue: bulk update (context menu), a member without plugin permissions | issue list, new issue | issue_workflows | issue_workflows-bulk-update, -reporter-create |
| REST API (422 refusal, 204 after a failing after_save) | `PUT /issues/2.json` | issue_workflows | issue_workflows-rest-api |
| Mail from a script (CustomWorkflowMailer) | after_save script | mail_webhooks | mail_webhooks-mail (file in `tmp/mails`) |
| Webhooks (Redmine 7) consistent with workflows | core webhook | mail_webhooks | mail_webhooks-webhooks, -webhook-config |
| Version, time entry, project, wiki content, attachment, user, group (observables) | their core forms | observables | observables-*-refused / -saved (14) |
| Member (observable) | Project > Settings > Members | collections | collections-member-refused |
| Issue relation (observable) | Related issues > Add | collections | collections-relation-refused, -relation-added |
| Issue / project (Files) / wiki page attachments (collection observables) | upload | collections | collections-issue-attachment-refused, -issue-attachment-added, -project-file-refused, -wiki-file-refused |
| Group users (collection observable) | Administration > Groups > Users | collections | collections-group-users-outsider, -group-users-reporter |
| Stylesheet on plugin and project pages (view hook) | any plugin page | smoke | smoke-11..15 |
| Decisions q1 and q2 per user (admin, manager, reporter, outsider) incl. refusals | issue form, Groups > Users, wiki attach | decisions | decisions-q1-admin/-manager/-reporter/-outsider, -q1-outsider-private-refused, -q2-admin-group-users, -q2-manager/-reporter/-outsider-groups-refused, -q2-manager-wiki-file, -q2-reporter-wiki, -q2-outsider-private-wiki-refused |
| Script audit (rake, CLI) | `rake redmine:custom_workflows:audit` | command, output under work list 2 | - |
| Core flows with the plugin installed | issue create/edit, context menu | core (kit) | core-* |

Behaviour recorded, not changed (the same on 2.1.3, measured in the before run):

- A `before_add` script of group users, project files and wiki page attachments runs and logs its error, but cannot
  stop the add (Rails ignores the return value of a collection callback; only issue attachments are stopped, through
  the issue's before_save). See "Open questions for Jan" 2.
- A refused member (member before_save) is not added, but the modal closes without a message (core re-validates the
  member, which then looks valid). A refused issue delete shows the workflow's error flash and core's "Successful
  deletion" next to it.
- A blank name is accepted (only uniqueness is validated); an imported workflow keeps the position of the file, and a
  new one gets `count + 1`, so positions can repeat and the list order look odd; syntax errors show the server path
  of the eval to the admin.
- Webhooks belong to a user: `/webhooks` as admin does not list the manager's.

## Open questions for Jan

Decided 2026-10-07 (see "Decided by Jan" at the top): q1 after_* failures (A), q2 collection before_add (A),
q3 upstream reports (B, not reported). Still open:

1. **New rake task** `redmine:custom_workflows:audit` (read-only, no setting, no schema change). Options: keep / drop.
   Recommendation: keep; it is how the production scripts get audited before the switch.

## GEOxyz changes to review or re-apply

None: this branch carries no GEOxyz commits of its own (upstream code only).

## After the upgrade (production)

Actions the person doing the upgrade must take, or know about, for this plugin:

- Before the switch, with the new plugin code in place (read-only, it does not need the app restarted):
  `bundle exec rake redmine:custom_workflows:audit RAILS_ENV=production`. Fix every reported script (syntax,
  removed Ruby/Rails API, `run_custom_workflows`/`run_shared_code` without `?`). Do this while the workflows are
  still on 5.x if possible: a script that raises at runtime is logged and shown as "custom workflow error".
- Scripts that raise in after_save/after_destroy: the save goes through and the user does not see the message (as on
  5.x, decided by Jan 2026-10-07, q1). Move such checks to before_save/before_destroy.
- A before_add script of group users, project files or wiki page attachments cannot refuse the add (as on 5.x,
  decided q2): put such checks in the before_save of the object (README "Where an error stops the change").
- The fixes of this branch are not reported upstream (decided q3); when upstream releases a new version, re-apply
  them from this branch.
- With the other GEOxyz plugins: Project > Settings answers 500 as long as redmine_mail_digest,
  redmine_itil_priority or redmine_depending_custom_fields patch `project_settings_tabs` with `alias_method` (see
  Results); not this plugin's code.
- `rake redmine:plugins:migrate`: nothing to migrate (same 16 migrations as 5.x).
- Deploy branch `redmine70-migration` (3.1.1 + these fixes) instead of `5.x`; `origin/5.x` itself now points at
  upstream 3.1.1 without these fixes.
- No settings, cron jobs or files. Webhooks need nothing from this plugin.
- Not tested here (no access): the real production scripts and data, real mail delivery (SMTP; tested with file
  delivery).

## How to test

```sh
./.codex/redmine_clone.sh 7.0-stable-GEOxyz      # or 5.1-stable / 6.1-stable / 7.0-stable
./.codex/test_setup.sh                                 # RMP_DB=mariadb for MariaDB, RMP_PROVISION_DB=0 if a server runs
./.codex/test_plugin.sh                                # minitest + rspec of this plugin
```

```sh
./.codex/start_server.sh       # real Redmine (production mode) with this plugin, seeded users and projects
./.codex/e2e.sh                # browser: smoke over the plugin's pages, core issue flows, test/e2e/*.mjs
./.codex/openai_review.sh      # independent OpenAI review of the diff, only when OPENAI_API_KEY is set
```
Write one scenario per function in `test/e2e/<function>.mjs` (example at the top of
`.codex/e2e/lib.mjs`); screenshots and a table per scenario land in `docs/e2e/`. Users:
`admin`, `manager` (every permission), `reporter` (no plugin permissions), `outsider` (no
membership); password `Redmine7Test!`. Needs Node with Playwright and Chromium
(`npm install -g playwright && npx playwright install --with-deps chromium`).

On GitHub the same runs by hand only: Actions > "Redmine tests (manual)" > Run workflow (tick
"e2e" for the browser run; screenshots come back as an artifact).

The coordinator's harness (`plugin-check.sh` in the migration kit, kept outside this repo) adds a
browser smoke test of every page the plugin adds and runs all GEOxyz plugins together; the
results quoted in the analysis come from it.

## How the migration session works (same for every plugin)

1. **Start**: `git fetch && git checkout redmine70-migration && git pull`. Read this whole file,
   including the analysis report at the bottom. Do not reopen decisions recorded here.
2. **Baseline, before you change anything**:
   - the plugin's tests on Redmine 7.0-stable-GEOxyz with PostgreSQL;
   - a real running Redmine with this plugin (`./.codex/start_server.sh`) and the browser run
     (`./.codex/e2e.sh`: smoke over every page the plugin adds, plus the core issue flows).
   Write the numbers here. Something already broken now is a finding, not your regression.
3. **Inventory of functions**: list every function of the plugin in this file, in a table
   "function | how a user reaches it | scenario | screenshot". Take them from the README,
   `init.rb` (permissions, menus, settings, project modules), routes, hooks and view
   overrides, macros, mail handling, API endpoints, rake tasks and cron jobs. This table is the
   coverage list for step 8; a function that is not in it will not be tested.
4. **GEOxyz changes**: go through the table above, one item at a time. Each kept or re-made change
   is its own commit with a test that proves it. Record the verdict in the table.
5. **Work list**: then the numbered list, in order. One concern per commit.
6. **Portability**: GEOxyz runs PostgreSQL 16 only (decided 2026-10-07). Keep SQL portable where that
   costs nothing; a MariaDB-only problem is a note here, not a blocker. Migrations must be reversible and
   are run down and up on PostgreSQL.
7. **Together**: run with the other GEOxyz plugins installed (the migration kit's harness, or
   `RMP_EXTRA_PLUGINS`). A failure that only appears in combination is a finding to record here.
8. **End to end, visually, every function**: on the real Redmine from `start_server.sh`
   (production mode, the way GEOxyz runs it), write one scenario per function in
   `test/e2e/<function>.mjs` with `.codex/e2e/lib.mjs` and run them with `./.codex/e2e.sh`.
   - Each function as the users that matter: `admin`, `manager` (every permission, the
     plugin's included), `reporter` (member without the plugin's permissions), `outsider`
     (no membership, private project must stay invisible).
   - The failure paths too: setting off, permission absent, empty state, invalid input, the
     value that used to raise. A refusal that is shown is evidence as much as a success.
   - One screenshot per function and per path, with a caption saying what it proves. Open
     every screenshot and look at it: a picture nobody looked at proves nothing. Commit them
     in `docs/e2e/` and list them in the inventory table.
   - Functions without a page (mail in and out, REST API, rake tasks, cron, webhooks): exercise
     them against the same running instance (mails land in `redmine/tmp/mails`, `t.mails()`
     reads them; API through `t.page.request`) and record command and result.
   - Before pictures where behaviour or layout changes: the branch GEOxyz runs today, on
     Redmine 5.1, same scenarios, `RMP_E2E_OUT=docs/e2e/before` (evidence only; no 5.1 support).
9. **Independent review**: first your own, adversarial: re-read the whole diff as if someone
   else wrote it and you are paid to reject it. Then, **when `OPENAI_API_KEY` is set in the
   session**, `./.codex/openai_review.sh`: it sends the diff of this branch to an OpenAI model
   and writes `docs/reviews/openai-<date>-<sha>.md`. Every finding gets a `Resolution:` line
   there (fixed in <commit>, with a test, or why not). Fix, re-run the tests and the e2e set,
   and run the review again until it has nothing new that you accept. Without the key: write
   "OpenAI review: skipped, no OPENAI_API_KEY" in the report; never send code anywhere else.
10. **After the upgrade**: anything the production upgrade must do for this plugin (data fixes,
    settings, cron, files, removed features) goes into the section "After the upgrade".
11. **Finish**: update "Status", the inventory and the work list in this file, push
    `redmine70-migration`, and report: what changed, test numbers on PostgreSQL, e2e
    numbers (scenarios, screenshots, problems), the review result, what is left, what needs Jan.

### Stop and ask Jan when
- a GEOxyz change would be lost or behave differently for users;
- a new gem, a new setting with user impact, or a schema change not required by Redmine 7 seems needed;
- the change would send data to an external service (the OpenAI review of the code diff is the
  one exception Jan approved, and only when the key is present);
- upstream and GEOxyz disagree on behaviour and both are defensible.

## Rules

- **Target**: Redmine 7.0-stable-GEOxyz (https://github.com/jcatrysse/redmine), Rails 8.1, Ruby 3.3+.
  Core sources for comparison: branches `7.0-stable`, `7.0-stable-GEOxyz` (`5.1-stable`, `6.1-stable` only to
  understand old behaviour). Database: PostgreSQL 16 (decided 2026-10-07).
- **Evidence**: never report a test, lint, browser check or review as passed without having seen
  it. Quote the summary lines; list the screenshots. "Should work" is not a result, and a green
  test suite is not proof that a feature works in the browser.
- **Tests**: never skip, delete or weaken a test. A test that encodes Redmine 5 markup or
  behaviour is updated to Redmine 7, with the reason in the commit. Every fix gets a test that
  fails without it.
- **Minimal diffs** in the plugin's own style. No reformatting, no unrelated refactoring.
  Something wrong elsewhere: write it down here, do not fix it in passing.
- **Security**: authorization on every action and entry point; `safe_attributes`, never
  `to_unsafe_hash` into `update`; no SQL built from params; no secrets in logs; no `html_safe` on
  user input.
- **Webhooks (new in Redmine 7)**: core sends issue payloads (core `issues/show.api.rsb`, rendered
  as the webhook owner) to webhook endpoints, past plugin hooks and controller patches. If the
  plugin hides, adds or changes issue data, make webhooks consistent with that or record why not.
- **Redmine 7 conventions**: SVG icons through `sprite_icon` (the `icon icon-*` CSS is gone),
  Propshaft assets under `assets/` (`/assets/plugin_assets/<id>/...`), the new header and user menu,
  `ContextMenus::*Controller`, Loofah-based text formatting, Chart.js as an ES module, sudo mode
  (on by default: `t.sudo()` in a scenario). The breaker list is in the migration kit's CHECKLIST.md.
- **Locales**: keep the locales the plugin ships in sync; translate a new key by matching the
  closest existing key in the same file, not from scratch; do not add new languages.
- **No 5.1 backports** (decided 2026-10-07): Redmine 5.1 compatibility is not a requirement; do not add code
  paths that exist only for 5.1. Nothing is cherry-picked to the default branch or the production branch.
- **Patching core**: a core method that other plugins also patch is patched with `prepend`, never with
  `alias_method` (mixing both recurses). A plugin that needs deface requires it without a version constraint.
- **Git**: work on `redmine70-migration` only; never push to the default branch; never force-push
  a branch someone else uses. Descriptive commit messages (what and why). Push after every
  commit, together with the updated status in this file: a cloud session can stop at a usage
  limit, and work that is not pushed is lost with its container.
- **GitHub Actions**: manual only (`workflow_dispatch`). Do not add push, pull_request or schedule
  triggers.

## Definition of done

- All items of the work list are done or explicitly deferred with a reason, in this file.
- The plugin's tests are green on Redmine 7.0-stable-GEOxyz with PostgreSQL
  (numbers in this file); boot, production-like eager load, migrations up/down OK.
- Every function in the inventory exercised end to end on a real running Redmine, with and
  without permissions and on its failure paths; `./.codex/e2e.sh` green; screenshots looked at,
  committed in `docs/e2e/` and listed.
- Review done: your own, and the OpenAI review when the key is present, every finding resolved
  in `docs/reviews/`.
- No new failure when run together with the other GEOxyz plugins.
- "After the upgrade" lists every action production needs; "Status" is current.


## Analysis report (2026-10-06, Dutch)

# redmine_custom_workflows
- Gebruikte branch: 5.x @ 0398974 (2024-10-15) - plugin id redmine_custom_workflows, versie 2.1.3 devel
- Upstream: anteo/redmine_custom_workflows - upstream HEAD master @ 38d6a53 (2026-07-24, tag v3.1.1); devel zelfde datum
- Fork t.o.v. upstream: 0 eigen commits, 41 upstream-commits ontbreken (5.x is voorouder van upstream master)
- Andere relevante branches: fork `master` = v3.0.0 (4a69e43, Redmine 6), fork `devel` = 09cbf97 (9 commits verder). Upstream heeft geen 5.x-branch meer, alleen master/devel. Upstream-lijn voor Redmine 7 = v3.1.0/v3.1.1 ("Compatibility with Redmine 7.0", a224ad1 + 8e8af9b).

## 1. Werkt out of the box op Redmine 7?   NEE
- `FAIL boot`: `lib/redmine_custom_workflows/patches/models/group_patch.rb:48` - `undefined method 'before_add_for_users' for class Group`. Core declareert `has_and_belongs_to_many :users` zonder `before_add`, dus Rails 8 maakt die callback-array niet aan. Hele app start niet.
- Resultaat: `results/1006-084705-s1-redmine_custom_workflows_origin_5_x`

## 2. Upstream sync?   SYNC AANBEVOLEN
- Wat: upstream master v3.1.1 (`38d6a53e11975a8f0a0d9c6cb5af3540607c6e5e`) -> `redmine70-migration` (merge in origin/5.x; inhoud = exact v3.1.1, want 5.x heeft geen eigen commits). Daarna GEOxyz omzetten van 5.x naar deze lijn (of fork-master fast-forwarden naar 38d6a53).
- Relevante upstream-commits: R6/R7-compat: 8a4218f Redmine 6.0.0 #350, 8654a4b delete_link, 95da97f Redmine 6.1, a224ad1 + 8e8af9b Compatibility with Redmine 7.0, 981249b/e1f38b5/4bd5976 #368 (Group habtm-warnings). Bugfix: 91d9333/5cc9e6a/9fd2117/09cbf97 #358 (migratie op SQL Server), 98826ef. Feature: 202c1b4 zh-locale. Ruis: rubocop, versiebumps, GPL v2->v3 (e7dd92a), CI, README, precompiled assets.
- Conflicten: geen (fast-forward-inhoud).
- Datapad 5.x -> 3.1.1: dezelfde 16 migraties met dezelfde versienummers; alleen commentaar en een SQL-Server-guard in reeds uitgevoerde migraties gewijzigd. Bestaande DB heeft dus niets te migreren. Gemeten: na install 16 `schema_migrations`-rijen, `redmine:plugins:migrate` dev+test OK, rollback naar 0 en terug OK. Tabelstructuur ongewijzigd, scripts in de DB blijven staan.
- Eigen GEOxyz-commits: geen.

## 3. Werkt na sync op Redmine 7?   DEELS
- Harness op `r70/trial-upstream` (38d6a53): boot OK, eager OK, migraties OK, minitest 65 runs / 106 assertions / 0 failures / 0 errors.
- `FAIL [plugin] /custom_workflows/1/export -> HTTP 0 page.goto: Download is starting` = vals alarm van de harness: export is een download. Handmatig gemeten: `200 application/xml`, `attachment; filename="as-err.xml"`, geldige XML.
- DEELS door een gedragswijziging in upstream 3.1.0 (zie 4): een after_save- of after_destroy-script dat faalt, geeft nu HTTP 500.

## 4. Complexiteit en blokkers   score 2
- Blokkers: `group_patch.rb:48` (5.x) - boot-crash - opgelost door upstream-merge (19bf326).
- Stille breuken / regressie (open, niet gefixt):
  - Upstream 3.1.0 (a224ad1) voegde `throw :abort if res == false` toe in **after_save_custom_workflows en after_destroy_custom_workflows** van alle 11 model-patches (bv. `issue_patch.rb:90`). In een Rails after-callback wordt `:abort` niet opgevangen. Gemeten op R7: een issue-after_save-script dat `WorkflowError` raised -> `UncaughtThrowError (uncaught throw :abort)` -> `PUT /issues/1.json` = **HTTP 500** (development.log, issue_patch.rb:90). De wijziging wordt teruggedraaid (transactie rollback). Hetzelfde voor een runtime-exceptie in een after_save-script. Op 5.x werd zo'n fout alleen gelogd en als foutmelding gezet; de save ging door. before_save, before_destroy en collection-callbacks (group_users e.d.) zijn niet geraakt; group_users before_add/after_add vuren correct (gemeten).
  - Gevolg voor GEOxyz: elk bestaand after_save/after_destroy-script dat op R7 faalt (bv. door `to_s(:db)`, `update_attributes`, `File.exists?`, `errors[:x] << ...` in de scriptcode) geeft eindgebruikers nu een 500 in plaats van een gelogde fout.
  - De patches declareren `acts_as_attachable` (Issue, Project, WikiPage) en `has_and_belongs_to_many :users` (Group) opnieuw met gekopieerde core-opties. Vergeleken met R7 core: identiek. Wijzigt core die declaraties in 7.x, dan overschrijft de plugin ze stil.
  - Iconen: `app/views/custom_workflows/_form.html.erb:75,89,104,124` `class="icon icon-collapsed"` op legends (cosmetisch). Index en acties gebruiken al `sprite_icon` (gemeten: svg aanwezig).
- Overlap met Redmine 7 core: geen. Webhooks (#29664) vervangen geen scripts.
- Open werk voor ansif:
  1. Scripts in de productie-DB auditen vóór de upgrade: `SELECT id, name, observable, active FROM custom_workflows;` en kolommen `shared_code, before_save, after_save, before_destroy, after_destroy, before_add, after_add, before_remove, after_remove` grep'en op de breakers uit CHECKLIST.md (`to_s(:`, `update_attributes`, `File.exists?`, `errors[`, `serialize`, `URI.escape`, `.taint`).
  2. Beslissen over de after_*-`throw :abort`-regressie: (a) zo laten (falend after-script = 500 + rollback), (b) lokaal terugdraaien naar het 5.x-gedrag (alleen loggen), of (c) upstream melden. Elk after_save-script met `raise WorkflowError` moet in elk geval naar before_save.
  3. Testen of XML-exports van 5.x importeren op 3.1.1 (niet geverifieerd).

## Branch redmine70-migration
- Basis: origin/5.x @ 0398974 + merge upstream 38d6a53 (--no-ff)
- Commits: 19bf326 Merge upstream anteo/redmine_custom_workflows master (38d6a53) for Redmine 7
- Eindresultaat harness (`results/1006-090307-s1-redmine_custom_workflows_redmine70-migration`): boot OK (3.1.1), eager OK, migraties dev+test OK, rollback OK, minitest 65 runs / 0 failures / 0 errors, smoke 64/65 (de ene FAIL is de export-download, vals alarm)
- Rollback migraties: OK

