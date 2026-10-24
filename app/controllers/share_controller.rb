# Setup instructions for sharing into Sizzle from a phone.
class ShareController < InertiaController
  def show
    render inertia: "share/show", props: {
      endpoint: api_imports_url,
      token_required: Sizzle.api_token.present?
    }
  end
end
