require "test_helper"

class PagePdfJobTest < ActiveSupport::TestCase
  URL = "https://samskitchen.example.com/chickpea-curry".freeze

  class FakePdf
    attr_reader :recipes

    def initialize(error: nil)
      @error = error
      @recipes = []
    end

    def attach(recipe)
      raise @error if @error

      @recipes << recipe
    end
  end

  setup do
    @original_setting = ENV["SIZZLE_PAGE_PDFS"]
    ENV["SIZZLE_PAGE_PDFS"] = "true"
  end

  teardown do
    ENV["SIZZLE_PAGE_PDFS"] = @original_setting
  end

  test "prints recipes imported from a web page" do
    recipe = Recipe.create!(title: "Curry", source_url: URL)
    pdf = FakePdf.new

    PagePdfJob.new.perform(recipe, pdf:)

    assert_equal [ recipe ], pdf.recipes
  end

  test "is off unless SIZZLE_PAGE_PDFS is set" do
    ENV.delete("SIZZLE_PAGE_PDFS")
    recipe = Recipe.create!(title: "Curry", source_url: URL)
    pdf = FakePdf.new

    PagePdfJob.new.perform(recipe, pdf:)

    assert_empty pdf.recipes
  end

  test "skips written recipes, videos and recipes that already have a PDF" do
    written = Recipe.create!(title: "Curry")
    video = Recipe.create!(title: "Curry", source_url: "https://www.youtube.com/watch?v=#{YoutubeWatchPage::VIDEO_ID}")
    printed = Recipe.create!(title: "Curry", source_url: URL)
    printed.page_pdf.attach(io: StringIO.new("%PDF-1.7"), filename: "curry.pdf", content_type: "application/pdf")
    pdf = FakePdf.new

    [ written, video, printed ].each { |recipe| PagePdfJob.new.perform(recipe, pdf:) }

    assert_empty pdf.recipes
  end

  test "a page that can't be fetched or printed leaves the recipe as it is" do
    recipe = Recipe.create!(title: "Curry", source_url: URL)

    [ SafeHttp::HttpError.new(403), PagePdf::Error.new("no") ].each do |error|
      assert_nothing_raised { PagePdfJob.new.perform(recipe, pdf: FakePdf.new(error:)) }
    end
    assert_not recipe.page_pdf.attached?
  end
end
