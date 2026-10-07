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

# A before_add script of a collection observable runs and records its error, but cannot stop the add (decided by Jan,
# 2026-10-07: keep this and document it, see README "Where an error stops the change").
class CollectionCallbacksTest < RedmineCustomWorkflows::Test::UnitTest
  def setup
    CustomWorkflow.update_all active: false
    User.current = User.find 1
    CustomWorkflow.new(name: 'No users', observable: 'group_users', active: true, position: 100,
                       before_add: "raise RedmineCustomWorkflows::Errors::WorkflowError, 'No users'")
                  .save!(validate: false)
  end

  def teardown
    User.current = nil
  end

  def test_failing_group_users_before_add_logs_but_adds
    group = Group.find 10
    user = User.find 2
    assert_not_includes group.users, user
    group.users << user
    assert_includes group.reload.users, user
    assert_includes group.errors[:base], 'No users'
  end
end
