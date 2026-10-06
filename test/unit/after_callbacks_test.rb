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

# A failing after_save or after_destroy script must not break the save or the destroy: the record is already
# written, so the error is logged and added to the object's errors, as in 2.x (before 3.1.0 an UncaughtThrowError
# turned it into an HTTP 500 and rolled the change back).
class AfterCallbacksTest < RedmineCustomWorkflows::Test::UnitTest
  OBJECTS = {
    issue: -> { Issue.find 1 },
    issue_relation: -> { IssueRelation.find 1 },
    user: -> { User.find 8 },
    member: -> { Member.find 1 },
    group: -> { Group.find 10 },
    attachment: -> { Attachment.find 1 },
    project: -> { Project.find 5 },
    wiki_content: -> { WikiContent.find 1 },
    time_entry: -> { TimeEntry.find 1 },
    version: -> { Version.find 4 }
  }.freeze

  def setup
    CustomWorkflow.update_all active: false
    User.current = User.find 1
  end

  def teardown
    User.current = nil
  end

  OBJECTS.each do |observable, finder|
    define_method :"test_failing_after_save_keeps_the_saved_#{observable}" do
      add_workflow observable, :after_save
      object = finder.call
      object.updated_on = Time.current if object.has_attribute?(:updated_on)
      assert object.save, "#{observable} not saved"
      assert_includes object.errors[:base], 'after_save failed'
    end

    define_method :"test_raising_after_save_keeps_the_saved_#{observable}" do
      add_workflow observable, :after_save, "raise 'unexpected'"
      object = finder.call
      assert object.save, "#{observable} not saved"
      assert_includes object.errors[:base], I18n.t('activerecord.errors.messages.custom_workflow_error')
    end

    define_method :"test_failing_after_destroy_keeps_the_destroyed_#{observable}" do
      add_workflow observable, :after_destroy
      object = finder.call
      assert object.destroy, "#{observable} not destroyed"
      assert_nil object.class.find_by(id: object.id)
      assert_includes object.errors[:base], 'after_destroy failed'
    end
  end

  private

  def add_workflow(observable, event, script = nil)
    script ||= "raise RedmineCustomWorkflows::Errors::WorkflowError, '#{event} failed'"
    workflow = CustomWorkflow.new(name: "#{observable} #{event}", observable: observable.to_s, is_for_all: true,
                                  active: true, position: 100)
    workflow[event] = script
    workflow.save!(validate: false)
  end
end
