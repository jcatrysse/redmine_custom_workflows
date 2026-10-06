# Redmine 7 migration: redmine_custom_workflows

Start a Claude Code (or Codex) session on this repository, branch `redmine70-migration`, with:

> Read CLAUDE.md and docs/REDMINE7-MIGRATION.md, then carry out the Redmine 7 migration of this
> plugin as described there, on branch redmine70-migration. Report to me in Dutch at the end.

This file is the plan and the memory of that work. Update it as you go: verdicts, results,
what is left. Written 2026-10-06 from a measured analysis (report at the bottom).

## Status

| | |
|---|---|
| Plugin id | `redmine_custom_workflows` |
| GEOxyz runs today | `5.x` |
| Upstream | anteo/redmine_custom_workflows master @ 38d6a53e11975a8f0a0d9c6cb5af3540607c6e5e (v3.1.1, 2026-07-24) |
| Runs on Redmine 7 as is | NEE |
| Upstream sync | SYNC AANBEVOLEN: upstream master v3.1.1 (38d6a53) into redmine70-migration (from origin/5.x, which has no own commits); switch GEOxyz from 5.x to the 3.1.x line. Same 16 migrations, no data migration needed. |
| After sync | DEELS |
| Complexity (1 trivial .. 5 rewrite) | 2 |
| Measured on | Redmine 7.0.1 (7.0-stable-GEOxyz + latest 7.0-stable), Rails 8.1.3.1, Ruby 3.3.6, PostgreSQL 16 and MariaDB 10.11 |
| Branch head when this file was written | `19bf326` |

## Already on this branch

- `19bf326` Merge upstream anteo/redmine_custom_workflows master (38d6a53) for Redmine 7

## Work list for the migration session

In this order: things that break, security, the GEOxyz changes, the open items, then the checks.

**Priority items**

1. Decide on the upstream 3.1 behaviour change: a failing after_save/after_destroy script now raises (HTTP 500, rollback) where 5.x only logged it.

**Open items from the analysis** (Dutch; where they repeat a priority item, the priority item wins)

2. Audit the custom workflow scripts stored in the production DB for Rails 8/Ruby 3.3 breakers before upgrading (to_s(:db), update_attributes, File.exists?, errors[:x] <<, URI.escape)
3. Upstream 3.1.0 added throw :abort in after_save/after_destroy callbacks: a failing after_save/after_destroy script now raises UncaughtThrowError -> HTTP 500 + rollback (measured, issue_patch.rb:90); decide keep / revert locally / report upstream; move any 'raise WorkflowError' from after_save to before_save
4. Verify import of workflow XML exports made on 5.x (not verified)
5. Cosmetic: icon icon-collapsed legends in _form.html.erb

**Checks**

6. Run the plugin's whole test suite on Redmine 7.0-stable-GEOxyz with PostgreSQL AND MariaDB, and once on 5.1-stable if the branch is meant to stay 5.1-compatible.
7. Check Redmine 7 webhooks against this plugin (see "Rules"), and note the result here even if nothing is needed.
8. Verify every feature of the plugin by hand on a running Redmine 7 (screenshots).

## GEOxyz changes to review or re-apply

None: this branch carries no GEOxyz commits of its own (upstream code only).

## After the upgrade (production)

Actions the person doing the upgrade must take, or know about, for this plugin:

- Audit the stored workflow scripts (`SELECT * FROM custom_workflows`) for Ruby 3.3 / Rails 8.1 breakers before they run on production; move after_save scripts that raise to before_save.

## How to test

```sh
./.codex/redmine_clone.sh 7.0-stable-GEOxyz      # or 5.1-stable / 6.1-stable / 7.0-stable
./.codex/test_setup.sh                                 # RMP_DB=mariadb for MariaDB, RMP_PROVISION_DB=0 if a server runs
./.codex/test_plugin.sh                                # minitest + rspec of this plugin
```
On GitHub the same runs by hand only: Actions > "Redmine tests (manual)" > Run workflow.

The coordinator's harness (`plugin-check.sh` in the migration kit, kept outside this repo) adds a
browser smoke test of every page the plugin adds and runs all GEOxyz plugins together; the
results quoted in the analysis come from it.

## How the migration session works (same for every plugin)

1. **Start**: `git fetch && git checkout redmine70-migration && git pull`. Read this whole file,
   including the analysis report at the bottom. Do not reopen decisions recorded here.
2. **Baseline**: set up Redmine 7.0-stable-GEOxyz and run the plugin's tests on PostgreSQL and
   on MariaDB (see "How to test"). Write the numbers here before you change anything.
3. **GEOxyz changes**: go through the table above, one item at a time. Each kept or re-made change
   is its own commit with a test that proves it. Record the verdict in the table.
4. **Work list**: then the numbered list, in order. One concern per commit.
5. **Portability**: everything must run on Redmine's supported databases (PostgreSQL,
   MySQL/MariaDB; SQLite where the plugin already supports it). Migrations must be reversible and
   are run down and up on PostgreSQL and MariaDB.
6. **Browser**: start a Redmine 7 with this plugin, exercise every feature as admin and as a
   normal user with and without the plugin's permissions, and save screenshots (before on 5.1 or
   the old branch, after on 7.0) where behaviour or layout matters.
7. **Together**: run with the other GEOxyz plugins installed (the migration kit's harness, or
   `RMP_EXTRA_PLUGINS`). A failure that only appears in combination is a finding to record here.
8. **After the upgrade**: anything the production upgrade must do for this plugin (data fixes,
   settings, cron, files, removed features) goes into the section "After the upgrade".
9. **Finish**: update "Status" and the work list in this file, push `redmine70-migration`, and
   report: what changed, test numbers on both databases, what is left, what needs Jan.

### Stop and ask Jan when
- a GEOxyz change would be lost or behave differently for users;
- a new gem, a new setting with user impact, or a schema change not required by Redmine 7 seems needed;
- the change would send data to an external service;
- upstream and GEOxyz disagree on behaviour and both are defensible.

## Rules

- **Target**: Redmine 7.0-stable-GEOxyz (https://github.com/jcatrysse/redmine), Rails 8.1, Ruby 3.3+.
  Core sources for comparison: branches `5.1-stable`, `6.1-stable`, `7.0-stable`, `7.0-stable-GEOxyz`.
- **Evidence**: never report a test, lint or browser check as passed without having seen it.
  Quote the summary lines. "Should work" is not a result.
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
  `ContextMenus::*Controller`, Loofah-based text formatting, Chart.js as an ES module.
  The breaker list is in the migration kit's CHECKLIST.md.
- **Locales**: keep the locales the plugin ships in sync; translate a new key by matching the
  closest existing key in the same file, not from scratch; do not add new languages.
- **5.1 compatibility**: prefer fixes that also run on Redmine 5.1 so they can be merged early;
  say so when a fix cannot.
- **Git**: work on `redmine70-migration` only; never push to the default branch; never force-push
  a branch someone else uses. Descriptive commit messages (what and why).
- **GitHub Actions**: manual only (`workflow_dispatch`). Do not add push, pull_request or schedule
  triggers.

## Definition of done

- All items of the work list are done or explicitly deferred with a reason, in this file.
- The plugin's tests are green on Redmine 7.0-stable-GEOxyz with PostgreSQL and MariaDB
  (numbers in this file); boot, production-like eager load, migrations up/down OK.
- Every feature verified by hand on Redmine 7; screenshots listed.
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

