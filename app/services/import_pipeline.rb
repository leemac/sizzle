# Runs one Import end to end: fetch → read recipe data (or optional AI) → save the recipe and
# its images. Each stage updates the import's status so the UI can show progress.
class ImportPipeline
  class NotARecipe < StandardError; end
  class NeedsManualEntry < StandardError; end

  def initialize(import, http: SafeHttp.new, extractor: nil, images: RecipeImages.new(http:))
    @import = import
    @http = http
    @extractor = extractor
    @images = images
  end

  def run
    recipe = @import.kind == "url" ? import_url : import_text
    @import.succeed!(recipe)
    recipe
  rescue SafeHttp::BlockedUrl => e
    @import.fail!("That link can't be fetched: #{e.message}.")
  rescue SafeHttp::Error => e
    @import.fail!("Couldn't load that page (#{e.message}).")
  rescue NotARecipe
    @import.fail!("That doesn't look like a recipe.")
  rescue RecipeExtractor::Retryable
    raise # let ImportJob retry with backoff
  rescue NeedsManualEntry, RecipeExtractor::Error => e
    @import.fail!(e.message)
  end

  private

  def import_url
    if (existing = Recipe.find_by(source_url: Recipe.normalize_url(@import.url)))
      return existing
    end

    @import.advance!("fetching")
    page = PageScraper.fetch(@import.url, http: @http)
    ImportSourceLock.synchronize(page.canonical_url) do
      if (existing = Recipe.find_by(source_url: Recipe.normalize_url(page.canonical_url)))
        return existing
      end

      @import.advance!("extracting")
      data = StructuredRecipeExtractor.new.from_page(page)
      unless data
        raise NeedsManualEntry, "This page has no usable recipe data. Write the recipe manually, or enable optional AI in Setup." unless ai_extractor

        data = ai_extractor.from_page(page)
      end
      draft = RecipeDraft.new(data, images: page.images)
      raise NotARecipe unless draft.recipe?

      @import.advance!("saving")
      save_recipe(draft, source_url: page.canonical_url, source_name: page.site_name)
    end
  end

  def import_text
    @import.advance!("extracting")
    raise NeedsManualEntry, "Pasted text needs optional AI extraction. Write the recipe manually instead, or enable AI in Setup." unless ai_extractor

    draft = RecipeDraft.new(ai_extractor.from_text(@import.text))
    raise NotARecipe unless draft.recipe?

    @import.advance!("saving")
    save_recipe(draft)
  end

  def ai_extractor
    return @extractor if @extractor

    @extractor = RecipeExtractor.new if Sizzle.claude_configured?
  end

  def save_recipe(draft, source_url: nil, source_name: nil)
    recipe = Recipe.create!(**draft.attributes, source_url:, source_name:)
    @images.attach(recipe, cover_urls: draft.cover_urls, photo_urls: draft.photo_urls)
    recipe
  end
end
