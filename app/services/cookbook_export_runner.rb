require "rbconfig"
require "tempfile"

# A separate process contains compression, SQLite waits and attachment reads.
# A nonblocking file lock works across Puma workers and stays held until the
# download closes, so different IPs cannot fill every request thread with exports.
class CookbookExportRunner
  BUILD_SECONDS = 20
  CPU_SECONDS = 15
  MEMORY_BYTES = 1.gigabyte

  def initialize(command: nil, build_seconds: BUILD_SECONDS, directory: Rails.root.join("tmp", "cookbook-exports"))
    @command = command
    @build_seconds = build_seconds
    @directory = directory
  end

  def build
    handed_off = false
    FileUtils.mkdir_p(@directory, mode: 0o700)
    lock = File.open("#{@directory}.lock", File::RDWR | File::CREAT, 0o600)
    raise CookbookExport::Busy, "Another cookbook export is in progress. Try again after it finishes." unless lock.flock(File::LOCK_EX | File::LOCK_NB)

    # No live export can own these files while we hold the lock. Clean up after
    # a previous app crash, too; never accumulate abandoned archives.
    Dir.each_child(@directory) do |name|
      File.unlink(File.join(@directory, name)) if name.start_with?("archive-")
    end
    file = Tempfile.new([ "archive-", ".tar.gz" ], @directory, binmode: true)
    deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + @build_seconds
    command = @command || [ RbConfig.ruby, Rails.root.join("bin", "rails").to_s, "runner", Rails.root.join("script", "export_cookbook.rb").to_s ]
    options = { out: File::NULL, err: File::NULL, pgroup: true, rlimit_core: 0,
                rlimit_cpu: CPU_SECONDS, rlimit_fsize: CookbookExport::MAX_BYTES }
    # Address-space limits are usable on Linux; macOS reserves large virtual
    # address ranges even for small processes. All content limits apply on both.
    options[:rlimit_as] = MEMORY_BYTES if RUBY_PLATFORM.include?("linux")
    pid = Process.spawn(*command, file.path, **options)
    loop do
      if (result = Process.waitpid2(pid, Process::WNOHANG))
        pid = nil
        status = result.last
        raise CookbookExport::TooLarge, CookbookExport::LIMIT_MESSAGE if status.exitstatus == 2 || status.termsig == Signal.list["XFSZ"]
        if status.termsig == Signal.list["XCPU"]
          raise CookbookExport::Expired, "The export exceeded its processing limit and was stopped. Use a server backup for larger cookbooks."
        end
        raise CookbookExport::Error, "The cookbook couldn't be exported. Check available disk space and saved photos, then try again." unless status.success?
        raise CookbookExport::TooLarge, CookbookExport::LIMIT_MESSAGE if file.size > CookbookExport::MAX_BYTES

        download = CookbookExport::Download.new(file, lock:)
        handed_off = true
        return download
      end
      raise CookbookExport::Expired, "The export took longer than #{BUILD_SECONDS} seconds and was stopped. Use a server backup for larger cookbooks." if Process.clock_gettime(Process::CLOCK_MONOTONIC) >= deadline

      sleep 0.025
    end
  ensure
    # Never wait indefinitely for a child, even on the failure/cancellation path.
    if pid
      begin
        Process.kill("KILL", -pid)
      rescue Errno::ESRCH
        # It exited between the deadline check and cancellation.
      end
      Process.detach(pid)
    end
    unless handed_off
      file&.close!
      lock&.close unless lock&.closed?
    end
  end
end
