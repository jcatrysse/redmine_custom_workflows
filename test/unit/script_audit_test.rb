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

require File.expand_path('../../test_helper', __FILE__)

# Script audit test class
class ScriptAuditTest < RedmineCustomWorkflows::Test::UnitTest
  def test_clean_script
    assert_empty RedmineCustomWorkflows::ScriptAudit.check("self.subject = subject.strip\nupdate(done_ratio: 10)")
  end

  def test_removed_api
    found = RedmineCustomWorkflows::ScriptAudit.check(
      "x = due_date.to_s(:db)\nupdate_attributes(a: 1)\nFile.exists?('/tmp')\nerrors[:base] << 'no'\n" \
      "URI.escape(s)\nCustomWorkflow.run_custom_workflows(:issue, self, :after_save)"
    )
    assert_equal [1, 2, 3, 4, 5, 6], found.map(&:first)
  end

  def test_renamed_method_with_question_mark_is_fine
    assert_empty RedmineCustomWorkflows::ScriptAudit.check('CustomWorkflow.run_shared_code?(self)')
  end

  def test_syntax_error
    found = RedmineCustomWorkflows::ScriptAudit.check("if true\n  x = 1\n")
    assert_equal 1, found.size
    assert_nil found.first.first
    assert_match(/syntax error/, found.first.last)
  end

  def test_findings_name_workflow_and_field
    workflow = CustomWorkflow.find 1
    workflow.after_save = "raise RedmineCustomWorkflows::Errors::WorkflowError, 'too late'"
    workflow.before_save = 'Time.now.to_s(:db)'
    found = RedmineCustomWorkflows::ScriptAudit.findings([workflow])
    assert_equal([[workflow, :before_save, 1], [workflow, :after_save, nil]], found.map { |f| f.first(3) })
    assert_equal RedmineCustomWorkflows::ScriptAudit::AFTER_ERROR_NOTE, found.last.last
  end

  def test_rake_task
    require 'rake'
    Rails.application.load_tasks unless Rake::Task.task_defined?('redmine:custom_workflows:audit')
    CustomWorkflow.find(1).update_column :before_save, 'update_attributes(subject: "x")'
    out, = capture_io { Rake::Task['redmine:custom_workflows:audit'].execute }
    assert_match(/#1 Issue CW test \(issue, active\) before_save:1: update_attributes was removed/, out)
    assert_match(/finding\(s\) in \d+ workflow\(s\)/, out)
  end
end
