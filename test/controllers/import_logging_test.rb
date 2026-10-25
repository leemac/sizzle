require "test_helper"

class ImportLoggingTest < ActionDispatch::IntegrationTest
  test "import request logs redact pasted content and embedded URL credentials" do
    output = StringIO.new
    previous = ActionController::Base.logger
    ActionController::Base.logger = ActiveSupport::Logger.new(output)
    token = ENV.delete("SIZZLE_API_TOKEN")
    marker = "synthetic-private-content"

    post api_imports_url, params: { url: "https://example.com:6379/recipe?token=#{marker}", text: marker }, as: :json
    assert_response :unprocessable_content
    post imports_url, params: { input: "https://example.com:6379/recipe?token=#{marker}" }
    assert_redirected_to imports_url

    assert_includes output.string, "Parameters:"
    assert_includes output.string, "[FILTERED]"
    assert_not_includes output.string, marker
  ensure
    ActionController::Base.logger = previous
    ENV["SIZZLE_API_TOKEN"] = token if token
  end

  test "nested recipe data and query paths use the same redaction policy" do
    marker = "synthetic-private-content"
    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)
    filtered = filter.filter({ "manual_recipe" => { "description" => marker }, "recipe" => { "notes" => marker },
                               "selected_urls" => [ "https://example.com/?token=#{marker}" ], "mode" => "manual" })
    assert_not_includes filtered.inspect, marker
    assert_equal "manual", filtered["mode"]

    request = ActionDispatch::Request.new(Rack::MockRequest.env_for("/imports?input=#{marker}&url=#{marker}"))
    request.set_header("action_dispatch.parameter_filter", Rails.application.config.filter_parameters)
    assert_not_includes request.filtered_path, marker
  end
end
