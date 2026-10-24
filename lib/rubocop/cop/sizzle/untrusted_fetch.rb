module RuboCop
  module Cop
    module Sizzle
      # Untrusted URLs must go through SafeHttp, which blocks private addresses,
      # pins the vetted IP and re-checks redirects. Any other HTTP client skips
      # those checks. See AGENTS.md, security rule 1.
      #
      #   # bad
      #   Net::HTTP.get(URI(url))
      #   Faraday.get(url)
      #   require "open-uri"
      #
      #   # good
      #   SafeHttp.new.get(url)
      class UntrustedFetch < Base
        MSG = "Fetch URLs with SafeHttp, not `%<client>s` (AGENTS.md security rule 1)."
        CLIENTS = %i[Faraday HTTParty RestClient Excon Typhoeus HTTPX OpenURI].freeze
        LIBRARIES = %w[open-uri faraday httparty rest-client excon typhoeus httpx].freeze

        def_node_matcher :net_http?, "(const (const {nil? cbase} :Net) :HTTP)"
        def_node_matcher :required_library, "(send nil? {:require :require_relative} (str $_))"

        def on_const(node)
          if net_http?(node)
            add_offense(node, message: format(MSG, client: "Net::HTTP"))
          elsif node.namespace.nil? && CLIENTS.include?(node.short_name)
            add_offense(node, message: format(MSG, client: node.short_name))
          end
        end

        def on_send(node)
          library = required_library(node)
          add_offense(node, message: format(MSG, client: library)) if LIBRARIES.include?(library)
        end
      end
    end
  end
end
