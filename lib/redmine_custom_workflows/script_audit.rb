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

module RedmineCustomWorkflows
  # Finds code in the stored workflow scripts that no longer works on Ruby 3.3 / Rails 8.1 / this plugin version.
  # Read-only: the scripts are parsed, never run.
  module ScriptAudit
    SCRIPT_FIELDS = %i[shared_code before_save after_save before_destroy after_destroy before_add after_add
                       before_remove after_remove].freeze

    PATTERNS = {
      /\.to_s\(\s*:/ => 'to_s(:format) was removed in Rails 7.1, use to_fs(:format)',
      /\bupdate_attributes!?\b/ => 'update_attributes was removed in Rails 6.1, use update',
      /\b(File|Dir)\.exists\?/ => 'File.exists?/Dir.exists? were removed in Ruby 3.2, use exist?',
      /\berrors\[[^\]]+\]\s*<</ => 'errors[:x] << was removed in Rails 7.0, use errors.add',
      /\berrors\.add_to_base\b/ => 'errors.add_to_base was removed, use errors.add(:base, ...)',
      /\bURI\.(escape|encode|unescape|decode)\b/ => 'URI.escape/encode were removed in Ruby 3.0',
      /\.(taint|untaint|tainted\?|trust|untrust)\b/ => 'taint/trust were removed in Ruby 3.2',
      /\b(Fixnum|Bignum)\b/ => 'Fixnum/Bignum were removed in Ruby 3.2, use Integer',
      /\bActiveSupport::Deprecation\.warn\b/ => 'ActiveSupport::Deprecation.warn was removed in Rails 7.2',
      /\bfind_(all_)?by_\w+_and_\w+/ => 'dynamic finders with _and_ are gone, use find_by/where',
      /\bCustomWorkflow\.(run_custom_workflows|run_shared_code)\b(?!\?)/ =>
        'renamed in 3.x: run_custom_workflows? / run_shared_code?',
      /\battachments_callback\b(?!\?)/ => 'renamed in 3.x: attachments_callback?',
      /\bicon icon-/ => 'Redmine 6+ draws icons with SVG (sprite_icon); the icon-* CSS classes show nothing'
    }.freeze

    AFTER_ERROR = /WorkflowError|errors\.add/
    AFTER_ERROR_NOTE = 'raises or adds an error in an after_* script: the record is already saved, the user ' \
                       'does not see it; move the check to before_save/before_destroy'

    # Returns [[workflow, field, line number or nil, message], ...]
    def self.findings(workflows = CustomWorkflow.order(:position))
      workflows.flat_map do |workflow|
        SCRIPT_FIELDS.flat_map do |field|
          code = workflow[field]
          next [] if code.blank?

          check(code).map { |line, message| [workflow, field, line, message] } +
            after_error(field, code).map { |message| [workflow, field, nil, message] }
        end
      end
    end

    def self.check(code)
      found = []
      begin
        RubyVM::InstructionSequence.compile code
      rescue SyntaxError => e
        found << [nil, "syntax error on Ruby #{RUBY_VERSION}: #{e.message.lines.first.strip}"]
      end
      code.each_line.with_index(1) do |line, number|
        PATTERNS.each { |pattern, message| found << [number, message] if pattern.match?(line) }
      end
      found
    end

    def self.after_error(field, code)
      field.to_s.start_with?('after_') && AFTER_ERROR.match?(code) ? [AFTER_ERROR_NOTE] : []
    end
  end
end
