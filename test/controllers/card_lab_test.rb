require "test_helper"

class CardLabTest < ActionDispatch::IntegrationTest
  test "the card design lab is not routed outside development" do
    assert_raises(ActionController::RoutingError) { Rails.application.routes.recognize_path("/lab/cards") }

    get "/lab/cards"
    assert_response :not_found
  end
end
