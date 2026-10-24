class Recipe < ApplicationRecord
  include Searchable
  include Filterable

  COURSES = %w[breakfast main side appetizer soup salad dessert baking snack drink sauce bread].freeze
  DIETS = %w[vegetarian vegan pescatarian gluten-free dairy-free nut-free low-carb].freeze

  has_one_attached :cover do |attachable|
    attachable.variant :card, resize_to_fill: [ 720, 900 ], format: :webp, saver: { quality: 80 }, preprocessed: true
    attachable.variant :hero, resize_to_limit: [ 1800, 1800 ], format: :webp, saver: { quality: 82 }
  end

  has_many_attached :photos do |attachable|
    attachable.variant :medium, resize_to_limit: [ 1200, 1200 ], format: :webp, saver: { quality: 80 }
  end

  has_many :imports, dependent: :nullify

  validates :title, presence: true, length: { maximum: 300 }
  validates :course, inclusion: { in: COURSES }, allow_nil: true
  validates :rating, inclusion: { in: 1..5 }, allow_nil: true
  validate :diets_are_known

  # Strips tracking parameters and fragments so the same page shared twice
  # (once from Instagram, once from Safari) is recognized as a duplicate.
  def self.normalize_url(url)
    uri = URI.parse(url.to_s.strip)
    return url unless uri.is_a?(URI::HTTP)

    if uri.query
      params = URI.decode_www_form(uri.query).reject { |key, _| key.match?(/\A(utm_|fbclid|gclid|mc_|igsh|si\z)/i) }
      uri.query = params.empty? ? nil : URI.encode_www_form(params)
    end
    uri.fragment = nil
    uri.host = uri.host&.downcase
    uri.to_s
  rescue URI::InvalidURIError
    url
  end

  def source_url=(url)
    super(url.presence && self.class.normalize_url(url))
    self.source_host = URI.parse(source_url).host&.delete_prefix("www.") if source_url
  rescue URI::InvalidURIError
    self.source_host = nil
  end

  private

  def diets_are_known
    unknown = Array(diets) - DIETS
    errors.add(:diets, "contains unknown values: #{unknown.join(', ')}") if unknown.any?
  end
end
