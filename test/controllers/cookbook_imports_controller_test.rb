require "test_helper"

class CookbookImportsControllerTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @original_setting = ENV["SIZZLE_COOKBOOK_IMPORT"]
    ENV["SIZZLE_COOKBOOK_IMPORT"] = "true"
  end

  teardown do
    ENV["SIZZLE_COOKBOOK_IMPORT"] = @original_setting
  end

  def upload(bytes, filename: "sizzle-cookbook.tar.gz")
    file = Tempfile.new([ "upload", ".tar.gz" ], binmode: true)
    file.write(bytes)
    file.rewind
    Rack::Test::UploadedFile.new(file.path, "application/gzip", true, original_filename: filename)
  end

  def gzip(text = "{}")
    ActiveSupport::Gzip.compress(text)
  end

  test "import is off unless SIZZLE_COOKBOOK_IMPORT is set" do
    ENV.delete("SIZZLE_COOKBOOK_IMPORT")

    assert_no_difference("CookbookImport.count") { post cookbook_import_url, params: { archive: upload(gzip) } }
    assert_response :not_found
    get settings_url
    assert_not inertia.props[:instance][:cookbook_import][:enabled]
  end

  test "an upload is stored under a fixed name and imported in the background" do
    assert_enqueued_with(job: CookbookImportJob) do
      post cookbook_import_url, params: { archive: upload(gzip, filename: "../../.env") }
    end

    assert_redirected_to settings_url
    cookbook_import = CookbookImport.sole
    assert_equal "queued", cookbook_import.status
    assert_equal "cookbook.tar.gz", cookbook_import.archive.filename.to_s
    follow_redirect!
    assert_equal "queued", inertia.props[:instance][:cookbook_import][:latest][:status]
    assert inertia.props[:instance][:cookbook_import][:latest][:in_progress]
  end

  test "uploads that aren't gzip, are empty or are missing are refused" do
    [ upload("PK\x03\x04 zip file"), upload(""), "just a string", nil ].each do |archive|
      assert_no_difference("CookbookImport.count") { post cookbook_import_url, params: { archive: } }
      follow_redirect!
      assert_match "Choose a Sizzle cookbook export", inertia.props[:errors][:archive]
    end
  end

  test "uploads over the size limit are refused" do
    stub_const(CookbookArchive, :MAX_UPLOAD_BYTES, 10) do
      assert_no_difference("CookbookImport.count") { post cookbook_import_url, params: { archive: upload(gzip("x" * 100)) } }
    end
  end

  test "only one import runs at a time, unless the last one stalled" do
    running = CookbookImport.create!(status: "running")

    assert_no_difference("CookbookImport.count") { post cookbook_import_url, params: { archive: upload(gzip) } }
    follow_redirect!
    assert_match "already importing", inertia.props[:errors][:archive]

    running.update_column(:updated_at, 2.hours.ago)
    get settings_url
    latest = inertia.props[:instance][:cookbook_import][:latest]
    assert_equal [ false, true ], [ latest[:in_progress], latest[:stalled] ], "a stalled import doesn't lock the form"
    assert_difference("CookbookImport.count") { post cookbook_import_url, params: { archive: upload(gzip) } }
  end

  test "importing needs a POST with the browser's CSRF token" do
    ActionController::Base.allow_forgery_protection = true

    assert_no_difference("CookbookImport.count") { post cookbook_import_url, params: { archive: upload(gzip) } }
    assert_response :unprocessable_content
    get cookbook_import_url
    assert_response :not_found
  ensure
    ActionController::Base.allow_forgery_protection = false
  end

  test "the job runs a queued import once" do
    cookbook_import = CookbookImport.create!(status: "done")
    CookbookImportJob.perform_now(cookbook_import)
    assert_equal "done", cookbook_import.reload.status
  end

  include ActiveSupport::Testing::ConstantStubbing
end
