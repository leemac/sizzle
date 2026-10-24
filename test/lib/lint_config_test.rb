require "test_helper"
require "rubocop"

# The lint rules that enforce AGENTS.md's security rules are config, so a
# one-line edit could switch one off. These tests make that edit fail CI.
class LintConfigTest < ActiveSupport::TestCase
  test "RuboCop enforces the security rules" do
    config = RuboCop::ConfigLoader.configuration_from_file(Rails.root.join(".rubocop.yml").to_s)

    %w[Sizzle/UntrustedFetch Sizzle/ShellString Rails/OutputSafety Security/Open Security/Eval Security/MarshalLoad
       Security/YAMLLoad Security/IoMethods].each do |cop|
      assert config.cop_enabled?(cop), "#{cop} must stay enabled"
    end
  end

  test "only SafeHttp may use an HTTP client directly" do
    config = RuboCop::ConfigLoader.configuration_from_file(Rails.root.join(".rubocop.yml").to_s)
    excluded = config.for_cop("Sizzle/UntrustedFetch")["Exclude"].map { |path| Pathname(path).relative_path_from(Rails.root).to_s }

    assert_equal %w[app/services/safe_http.rb lib/rubocop/**/*], excluded
    assert_nil config.for_cop("Sizzle/ShellString")["Exclude"].presence
  end

  test "oxlint forbids rendering raw HTML and script URLs" do
    rules = JSON.parse(Rails.root.join(".oxlintrc.json").read.gsub(%r{^\s*//.*$}, ""))["rules"]

    %w[react/no-danger react/jsx-no-script-url react/rules-of-hooks].each do |rule|
      assert_equal "error", rules[rule], "#{rule} must stay an error"
    end
  end
end
