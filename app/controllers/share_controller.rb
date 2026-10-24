# Setup instructions for sharing into Sizzle from a phone.
class ShareController < InertiaController
  def show
    inertia_meta.add(title: "Share from your phone")
    render inertia: "share/show", props: {
      endpoint: api_imports_url,
      token_required: Sizzle.api_token.present?
    }
  end
end
