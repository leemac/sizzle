# Apply before Bundler can load ruby-vips in native and container runtimes.
ENV["VIPS_BLOCK_UNTRUSTED"] = "1"

ENV["BUNDLE_GEMFILE"] ||= File.expand_path("../Gemfile", __dir__)

require "bundler/setup" # Set up gems listed in the Gemfile.
require "bootsnap/setup" # Speed up boot time by caching expensive operations.
