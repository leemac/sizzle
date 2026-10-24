require "test_helper"

class StorageRoutesTest < ActionDispatch::IntegrationTest
  test "browser uploads have no routes" do
    assert_no_difference "ActiveStorage::Blob.count" do
      post "/rails/active_storage/direct_uploads", params: { blob: { filename: "arbitrary.bin", byte_size: 4 } }, as: :json
      assert_response :not_found
      put "/rails/active_storage/disk/arbitrary-token", params: "data"
      assert_response :not_found
    end
  end

  test "originals and variants still stream through signed proxy routes" do
    recipe = Recipe.create!(title: "Pie")
    recipe.cover.attach(io: StringIO.new(sample_jpeg), filename: "cover.jpg", content_type: "image/jpeg")

    get rails_storage_proxy_path(recipe.cover.blob)
    assert_response :success
    assert_equal "image/jpeg", response.media_type

    get rails_storage_proxy_path(recipe.cover.variant(:card))
    assert_response :success
    assert_equal "image/webp", response.media_type
  end

  test "unsigned downloads are rejected" do
    get "/rails/active_storage/blobs/proxy/forged/cover.jpg"
    assert_response :not_found
  end
end
