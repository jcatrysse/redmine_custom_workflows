# frozen_string_literal: true

# Redmine plugin for Document Management System "Features"
#
# Karel Pičman <karel.picman@kontron.com>
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

# Project controller patch test
class ProjectsControllerPatchTest < RedmineCustomWorkflows::Test::TestCase
  def setup
    super
    post '/login', params: { username: 'jsmith', password: 'jsmith' }
    @controller = ProjectsController.new
  end

  def test_update_with_cw
    patch "/projects/#{@project1.id}", params: { project: { name: 'Updated name' } }
    assert_redirected_to settings_project_path(@project1)
    assert_equal 'Custom workflow', @controller.flash[:notice]
  end

  def test_cw_env
    patch "/projects/#{@project1.id}", params: { project: { name: 'Updated name' } }
    assert_redirected_to settings_project_path(@project1)
    assert_equal request.remote_ip, @controller.flash[:warning]
  end

  def test_settings_tab_comes_back_to_itself
    Role.find(1).add_permission! :manage_project_workflow
    get "/projects/#{@project1.id}/settings/custom_workflows"
    assert_response :success
    assert_select '#tab-content-custom_workflows input[name=tab][value=custom_workflows]'
    patch "/projects/#{@project1.id}",
          params: { tab: 'custom_workflows', project: { custom_workflow_ids: ['', '1'] } }
    assert_redirected_to settings_project_path(@project1, 'custom_workflows')
    assert_equal [1], @project1.reload.custom_workflow_ids
  end

  def test_custom_workflow_ids_ignored_without_permission
    Role.find(1).remove_permission! :manage_project_workflow
    ids = @project1.custom_workflow_ids
    get "/projects/#{@project1.id}/settings"
    assert_select '#tab-custom_workflows', 0
    patch "/projects/#{@project1.id}", params: { project: { custom_workflow_ids: [''] } }
    assert_redirected_to settings_project_path(@project1)
    assert_equal ids, @project1.reload.custom_workflow_ids
  end
end
