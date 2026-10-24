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

  scope :favorites, -> { where.not(favorited_at: nil) }

  validates :title, presence: true, length: { maximum: 300 }
  validates :course, inclusion: { in: COURSES }, allow_nil: true
  validates :rating, inclusion: { in: 1..5 }, allow_nil: true
  validate :diets_are_known
  validate :source_url_is_http, if: :source_url

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

  def favorite?
    favorited_at.present?
  end

  def favorite!
    update!(favorited_at: Time.current) unless favorite?
  end

  def unfavorite!
    update!(favorited_at: nil)
  end

  def source_url=(url)
    super(url.presence && self.class.normalize_url(url))
    self.source_host = URI.parse(source_url).host&.delete_prefix("www.") if source_url
  rescue URI::InvalidURIError
    self.source_host = nil
  end

  private

  # source_url is rendered as a link, so it must never be javascript: or data:.
  def source_url_is_http
    errors.add(:source_url, "must be an http(s) URL") unless URI.parse(source_url).is_a?(URI::HTTP)
  rescue URI::InvalidURIError
    errors.add(:source_url, "is not a valid URL")
  end

  def diets_are_known
    unknown = Array(diets) - DIETS
    errors.add(:diets, "contains unknown values: #{unknown.join(', ')}") if unknown.any?
  end
end
