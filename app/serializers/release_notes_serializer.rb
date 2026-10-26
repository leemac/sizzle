module ReleaseNotesSerializer
  extend self

  def call
    ReleaseNotes.available.map do |release|
      release.merge("url" => "https://github.com/leemac/sizzle/releases/tag/v#{release.fetch('version')}")
    end
  end
end
