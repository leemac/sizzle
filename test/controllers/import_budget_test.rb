require "test_helper"

class ImportBudgetTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @web_store = ImportsController.cache_store
    @api_store = Api::ImportsController.cache_store
    @token = ENV.delete("SIZZLE_API_TOKEN")
    ImportsController.cache_store = Api::ImportsController.cache_store = ActiveSupport::Cache::MemoryStore.new
  end

  teardown do
    ImportsController.cache_store = @web_store
    Api::ImportsController.cache_store = @api_store
    ENV["SIZZLE_API_TOKEN"] = @token if @token
  end

  test "web API and retries share a budget despite forged forwarding headers" do
    failed = Import.create!(kind: "text", text: "Pie", origin: "web", status: "failed")
    links = Array.new(20) { |i| "https://example.com/batch-#{i}" }.join("\n")
    post imports_url, params: { input: links }, headers: { "X-Forwarded-For" => "8.8.8.8" }
    assert_redirected_to imports_url

    9.times do |i|
      post api_imports_url, params: { text: "Pie #{i}" }, as: :json,
                            headers: { "X-Forwarded-For" => "9.9.9.#{i + 1}" }
      assert_response :accepted
    end
    assert_enqueued_jobs 1, only: ImportJob do
      post retry_import_url(failed), headers: { "X-Forwarded-For" => "1.1.1.1" }
    end
    failed.reload.fail!("Synthetic failure")

    assert_no_enqueued_jobs do
      assert_no_difference("Import.count") do
        post api_imports_url, params: { text: "One more" }, as: :json,
                              headers: { "X-Forwarded-For" => "4.4.4.4" }
        assert_response :too_many_requests
        post imports_url, params: { input: "https://example.com/extra" },
                          headers: { "X-Forwarded-For" => "5.5.5.5" }
        assert_redirected_to imports_url
        post retry_import_url(failed), headers: { "X-Forwarded-For" => "6.6.6.6" }
        assert_equal "failed", failed.reload.status
      end
    end

    travel 61.seconds do
      post api_imports_url, params: { text: "Next minute" }, as: :json
      assert_response :accepted
    end
  end

  test "invalid API input and retries of pending imports do not spend the budget" do
    post api_imports_url, params: { url: "file:///invalid" }, as: :json
    assert_response :unprocessable_content
    pending = Import.create!(kind: "text", text: "Pie", origin: "web")
    post retry_import_url(pending)
    assert_nil ImportsController.cache_store.read(ImportBudget::KEY)
  end
end
