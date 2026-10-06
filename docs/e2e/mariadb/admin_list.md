# admin_list

Run 2026-10-06T20:06:59.138Z against http://127.0.0.1:3000.

| screenshot | user | URL | shows |
|---|---|---|---|
| ![](admin_list-admin-menu.png) | admin | `/admin` | Administration menu with the Custom workflows entry and its icon |
| ![](admin_list-list.png) | admin | `/custom_workflows` | All workflows in order, inactive one greyed, SVG icons for reorder, (de)activate, export, delete |
| ![](admin_list-actions-menu.png) | admin | `/custom_workflows` | The actions menu with Import |
| ![](admin_list-manager-refused.png) | manager | `/custom_workflows` | A project manager with every project permission is refused: administrators only |
| ![](admin_list-reporter-refused.png) | reporter | `/custom_workflows/new` | A member without the plugin permission is refused the new form |
| ![](admin_list-anonymous-login.png) | anonymous | `/login?back_url=http%3A%2F%2F127.0.0.1%3A3000%2Fcustom_workflows` | Anonymous is sent to the login page |
