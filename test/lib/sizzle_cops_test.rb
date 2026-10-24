require "test_helper"
require "rubocop"
require_relative "../../lib/rubocop/cop/sizzle/untrusted_fetch"
require_relative "../../lib/rubocop/cop/sizzle/shell_string"

# The custom cops that turn AGENTS.md's security rules into CI failures.
class SizzleCopsTest < ActiveSupport::TestCase
  def offenses(cop_class, source)
    cop = cop_class.new(RuboCop::Config.new({ cop_class.cop_name => { "Enabled" => true } }, "/"))
    processed = RuboCop::ProcessedSource.new(source, RUBY_VERSION.to_f, "app/services/example.rb")
    RuboCop::Cop::Commissioner.new([ cop ]).investigate(processed).offenses
  end

  def assert_offense(cop_class, source)
    assert_equal 1, offenses(cop_class, source).size, "expected an offense in: #{source}"
  end

  def assert_no_offense(cop_class, source)
    assert_empty offenses(cop_class, source), "expected no offense in: #{source}"
  end

  test "UntrustedFetch flags HTTP clients that bypass SafeHttp" do
    [
      "Net::HTTP.get(URI(url))",
      "::Net::HTTP.new(host)",
      "Faraday.get(url)",
      "HTTParty.get(url)",
      "OpenURI.open_uri(url)",
      'require "open-uri"',
      'require "faraday"'
    ].each { |source| assert_offense(RuboCop::Cop::Sizzle::UntrustedFetch, source) }
  end

  test "UntrustedFetch allows SafeHttp and unrelated constants" do
    [
      "SafeHttp.new.get(url)",
      "Net::HTTPSuccess",
      "Sizzle::Faraday",
      'require "net/http"',
      'require "nokogiri"'
    ].each { |source| assert_no_offense(RuboCop::Cop::Sizzle::UntrustedFetch, source) }
  end

  test "ShellString flags commands run through a shell" do
    [
      %q(system("yt-dlp #{url}")),
      "system(command)",
      %q(Kernel.system("ls")),
      %q(exec({ "LANG" => "C" }, "tool #{arg}")),
      %q(spawn("tool")),
      %q(Open3.capture3("tool #{url}")),
      %q(IO.popen("tool #{url}")),
      %q(`tool #{url}`),
      "%x(tool)"
    ].each { |source| assert_offense(RuboCop::Cop::Sizzle::ShellString, source) }
  end

  test "ShellString allows argument lists" do
    [
      'Open3.capture3("yt-dlp", "--", url)',
      'system("tool", "--", url)',
      'system({ "LANG" => "C" }, "tool", "--", url)',
      'IO.popen([ "tool", "--", url ])',
      "system(*argv)",
      "Process.clock_gettime(Process::CLOCK_MONOTONIC)"
    ].each { |source| assert_no_offense(RuboCop::Cop::Sizzle::ShellString, source) }
  end
end
