require "test_helper"
require "active_support/testing/constant_stubbing"

class CookbookExportRunnerTest < ActiveSupport::TestCase
  include ActiveSupport::Testing::ConstantStubbing

  setup do
    @root = Dir.mktmpdir
    @directory = File.join(@root, "exports")
  end

  teardown { FileUtils.remove_entry(@root) }

  def runner(code, seconds: 2)
    CookbookExportRunner.new(command: [ RbConfig.ruby, "-e", code, "--" ], build_seconds: seconds, directory: @directory)
  end

  test "a completed child hands off a bounded file and holds the global lock until close" do
    download = runner('File.binwrite(ARGV.fetch(0), "archive")').build
    assert_equal 7, download.size
    assert_raises(CookbookExport::Busy) { runner('abort "must not run"').build }
    data = +""
    download.each { |chunk| data << chunk }
    assert_equal "archive", data
    assert_empty Dir.children(@directory)
    another = runner('File.binwrite(ARGV.fetch(0), "next")').build
    another.close
  end

  test "the deadline kills a hung child, removes partial files and permits another export" do
    pid_path = File.join(@root, "pid")
    # A real subprocess sleep exercises the supervisor, rather than stubbing time.
    code = "File.write(#{pid_path.dump}, Process.pid); File.write(ARGV.fetch(0), 'partial'); sleep 30"
    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    assert_raises(CookbookExport::Expired) { runner(code, seconds: 1.5).build }
    assert_operator Process.clock_gettime(Process::CLOCK_MONOTONIC) - started, :<, 4
    pid = Integer(File.read(pid_path))
    deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 1
    loop do
      break unless process_alive?(pid)
      flunk "Timed-out export child is still alive" if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline
      sleep 0.01
    end
    assert_empty Dir.children(@directory)
    runner('File.binwrite(ARGV.fetch(0), "ok")').build.close
  end

  test "child failures never deliver partial output and release the lock" do
    assert_raises(CookbookExport::Error) { runner('File.write(ARGV.fetch(0), "partial"); exit 1').build }
    assert_empty Dir.children(@directory)
    runner('File.write(ARGV.fetch(0), "ok")').build.close
  end

  test "the OS file-size limit stops an oversized writer" do
    marker = File.join(@root, "writer-finished")
    stub_const(CookbookExport, :MAX_BYTES, 1024) do
      assert_raises(CookbookExport::Error) do
        code = "File.open(ARGV.fetch(0), 'wb') { |file| 10.times { file.write('x' * 1024) } }; File.write(#{marker.dump}, 'finished')"
        runner(code).build
      end
      assert_not File.exist?(marker), "the OS must stop the writer, not just reject its completed oversized file"
      assert_empty Dir.children(@directory)
    end
  end

  test "abandoned archives are removed before the next export" do
    FileUtils.mkdir_p(@directory)
    File.write(File.join(@directory, "archive-abandoned.tar.gz"), "partial")
    File.write(File.join(@directory, "unrelated"), "keep")
    runner('File.write(ARGV.fetch(0), "ok")').build.close
    assert_equal [ "unrelated" ], Dir.children(@directory)
  end

  test "the OS CPU limit stops an infinitely busy child before its wall deadline" do
    stub_const(CookbookExportRunner, :CPU_SECONDS, 1) do
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      assert_raises(CookbookExport::Error) { runner("loop {}", seconds: 4).build }
      assert_operator Process.clock_gettime(Process::CLOCK_MONOTONIC) - started, :<, 3
      assert_empty Dir.children(@directory)
    end
  end

  private

  def process_alive?(pid)
    Process.kill(0, pid)
    true
  rescue Errno::ESRCH
    false
  end
end
