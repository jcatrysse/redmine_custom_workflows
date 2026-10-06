# export_import

Run 2026-10-06T20:44:01.783Z against http://127.0.0.1:3000.

| screenshot | user | URL | shows |
|---|---|---|---|
| ![](export_import-export.png) | admin | `/custom_workflows` | Export clicked: "E2E issue relation.xml" downloaded (1227 bytes, saved next to the screenshots) |
| ![](export_import-from-2-1-3-dialog.png) | admin | `/custom_workflows` | Import dialog with an export made by plugin 2.1.3 on Redmine 5.1 |
| ![](export_import-from-2-1-3.png) | admin | `/custom_workflows` | Imported: success notice, the workflow is listed and inactive until an admin activates it |
| ![](export_import-from-2-1-3-edit.png) | admin | `/custom_workflows/20/edit` | The imported workflow keeps its scripts, author and description |
| ![](export_import-round-trip-dialog.png) | admin | `/custom_workflows` | Import dialog with the export just downloaded |
| ![](export_import-round-trip.png) | admin | `/custom_workflows` | Re-importing an export of an existing workflow adds a copy named "..._1", inactive |
| ![](export_import-invalid-dialog.png) | admin | `/custom_workflows` | Import dialog with a file that is not XML |
| ![](export_import-invalid.png) | admin | `/custom_workflows` | An invalid file is refused with an error, nothing is added |
| ![](export_import-syntax-dialog.png) | admin | `/custom_workflows` | Import dialog with a workflow whose script has a syntax error |
| ![](export_import-syntax.png) | admin | `/custom_workflows` | Imported inactive even with a syntax error (scripts are only checked for active workflows) |
| ![](export_import-manager-refused.png) | manager | `/custom_workflows/1/export` | Export as a non-admin: HTTP 403 |
