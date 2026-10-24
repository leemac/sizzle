require "test_helper"

class RecipeExtractorSchemaTest < ActiveSupport::TestCase
  setup do
    @data = FakeExtractor.recipe("diets" => [ "vegan" ])
    @requests = []
    stub_request(:post, "https://api.anthropic.com/v1/messages").to_return do |request|
      @requests << JSON.parse(request.body)
      {
        headers: { "Content-Type" => "application/json" },
        body: {
          id: "msg_recipe", type: "message", role: "assistant", model: "claude-opus-5-5",
          content: [ { type: "text", text: @data.to_json } ],
          stop_reason: "end_turn", stop_sequence: nil,
          usage: { input_tokens: 100, output_tokens: 100 }
        }.to_json
      }
    end
    client = Anthropic::Client.new(api_key: "test-key", max_retries: 0)
    @extractor = RecipeExtractor.new(client:)
  end

  test "the real SDK sends a strict schema within Claude's documented complexity limits" do
    @extractor.from_text("Chickpea curry: simmer chickpeas.")

    request = @requests.sole
    assert_equal "json_schema", request.dig("output_config", "format", "type")
    assert_not request.key?("tools")
    schema = request.dig("output_config", "format", "schema")
    # API limits: 16 parameters with unions, 24 optional parameters.
    # This covers the serialized schema, including nested ingredient/step objects.
    assert_operator union_count(schema), :<=, 16
    assert_operator optional_count(schema), :<=, 24
    assert_strict_objects(schema)
  end

  test "omitted section headings become null in the validated recipe" do
    @data["ingredients"].each { |entry| entry.delete("section") }
    @data["steps"].each { |entry| entry.delete("section") }

    result = RecipeDraft.new(@extractor.from_text("Chickpea curry: simmer chickpeas.")).attributes

    %w[ingredients steps].each do |key|
      assert result[key.to_sym].sole.key?("section")
      assert_nil result[key.to_sym].sole["section"]
    end
    assert_equal @data["title"], result[:title]
  end

  test "malformed model entries reach draft validation without crashing extraction" do
    @data["ingredients"] = [ "not an ingredient", nil ]
    @data["steps"] = [ 123, false ]

    result = RecipeDraft.new(@extractor.from_text("Chickpea curry: simmer chickpeas.")).attributes

    assert_empty result[:ingredients]
    assert_empty result[:steps]
  end

  test "section headings from the source are preserved" do
    @data["ingredients"].sole["section"] = "For the sauce"
    @data["steps"].sole["section"] = "Make the sauce"

    result = @extractor.from_text("For the sauce: simmer chickpeas.")

    assert_equal "For the sauce", result["ingredients"].sole["section"]
    assert_equal "Make the sauce", result["steps"].sole["section"]
  end

  private

  def union_count(node)
    case node
    when Hash
      union = node.key?("anyOf") || node["type"].is_a?(Array)
      (union ? 1 : 0) + node.values.sum { |value| union_count(value) }
    when Array then node.sum { |value| union_count(value) }
    else 0
    end
  end

  def optional_count(node)
    case node
    when Hash
      properties = node.fetch("properties", {}).keys
      (properties - node.fetch("required", [])).size + node.values.sum { |value| optional_count(value) }
    when Array then node.sum { |value| optional_count(value) }
    else 0
    end
  end

  def assert_strict_objects(node)
    case node
    when Hash
      assert_equal false, node["additionalProperties"] if node["type"] == "object"
      node.each_value { |value| assert_strict_objects(value) }
    when Array then node.each { |value| assert_strict_objects(value) }
    end
  end
end
