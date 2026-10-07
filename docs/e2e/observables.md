# observables

Run 2026-10-07T16:19:15.148Z against http://127.0.0.1:3000.

| screenshot | user | URL | shows |
|---|---|---|---|
| ![](observables-version-refused.png) | manager | `/projects/e2e-project/versions` | Version: the workflow refuses a name with [refuse] |
| ![](observables-version-saved.png) | manager | `/projects/e2e-project/versions/new` | Version: created, with the workflow notice |
| ![](observables-time-entry-refused.png) | manager | `/time_entries` | Time entry: refused by its workflow |
| ![](observables-time-entry-saved.png) | manager | `/projects/e2e-project/time_entries/new` | Time entry: logged, with the workflow notice |
| ![](observables-project-refused.png) | manager | `/projects/e2e-project` | Project settings: the project workflow refuses the new name |
| ![](observables-project-saved.png) | manager | `/projects/e2e-project/settings` | Project settings: saved, with the workflow notice |
| ![](observables-wiki-refused.png) | manager | `/projects/e2e-project/wiki/Wiki` | Wiki: the wiki content workflow refuses the text |
| ![](observables-wiki-saved.png) | manager | `/projects/e2e-project/wiki/Wiki` | Wiki: saved, with the workflow notice |
| ![](observables-attachment-refused.png) | manager | `/attachments/issues/1` | Attachment: editing a description that the attachment workflow refuses |
| ![](observables-attachment-saved.png) | manager | `/attachments/issues/1/edit` | Attachment: description saved |
| ![](observables-user-refused.png) | admin | `/users/6` | User: the user workflow refuses the first name |
| ![](observables-user-saved.png) | admin | `/users/6/edit` | User: saved, with the workflow notice |
| ![](observables-group-refused.png) | admin | `/groups/8` | Group: the group workflow refuses the name |
| ![](observables-group-saved.png) | admin | `/groups/8/edit` | Group: saved, with the workflow notice |
