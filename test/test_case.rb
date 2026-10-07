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
  module Test
    # Test case base class
    class TestCase < ActionDispatch::IntegrationTest
      # Only the test methods written in the test classes. A test that includes the route helpers has them as public
      # methods, and Minitest runs whatever starts with test_: core's test_email_path/_url, and the test_* routes of
      # other plugins, which error when called without arguments and stop the run.
      def self.runnable_methods
        own = ancestors.take_while { |a| a != RedmineCustomWorkflows::Test::TestCase }
                       .select { |a| a.is_a?(Class) }
                       .flat_map { |a| a.public_instance_methods(false).map(&:to_s) }
        super & own
      end

      def initialize(name)
        super
        # Load all plugin's fixtures
        dir = File.join(File.dirname(__FILE__), 'fixtures')
        ext = '.yml'
        Dir.glob("#{dir}/**/*#{ext}").each do |file|
          fixture = File.basename(file, ext)
          ActiveRecord::FixtureSet.create_fixtures dir, fixture
        end
      end

      def setup
        @jsmith = User.find_by(login: 'jsmith')
        @admin = User.find_by(login: 'admin')
        @project1 = Project.find 1
        User.current = nil
      end
    end
  end
end
