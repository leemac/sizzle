# Release history ships with the app: no GitHub requests or update polling.
module ReleaseNotes
  extend self

  def all
    @all ||= JSON.parse(Rails.root.join("config/releases.json").read).freeze
  end

  def available(version = Sizzle.version)
    return all if version == "dev"
    return [] unless Gem::Version.correct?(version)

    all.select { |release| Gem::Version.new(release.fetch("version")) <= Gem::Version.new(version) }
  end

  def latest_version
    available.first&.fetch("version")
  end
end
