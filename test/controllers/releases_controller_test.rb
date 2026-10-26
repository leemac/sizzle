require "test_helper"

class ReleasesControllerTest < ActionDispatch::IntegrationTest
  test "the journal provides bundled notes and a page title without outbound requests" do
    assert_no_difference [ "Recipe.count", "Import.count" ] do
      get releases_url
    end
    assert_response :success
    assert_equal "releases/index", inertia.component
    assert_select "head title", text: "What's new · Sizzle"
    assert_equal ReleaseNotes.latest_version, inertia.props[:latest_release]
    assert_equal ReleaseNotes.all.size, inertia.props[:releases].size
    assert_equal "https://github.com/leemac/sizzle/releases/tag/v#{ReleaseNotes.latest_version}", inertia.props[:releases].first["url"]
  end

  test "shared props carry only the latest version and not the complete release history" do
    get root_url
    assert_equal ReleaseNotes.latest_version, inertia.props[:latest_release]
    assert_not inertia.props.key?(:releases)
  end
end
