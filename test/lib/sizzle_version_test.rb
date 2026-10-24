require "test_helper"

class SizzleVersionTest < ActiveSupport::TestCase
  test "reads the release version the image build wrote" do
    Tempfile.create("VERSION") do |file|
      file.write("0.0.1\n")
      file.flush

      assert_equal "0.0.1", Sizzle.version(file.path)
    end
  end

  test "a checkout without a VERSION file is dev" do
    assert_equal "dev", Sizzle.version(Rails.root.join("tmp", "missing-VERSION"))
  end

  test "an empty VERSION file is dev" do
    Tempfile.create("VERSION") do |file|
      assert_equal "dev", Sizzle.version(file.path)
    end
  end
end
