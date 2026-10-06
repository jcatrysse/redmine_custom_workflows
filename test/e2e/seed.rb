# frozen_string_literal: true

# Workflows for the end-to-end scenarios in test/e2e, run by .codex/start_server.sh after the generic seed.
# Idempotent: every workflow named "E2E ..." is replaced. Each one shows a notice when it runs and refuses the
# save when the edited text contains "[refuse]", so a scenario can prove both paths through the user interface.

User.current = User.find_by(login: 'admin')
CustomWorkflow.where("name LIKE 'E2E %'").destroy_all

def refuse(field, what)
  "if #{field}.to_s.include?('[refuse]')\n" \
    "  raise RedmineCustomWorkflows::Errors::WorkflowError, 'E2E: #{what} with [refuse] is refused by a custom workflow'\n" \
    "end\n"
end

def notice(what)
  "self.custom_workflow_messages[:notice] = 'E2E: #{what} custom workflow ran'\n"
end

def e2e_workflow(name, observable, is_for_all: true, active: true, **scripts)
  workflow = CustomWorkflow.new(name: name, observable: observable, author: 'admin@example.net',
                                description: "#{name}, for the end-to-end scenarios.", is_for_all: is_for_all,
                                active: active)
  scripts.each { |event, code| workflow[event] = code }
  workflow.position = CustomWorkflow.maximum(:position).to_i + 1
  workflow.save!
  workflow
end

e2e_workflow 'E2E shared code', 'shared', shared_code: "def e2e_shared_tag\n  ' [shared]'\nend\n"

e2e_workflow 'E2E issue', 'issue',
             before_save: refuse('subject', 'an issue') +
               "if subject.to_s.include?('[cw]')\n  self.done_ratio = 50\n" \
               "  self.custom_workflow_messages[:notice] = 'E2E: done ratio set to 50% by a custom workflow'\nend\n" \
               "self.subject = subject.sub('[shared]', '').strip + e2e_shared_tag if subject.to_s.include?('[shared]')\n" \
               "self.custom_workflow_messages[:warning] = \"E2E: remote IP \#{custom_workflow_env[:remote_ip]}\" " \
               "if subject.to_s.include?('[env]')\n",
             after_save: "if subject.to_s.include?('[after-fail]')\n" \
               "  raise RedmineCustomWorkflows::Errors::WorkflowError, 'E2E: after_save failed'\nend\n" \
               "if subject.to_s.include?('[after-crash]')\n  nil.no_such_method\nend\n" \
               "if subject.to_s.include?('[mail]') && saved_change_to_subject?\n" \
               "  CustomWorkflowMailer.deliver_custom_email(User.find_by(login: 'manager'), " \
               "subject: \"E2E custom mail for issue #\#{id}\", text_body: \"Issue '\#{subject}' was saved.\")\nend\n",
             before_destroy: "if subject.to_s.include?('[keep]')\n" \
               "  self.custom_workflow_messages[:error] = 'E2E: this issue cannot be deleted'\n" \
               "  raise RedmineCustomWorkflows::Errors::WorkflowError, 'E2E: this issue cannot be deleted'\nend\n"

e2e_workflow 'E2E project only', 'issue',
             before_save: "self.custom_workflow_messages[:warning] = 'E2E: project-only workflow ran' " \
               "if subject.to_s.include?('[project-only]')\n",
             is_for_all: false
e2e_workflow 'E2E inactive', 'issue', before_save: refuse('subject', 'never'), active: false

e2e_workflow 'E2E version', 'version', before_save: refuse('name', 'a version') + notice('version')
e2e_workflow 'E2E time entry', 'time_entry', before_save: refuse('comments', 'a time entry') + notice('time entry')
e2e_workflow 'E2E project', 'project', before_save: refuse('name', 'a project') +
                                                    "#{notice('project')[0..-2]} if name.to_s.include?('[cw]')\n"
e2e_workflow 'E2E wiki content', 'wiki_content', before_save: refuse('text', 'a wiki text') + notice('wiki content')
e2e_workflow 'E2E member', 'member',
             before_save: "if principal&.login == 'outsider' && project&.identifier == 'e2e-private'\n" \
               "  raise RedmineCustomWorkflows::Errors::WorkflowError, 'E2E: outsider may not join e2e-private'\n" \
               "end\n" + notice('member')
e2e_workflow 'E2E user', 'user', before_save: refuse('firstname', 'a user') + notice('user')
e2e_workflow 'E2E group', 'group', before_save: refuse('lastname', 'a group') + notice('group')
e2e_workflow 'E2E group users', 'group_users',
             before_add: "if @user.login == 'outsider'\n" \
               "  raise RedmineCustomWorkflows::Errors::WorkflowError, 'E2E: outsider may not join a group'\nend\n"
e2e_workflow 'E2E attachment', 'attachment', before_save: refuse('description', 'an attachment')
e2e_workflow 'E2E issue relation', 'issue_relation',
             before_save: "if relation_type == 'blocks'\n" \
               "  raise RedmineCustomWorkflows::Errors::WorkflowError, 'E2E: blocks relations are refused'\nend\n" +
               notice('issue relation')
%w[issue project wiki_page].each do |container|
  e2e_workflow "E2E #{container.tr('_', ' ')} attachments", "#{container}_attachments",
               before_add: "if @attachment.filename.include?('refuse')\n" \
                 "  raise RedmineCustomWorkflows::Errors::WorkflowError, 'E2E: #{container} file refused'\nend\n",
               after_add: "Rails.logger.info \"E2E #{container} attachment added: \#{@attachment.filename}\"\n"
end

Group.find_or_create_by!(lastname: 'E2E group')

# reporter may manage e2e-private, but without this plugin's permission: the settings tab must stay hidden
role = Role.find_or_initialize_by(name: 'E2E without custom workflows')
role.permissions = Redmine::AccessControl.permissions.reject(&:public?).map(&:name) - [:manage_project_workflow]
role.save!
private_project = Project.find_by(identifier: 'e2e-private')
reporter = User.find_by(login: 'reporter')
unless Member.exists?(user_id: reporter.id, project_id: private_project.id)
  Member.create!(principal: reporter, project: private_project, roles: [role])
end
private_project.custom_workflows = []

# Webhooks (new in Redmine 7): issue events for the manager, to a receiver the webhooks scenario starts. Core
# refuses loopback targets, so use this machine's own address.
ip = Socket.ip_address_list.find { |a| a.ipv4? && !a.ipv4_loopback? }&.ip_address
if defined?(Webhook) && ip
  Setting.webhooks_enabled = '1'
  Webhook.where("url LIKE '%:3999/hook'").destroy_all
  Webhook.create!(url: "http://#{ip}:3999/hook", user: User.find_by(login: 'manager'),
                  projects: [Project.find_by(identifier: 'e2e-project')], active: true,
                  events: %w[issue.created issue.updated])
end

puts "E2E workflows: #{CustomWorkflow.where("name LIKE 'E2E %'").count}"
