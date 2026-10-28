require "test_helper"
require "yaml"
require "open3"

class RuntimeVersionsTest < ActiveSupport::TestCase
  test "development and container Ruby versions agree" do
    dockerfile = Rails.root.join("Dockerfile").read
    ruby_image = dockerfile.match(%r{^FROM docker\.io/library/ruby:(\d+\.\d+\.\d+)-slim-([a-z]+)@sha256:[a-f0-9]{64} AS base$})
    assert ruby_image, "Use a versioned Ruby image with an explicit Debian release and multi-platform digest"
    assert_equal Rails.root.join(".ruby-version").read.strip, ruby_image[1],
                 "Update .ruby-version and Gemfile.lock when accepting a Ruby image update"
  end

  test "Node build binaries come from the same Debian release as Ruby" do
    dockerfile = Rails.root.join("Dockerfile").read
    node_image = dockerfile.match(%r{^FROM docker\.io/library/node:(\d+)\.\d+\.\d+-([a-z]+)-slim@sha256:[a-f0-9]{64} AS node$})
    ruby_distro = dockerfile.match(%r{^FROM docker\.io/library/ruby:\d+\.\d+\.\d+-slim-([a-z]+)@})
    assert node_image, "Use a versioned Node image with an explicit Debian release and multi-platform digest"
    assert ruby_distro
    assert_equal ruby_distro[1], node_image[2], "Keep the copied Node binary compatible with the Ruby build stage"
    ci_node_versions = Rails.root.join(".github/workflows/ci.yml").read.scan(/node-version: (\d+)/).flatten.uniq
    assert_equal [ node_image[1] ], ci_node_versions, "Keep the Node major version consistent in CI and Docker"
  end

  test "the required container check fails closed for failed or cancelled platform jobs" do
    workflow = YAML.load_file(Rails.root.join(".github/workflows/ci.yml"))
    jobs = workflow.fetch("jobs")
    assert_equal %w[amd64 arm64], jobs.fetch("docker_platforms").fetch("strategy").fetch("matrix").fetch("include").map { |job| job.fetch("arch") }.sort
    gate = jobs.fetch("docker")
    assert_equal "Docker image boots", gate.fetch("name")
    assert_equal %w[changes docker_platforms], gate.fetch("needs")
    script = gate.fetch("steps").first.fetch("run")

    %w[success failure cancelled skipped].product(%w[true false]).each do |result, changed|
      expected = result == "success" || (changed == "false" && result == "skipped")
      env = { "CHANGE_RESULT" => "success", "CODE_CHANGED" => changed, "DOCKER_RESULT" => result }
      _, _, status = Open3.capture3(env, "bash", "-e", "-c", script)
      assert_equal expected, status.success?, "Unexpected gate result: #{result}, code changed: #{changed}"
    end

    env = { "CHANGE_RESULT" => "failure", "CODE_CHANGED" => "false", "DOCKER_RESULT" => "skipped" }
    _, _, status = Open3.capture3(env, "bash", "-e", "-c", script)
    assert_not status.success?, "A failed change detector must not satisfy the required check"
  end
end
