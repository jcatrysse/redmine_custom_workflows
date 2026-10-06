# frozen_string_literal: true

# Redmine plugin for Custom Workflows
#
# Anton Argirov, Karel Pičman <karel.picman@kontron.com>
#
# This file is part of Redmine OAuth plugin.
#
# Redmine Custom Workflows plugin is free software: you can redistribute it and/or modify it under the terms of the GNU
# General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your
#  option) any later version.
#
# Redmine Custom Workflows plugin is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
# even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
# for more details.
#
# You should have received a copy of the GNU General Public License along with Redmine Custom Workflows plugin. If not,
# see <https://www.gnu.org/licenses/>.

namespace :redmine do
  namespace :custom_workflows do
    desc 'Lists stored workflow scripts that use code removed in Ruby 3.3 / Rails 8.1 (read-only)'
    task audit: :environment do
      findings = RedmineCustomWorkflows::ScriptAudit.findings
      findings.each do |workflow, field, line, message|
        state = workflow.active? ? 'active' : 'inactive'
        location = line ? "#{field}:#{line}" : field
        puts "##{workflow.id} #{workflow.name} (#{workflow.observable}, #{state}) #{location}: #{message}"
      end
      puts "#{findings.size} finding(s) in #{CustomWorkflow.count} workflow(s)"
    end
  end
end
