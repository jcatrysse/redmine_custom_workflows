# project_settings

Run 2026-10-06T20:03:14.024Z against http://127.0.0.1:3000.

| screenshot | user | URL | shows |
|---|---|---|---|
| ![](project_settings-tab.png) | manager | `/projects/e2e-project/settings/custom_workflows` | Manager: the tab lists the project workflows; for-all ones checked and locked, the inactive one greyed |
| ![](project_settings-not-enabled.png) | manager | `/issues/1` | Not enabled for this project: saving the issue does not run "E2E project only" |
| ![](project_settings-enabled.png) | manager | `/projects/e2e-project/settings/custom_workflows` | Saved: notice, back on the Custom workflows tab, "E2E project only" enabled |
| ![](project_settings-runs.png) | manager | `/issues/1` | Enabled: saving an issue of this project now runs it (warning flash) |
| ![](project_settings-reporter-refused.png) | reporter | `/projects/e2e-project/settings/custom_workflows` | Reporter (no project settings permission) is refused |
| ![](project_settings-no-tab.png) | reporter | `/projects/e2e-private/settings` | With every permission but "Manage project workflows": the settings have no Custom workflows tab |
| ![](project_settings-forged-ignored.png) | admin | `/projects/e2e-private/settings/custom_workflows` | A forged custom_workflow_ids from that user was ignored: nothing enabled for e2e-private |
| ![](project_settings-outsider-refused.png) | outsider | `/projects/e2e-private/settings/custom_workflows` | A non-member is refused the private project |
