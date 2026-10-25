# Fills in the Write a recipe form from screenshots, for pages Sizzle can't
# fetch. Answers JSON for the form to merge; the user saves the recipe as usual.
class RecipeScreenshotsController < ApplicationController
  # The screenshots plus room for the form encoding around them.
  MAX_BODY_BYTES = (RecipeScreenshot::MAX_FILES * RecipeScreenshot::MAX_BYTES) + 64.kilobytes

  # Before the CSRF check, which is the first thing to parse the body into tempfiles.
  prepend_before_action :reject_large_body
  rate_limit to: 10, within: 1.minute,
             with: -> { render json: { error: "Too many screenshots. Wait a minute and try again." }, status: :too_many_requests }

  def create
    response.headers["Cache-Control"] = "no-store"
    unless Sizzle.claude_configured?
      return render json: { error: "Reading screenshots needs optional AI. Set ANTHROPIC_API_KEY on your server, or type the recipe in." },
                    status: :unprocessable_content
    end

    screenshot = RecipeScreenshot.new(params[:screenshots])
    unless ImportBudget.charge(1, store: cache_store)
      return render json: { error: "Too many imports right now. Wait a minute and try again." }, status: :too_many_requests
    end

    render json: { fields: screenshot.fields }
  rescue RecipeScreenshot::Invalid, RecipeExtractor::Error => e
    render json: { error: e.message }, status: :unprocessable_content
  end

  private

  def reject_large_body
    return if request.content_length.to_i.between?(1, MAX_BODY_BYTES)

    render json: { error: "Screenshots must add up to #{MAX_BODY_BYTES / 1.megabyte} MB or less." }, status: :content_too_large
  end
end
