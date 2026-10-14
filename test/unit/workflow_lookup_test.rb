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

# Saving many records (a group of users added to a project saves one member per user) must not ask the database
# per record whether there is any workflow for that observable or any shared code.
class WorkflowLookupTest < RedmineCustomWorkflows::Test::UnitTest
  def setup
    CustomWorkflow.where.not(observable: 'issue').update_all active: false
    RedmineCustomWorkflows::Current.reset
    User.current = User.find 1
  end

  def teardown
    User.current = nil
  end

  def test_saving_more_members_does_not_query_workflows_per_member
    save_members 1
    one = custom_workflow_queries { save_members 2 }
    two = custom_workflow_queries { save_members 4 }
    assert_equal one, two, 'custom_workflows queried per member save'
  end

  def test_workflow_added_after_a_first_save_still_runs
    save_members 1
    CustomWorkflow.new(name: 'Member notice', observable: 'member', is_for_all: true, active: true, position: 100,
                       before_save: "self.custom_workflow_messages[:notice] = 'member workflow ran'")
                  .save!(validate: false)
    member = new_member
    assert member.save
    assert_equal 'member workflow ran', member.custom_workflow_messages[:notice]
  end

  def test_activated_shared_code_still_runs
    save_members 1
    CustomWorkflow.new(name: 'Shared', observable: 'shared', active: true, position: 101,
                       shared_code: "self.custom_workflow_messages[:warning] = 'shared ran'")
                  .save!(validate: false)
    member = new_member
    assert member.save
    assert_equal 'shared ran', member.custom_workflow_messages[:warning]
  end

  private

  def new_member
    user = User.create!(login: "lookup#{User.count}", firstname: 'L', lastname: 'U',
                        mail: "lookup#{User.count}@example.net")
    Member.new(principal: user, project: Project.find(1), role_ids: [1])
  end

  def save_members(count)
    count.times { assert new_member.save }
  end

  def custom_workflow_queries(&)
    count = 0
    counter = lambda { |*, payload|
      count += 1 if payload[:sql] =~ /custom_workflows/i && payload[:name] != 'SCHEMA'
    }
    ActiveSupport::Notifications.subscribed(counter, 'sql.active_record', &)
    count
  end
end
