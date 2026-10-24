require "test_helper"

class ImportSourceLockTest < ActiveSupport::TestCase
  test "hostile URLs produce only hexadecimal filenames under the lock directory" do
    url = "https://example.com/../../../../etc/passwd?file=../../secret"
    directory = Rails.root.join("storage/import-locks")
    FileUtils.mkdir_p(directory)
    before = Dir.children(directory)

    ImportSourceLock.synchronize(url) do
      assert_raises(ImportSourceLock::Busy) { ImportSourceLock.synchronize(url) { flunk "claim was bypassed" } }
    end

    (Dir.children(directory) - before).each do |name|
      assert_match(/\A[0-9a-f]{64}\z/, name)
    end
    assert ImportSourceLock.synchronize(url) { true }, "claim is released after the block"
  end

  test "the OS releases a killed worker's source claim" do
    reader, writer = IO.pipe
    url = "https://example.com/interrupted"
    pid = fork do
      reader.close
      ImportSourceLock.synchronize(url) do
        writer.write("ready")
        writer.close
        sleep
      end
    end
    writer.close
    assert_equal "ready", reader.read
    assert_raises(ImportSourceLock::Busy) { ImportSourceLock.synchronize(url) { flunk "claim was bypassed" } }
    Process.kill("KILL", pid)
    Process.wait(pid)
    pid = nil

    assert ImportSourceLock.synchronize(url) { true }
  ensure
    reader&.close unless reader&.closed?
    writer&.close unless writer&.closed?
    if pid
      Process.kill("KILL", pid)
      Process.wait(pid)
    end
  end
end
