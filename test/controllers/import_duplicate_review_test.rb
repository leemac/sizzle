require "test_helper"

class ImportDuplicateReviewTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  def review(input)
    assert_no_enqueued_jobs do
      assert_no_difference("Import.count") { post imports_url, params: { input: } }
    end
    assert_response :success
    inertia.props[:duplicate_review]
  end

  def confirm(input, plan, selected_urls = [])
    post imports_url, params: { input:, review_token: plan[:token], selected_urls: }
  end

  test "an existing tracked URL offers the saved recipe before doing any work" do
    saved = Recipe.create!(title: "My pie", source_url: "https://example.com/pie")
    input = "https://example.com/pie?utm_source=ig#recipe"

    plan = review(input)
    entry = plan[:entries].sole
    assert_equal saved.id, entry[:recipe_id]
    assert_equal saved.title, entry[:recipe_title]
    assert_not entry[:archived]

    assert_no_enqueued_jobs do
      assert_no_difference("Import.count") { confirm(input, plan) }
    end
    assert_redirected_to imports_url
    assert_equal "My pie", saved.reload.title
  end

  test "mixed batches group repeated sources and only enqueue selected new links" do
    saved = Recipe.create!(title: "Pie", source_url: "https://example.com/pie")
    input = "https://example.com/pie\nhttps://example.com/soup?utm_source=ig\nhttps://example.com/soup\nhttps://example.com/cake\nhttps://example.com/cake"
    plan = review(input)
    assert_equal [ 1, 2, 2 ], plan[:entries].map { |entry| entry[:occurrences] }
    assert_equal saved.id, plan[:entries].first[:recipe_id]

    assert_enqueued_jobs 1, only: ImportJob do
      assert_difference("Import.count", 1) { confirm(input, plan, [ "https://example.com/soup" ]) }
    end
    assert_equal "https://example.com/soup?utm_source=ig", Import.last.url
  end

  test "a repeated new link needs review and can be imported once or skipped" do
    input = "https://example.com/pie\nhttps://example.com/pie"
    plan = review(input)
    assert_equal 2, plan[:entries].sole[:occurrences]
    assert_nil plan[:entries].sole[:recipe_id]

    assert_no_difference("Import.count") { confirm(input, plan) }
    assert_enqueued_jobs 1, only: ImportJob do
      confirm(input, plan, [ "https://example.com/pie" ])
    end
  end

  test "archived matches stay archived unless explicitly selected for restore" do
    saved = Recipe.create!(title: "Archived pie", source_url: "https://example.com/pie", archived_at: Time.current)
    input = saved.source_url
    plan = review(input)
    assert plan[:entries].sole[:archived]
    assert saved.reload.archived?, "review must be read-only"

    confirm(input, plan)
    assert saved.reload.archived?
    assert_no_enqueued_jobs do
      assert_no_difference("Import.count") { confirm(input, plan, [ input ]) }
    end
    assert_not saved.reload.archived?
    assert_equal "Restored 1 archived recipe to your cookbook.", flash[:notice]
  end

  test "pending URL variants are skipped while failed imports can be tried again" do
    pending = Import.create!(kind: "url", url: "https://example.com/pie?utm_source=ig", origin: "share", status: "fetching")
    Import.create!(kind: "url", url: "https://example.com/soup", origin: "web", status: "failed")
    input = "https://example.com/pie#recipe\nhttps://example.com/soup"
    plan = review(input)
    assert_equal pending.id, plan[:entries].first[:pending_id]
    assert_nil plan[:entries].last[:pending_id]
    assert_enqueued_jobs 1, only: ImportJob do
      confirm(input, plan, [ "https://example.com/pie", "https://example.com/soup" ])
    end
    assert_equal "https://example.com/soup", Import.last.url
  end

  test "YouTube variants use the same identity as the worker" do
    key = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    saved = Recipe.create!(title: "Video recipe", source_url: key)
    input = "https://youtu.be/dQw4w9WgXcQ?si=share\nhttps://www.youtube.com/shorts/dQw4w9WgXcQ"
    plan = review(input)
    assert_equal key, plan[:entries].sole[:key]
    assert_equal saved.id, plan[:entries].sole[:recipe_id]
    assert_equal 2, plan[:entries].sole[:occurrences]
  end

  test "previously imported aliases identify the saved canonical recipe" do
    saved = Recipe.create!(title: "Pie", source_url: "https://example.com/canonical-pie")
    Import.create!(kind: "url", url: "https://example.com/redirect", origin: "web", status: "done", recipe: saved)
    plan = review("https://example.com/redirect")
    assert_equal saved.id, plan[:entries].sole[:recipe_id]
  end

  test "historical tracking aliases require review before restoring archived canonical recipes" do
    saved = Recipe.create!(title: "Archived pie", source_url: "https://example.com/canonical-pie", archived_at: Time.current)
    Import.create!(kind: "url", url: "https://example.com/redirect?utm_source=ig#recipe", origin: "web", status: "done", recipe: saved)

    [ "https://example.com/redirect", "https://example.com/redirect?utm_source=email",
      "https://example.com/redirect?fbclid=share#notes" ].each do |input|
      plan = review(input)
      assert_equal saved.id, plan[:entries].sole[:recipe_id]
      assert plan[:entries].sole[:archived]
      assert saved.reload.archived?

      assert_no_enqueued_jobs do
        assert_no_difference("Import.count") { confirm(input, plan) }
      end
      assert saved.reload.archived?, "skipping a historical alias must not restore its recipe"
    end

    input = "https://example.com/redirect?utm_medium=share"
    plan = review(input)
    assert_no_enqueued_jobs do
      assert_no_difference("Import.count") { confirm(input, plan, [ "https://example.com/redirect" ]) }
    end
    assert_not saved.reload.archived?
  end

  test "historical aliases retain query parameters that select a different recipe" do
    saved = Recipe.create!(title: "Pie", source_url: "https://example.com/canonical-pie")
    Import.create!(kind: "url", url: "https://example.com/redirect?recipe=pie&utm_source=ig", origin: "web", status: "done", recipe: saved)

    input = "https://example.com/redirect?recipe=pie\nhttps://example.com/redirect?recipe=cake&utm_source=email"
    plan = review(input)
    assert_equal saved.id, plan[:entries].first[:recipe_id]
    assert_nil plan[:entries].last[:recipe_id]
    assert_enqueued_jobs 1, only: ImportJob do
      assert_difference("Import.count", 1) { confirm(input, plan, [ plan[:entries].last[:key] ]) }
    end
    assert_equal "https://example.com/redirect?recipe=cake&utm_source=email", Import.last.url
  end

  test "confirmation is bound to the paste and current matches" do
    saved = Recipe.create!(title: "Pie", source_url: "https://example.com/pie")
    input = saved.source_url
    plan = review(input)
    saved.archive!

    assert_no_difference("Import.count") { confirm(input, plan, [ input ]) }
    assert_response :success
    assert saved.reload.archived?
    assert inertia.props[:duplicate_review][:entries].sole[:archived]

    assert_no_difference("Import.count") { confirm("https://example.com/other", plan, [ "https://example.com/other" ]) }
    assert_response :success
    assert_equal "https://example.com/other", inertia.props[:duplicate_review][:entries].sole[:key]
  end

  test "finishing a pending import refreshes the choices without importing or restoring it" do
    pending = Import.create!(kind: "url", url: "https://example.com/pie", origin: "share")
    input = pending.url
    plan = review(input)
    saved = Recipe.create!(title: "Finished pie", source_url: input, archived_at: Time.current)
    pending.succeed!(saved)

    assert_no_enqueued_jobs do
      assert_no_difference("Import.count") { confirm(input, plan, [ input ]) }
    end
    assert_response :success
    assert_equal saved.id, inertia.props[:duplicate_review][:entries].sole[:recipe_id]
    assert saved.reload.archived?
  end

  test "a referenced pending import is visible even outside the recent thirty and GET is read-only" do
    pending = Import.create!(kind: "url", url: "https://example.com/old-pending", origin: "share")
    31.times { |index| Import.create!(kind: "url", url: "https://example.com/newer-#{index}", origin: "share") }
    assert_no_enqueued_jobs do
      assert_no_changes -> { pending.reload.attributes } do
        get imports_url(current: pending.id)
      end
    end
    assert_equal pending.id, inertia.props[:imports].first[:id]
  end

  test "confirmation cannot restore or import sources outside the reviewed paste" do
    saved = Recipe.create!(title: "Other pie", source_url: "https://example.com/other", archived_at: Time.current)
    input = "https://example.com/soup\nhttps://example.com/soup"
    plan = review(input)
    assert_no_difference("Import.count") { confirm(input, plan, [ saved.source_url, "https://example.com/not-in-paste" ]) }
    assert saved.reload.archived?
  end

  test "validation cannot be bypassed with duplicate URLs or confirmation parameters" do
    Recipe.create!(title: "Pie", source_url: "https://example.com/pie")
    input = "https://example.com/pie\nhttps://user:password@example.com/pie"
    assert_no_difference("Import.count") do
      post imports_url, params: { input:, review_token: "forged", selected_urls: [ "https://example.com/pie" ] }
    end
    assert_redirected_to imports_url
    follow_redirect!
    assert inertia.props[:errors][:input].present?
  end

  test "only new selected imports consume the fetch budget" do
    previous = ImportsController.cache_store
    ImportsController.cache_store = ActiveSupport::Cache::MemoryStore.new
    saved = Recipe.create!(title: "Pie", source_url: "https://example.com/pie")
    input = "#{saved.source_url}\nhttps://example.com/soup\nhttps://example.com/soup"
    plan = review(input)
    assert_nil ImportsController.cache_store.read(ImportBudget::KEY)
    confirm(input, plan, [ "https://example.com/soup" ])
    assert_equal 1, ImportsController.cache_store.read(ImportBudget::KEY)
  ensure
    ImportsController.cache_store = previous
  end
end
