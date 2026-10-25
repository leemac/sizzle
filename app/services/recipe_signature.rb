# Ways to tell that two recipes are the same one, strongest first: the uid an
# export carries, the source page, and the title with its ingredients. Used to
# skip recipes you already have when importing a cookbook.
module RecipeSignature
  extend self

  # Query parameters that pick a page view, not a different recipe.
  VIEW_PARAMS = /\A(?:amp|print|wprm_print|ref|source|share)\z/i

  # A comparison key for a recipe's source page that ignores http/https, www.
  # and m. hosts, trailing slashes, AMP and print views, and parameter order,
  # on top of Recipe.normalize_url's tracking parameters and fragments.
  def url_key(url)
    uri = URI.parse(Import.source_key(url).to_s)
    return unless uri.is_a?(URI::HTTP) && uri.host.present?

    host = uri.host.downcase.sub(/\A(?:www|m|amp)\./, "")
    path = uri.path.to_s.sub(%r{/(?:amp|print)\z}, "").delete_suffix("/")
    params = URI.decode_www_form(uri.query.to_s).reject { |key, _| key.match?(VIEW_PARAMS) }.sort
    [ host, path, URI.encode_www_form(params).presence ].compact.join("|")
  rescue URI::Error, ArgumentError
    nil
  end

  # The same title and ingredients, ignoring case, accents, punctuation,
  # quantities and order. Nil without ingredients: a title alone is too weak.
  def fingerprint(title, ingredients)
    items = Array(ingredients).filter_map { |line| words(line["item"]) if line.is_a?(Hash) }.compact_blank.uniq.sort
    return if items.empty? || words(title).blank?

    Digest::SHA256.hexdigest([ words(title), *items ].join("\n"))
  end

  private

  def words(text)
    return unless text.is_a?(String)

    text.unicode_normalize(:nfkd).gsub(/\p{Mn}/, "").downcase.scan(/[\p{L}\p{N}]+/).join(" ")
  end
end
