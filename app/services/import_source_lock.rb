require "digest"
require "fileutils"

# All workers use the same local storage volume as SQLite. Advisory file locks
# provide an atomic source claim without holding a DB transaction during Claude
# or image downloads, and the OS releases the claim if a worker is killed.
class ImportSourceLock
  class Busy < StandardError; end

  def self.synchronize(url)
    directory = Rails.root.join("storage", "import-locks")
    FileUtils.mkdir_p(directory)
    # Namespace by database: Rails parallel tests have separate databases, and
    # separate cookbooks on the same storage path must not share a claim.
    source = [ Recipe.connection_db_config.database, Recipe.normalize_url(url) ].join("\0")
    path = directory.join(Digest::SHA256.hexdigest(source))

    File.open(path, File::RDWR | File::CREAT, 0o600) do |file|
      raise Busy unless file.flock(File::LOCK_EX | File::LOCK_NB)

      yield
    end
  end
end
