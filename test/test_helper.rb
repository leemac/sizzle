ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "webmock/minitest"
require "inertia_rails/minitest"
require_relative "support/fake_resolver"
require_relative "support/fake_extractor"
require_relative "support/youtube_watch_page"

# No test may touch the real network. Stub HTTP with WebMock and DNS with FakeResolver.
WebMock.disable_net_connect!

# Build once before Rails forks workers; concurrent auto-builds can expose a partial manifest.
abort "Vite test assets failed to build" unless ViteRuby.commands.build

module ActiveSupport
  class TestCase
    parallelize(workers: :number_of_processors)
    fixtures :all

    def file_fixture_html(name)
      file_fixture(name).read
    end

    # A real JPEG, big enough to pass RecipeImages' minimum size check.
    def sample_jpeg(width: 1200, height: 900)
      Vips::Image.black(width, height).add(120).cast(:uchar).jpegsave_buffer
    end

    # SafeHttp wired to a fake DNS resolver; every host resolves to a public IP unless overridden.
    def safe_http(hosts = {})
      SafeHttp.new(resolver: FakeResolver.new(hosts))
    end
  end
end
