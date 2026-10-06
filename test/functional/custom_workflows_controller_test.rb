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

  def test_import_of_an_export_made_by_2_1_3
    post '/login', params: { username: 'admin', password: 'admin' }
    file = Rack::Test::UploadedFile.new(File.expand_path('../fixtures/files/custom_workflow_2.1.3.xml', __dir__),
                                        'application/xml')
    assert_difference 'CustomWorkflow.count' do
      post '/custom_workflows/import', params: { file: file }
    end
    assert_redirected_to custom_workflows_path
    assert_equal I18n.t(:notice_successful_import), flash[:notice]
    workflow = CustomWorkflow.find_by(name: 'GEOxyz 5.x export')
    assert_equal 'issue', workflow.observable
    assert_equal 'self.custom_workflow_messages[:notice] = %q(from 5.x) if subject_changed?', workflow.before_save
    assert_equal 'Rails.logger.info(%q(after save 5.x))', workflow.after_save
    assert_equal 'jan.catrysse@geoxyz.eu', workflow.author
    assert workflow.is_for_all?
    assert_not workflow.active?
  end

  def test_export_and_import_again
    post '/login', params: { username: 'admin', password: 'admin' }
    get "/custom_workflows/#{@cw1.id}/export"
    assert_response :success
    assert_equal 'application/xml', response.media_type
    file = Rack::Test::UploadedFile.new(StringIO.new(response.body), 'application/xml', original_filename: 'cw.xml')
    assert_difference 'CustomWorkflow.count' do
      post '/custom_workflows/import', params: { file: file }
    end
    assert_redirected_to custom_workflows_path
    copy = CustomWorkflow.find_by(name: "#{@cw1.name}_1")
    assert_equal @cw1.before_save, copy.before_save
    assert_equal @cw1.before_destroy, copy.before_destroy
    assert_not copy.active?
  end
end
