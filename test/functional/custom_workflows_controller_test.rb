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

# Custom workflows controller test
class CustomWorkflowsControllerTest < RedmineCustomWorkflows::Test::TestCase
  def setup
    super
    @cw1 = CustomWorkflow.find 1
  end

  def test_truth
    assert_kind_of CustomWorkflow, @cw1
  end

  def test_index_admin
    post '/login', params: { username: 'admin', password: 'admin' }
    get '/custom_workflows'
    assert_response :success
  end

  def test_index_non_admin
    post '/login', params: { username: 'jsmith', password: 'jsmith' }
    get '/custom_workflows'
    assert_response :forbidden
  end

  def test_edit_collapsible_legends_have_svg_icons
    @cw1.update_column :before_destroy, ''
    @cw1.update_column :after_destroy, ''
    post '/login', params: { username: 'admin', password: 'admin' }
    get "/custom_workflows/#{@cw1.id}/edit"
    assert_response :success
    # The save scripts are filled in, so their fieldset is open; the destroy scripts are empty, so it is closed
    assert_select 'fieldset.collapsible:not(.collapsed) > legend.icon-expanded svg use[href$="#icon--angle-down"]', 1
    assert_select 'fieldset.collapsible.collapsed > legend.icon-collapsed svg.icon-rtl use[href$="#icon--angle-right"]', 1
  end
end
