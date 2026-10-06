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

# Issue controller patch test
class IssuesControllerPatchTest < RedmineCustomWorkflows::Test::TestCase
  def setup
    super
    @issue1 = Issue.find 1
    post '/login', params: { username: 'jsmith', password: 'jsmith' }
    @controller = IssuesController.new
  end

  def test_update_with_cw
    put "/issues/#{@issue1.id}", params: { issue: { subject: 'Updated subject' } }
    assert_redirected_to issue_path(@issue1)
    assert_equal 'Custom workflow', @controller.flash[:notice]
  end

  def test_delete_with_cw
    delete "/issues/#{@issue1.id}", params: { todo: 'destroy' }
    assert_response :redirect
    assert_equal 'Issue cannot be deleted', @controller.flash[:error]
    assert Issue.find_by(id: @issue1.id)
  end

  def test_update_with_failing_after_save_cw
    CustomWorkflow.find(1).update_column :after_save,
                                         "raise RedmineCustomWorkflows::Errors::WorkflowError, 'after_save failed'"
    put "/issues/#{@issue1.id}", params: { issue: { subject: 'Updated subject' } }
    assert_redirected_to issue_path(@issue1)
    assert_equal 'Updated subject', @issue1.reload.subject
  end

  def test_before_add_attachment_cw_refuses_the_update
    CustomWorkflow.create!(name: 'Refuse files', observable: 'issue_attachments', is_for_all: true, active: true,
                           before_add: "raise RedmineCustomWorkflows::Errors::WorkflowError, 'No files' " \
                                       "if @attachment.filename == 'refused.txt'")
    file = Rack::Test::UploadedFile.new(StringIO.new('text'), 'text/plain', original_filename: 'refused.txt')
    assert_no_difference -> { @issue1.attachments.count } do
      put "/issues/#{@issue1.id}", params: { issue: { subject: 'Updated subject' },
                                             attachments: { '1' => { 'file' => file } } }
    end
    assert_response :success
    assert_select '#errorExplanation', text: /No files/
    assert_not_equal 'Updated subject', @issue1.reload.subject
  end

  def test_cw_env
    put "/issues/#{@issue1.id}", params: { issue: { subject: 'Updated subject' } }
    assert_redirected_to issue_path(@issue1)
    assert_equal request.remote_ip, @controller.flash[:warning]
  end
end
