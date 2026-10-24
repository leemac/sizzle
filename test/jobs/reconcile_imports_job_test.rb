require "test_helper"

class ReconcileImportsJobTest < ActiveJob::TestCase
  test "is scheduled in production, off the request path" do
    tasks = ActiveSupport::ConfigurationFile.parse(Rails.root.join("config/recurring.yml"))["production"]

    assert_equal "ReconcileImportsJob", tasks.dig("reconcile_imports", "class")
    assert_equal "every minute", tasks.dig("reconcile_imports", "schedule")
  end
end
