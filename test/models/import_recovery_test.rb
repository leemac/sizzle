require "test_helper"

class ImportRecoveryTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  setup do
    SolidQueue::Record.connection.create_table(:solid_queue_jobs) do |t|
      t.string :active_job_id
      t.string :class_name
      t.text :arguments
    end
    SolidQueue::Record.connection.create_table(:solid_queue_failed_executions) { |t| t.integer :job_id }
    @adapter = ImportJob.queue_adapter
  end

  teardown do
    ImportJob.queue_adapter = @adapter
  end

  test "reconciles abandoned executions into retryable failures" do
    %w[queued fetching extracting saving].each do |status|
      import = Import.create!(kind: "text", text: "Pie", origin: "web")
      import.update!(status:)
      failed_execution(import.active_job_id)
    end
    ImportJob.queue_adapter = :solid_queue

    Import.reconcile_failed_jobs!

    assert_equal [ "failed" ], Import.distinct.pluck(:status)
    assert Import.all.all?(&:finished_at)
    assert_match "interrupted", Import.first.error
    ImportJob.queue_adapter = @adapter
    assert_enqueued_with(job: ImportJob) { Import.first.retry! }
    assert_equal "queued", Import.first.status
  end

  test "ReconcileImportsJob runs the reconciliation" do
    import = Import.create!(kind: "text", text: "Pie", origin: "web")
    failed_execution(import.active_job_id)
    ImportJob.queue_adapter = :solid_queue

    ReconcileImportsJob.perform_now

    assert_equal "failed", import.reload.status
  end

  test "a previous attempt's failure cannot overwrite a retry or a completed import" do
    import = Import.create!(kind: "text", text: "Pie", origin: "web")
    old_id = import.active_job_id
    import.fail!("Try again")
    import.retry!
    assert_not_equal old_id, import.reload.active_job_id
    failed_execution(old_id)
    done = Import.create!(kind: "text", text: "Cake", origin: "web")
    done.succeed!(Recipe.create!(title: "Cake"))
    failed_execution(done.active_job_id)
    ImportJob.queue_adapter = :solid_queue

    Import.reconcile_failed_jobs!

    assert_equal "queued", import.reload.status
    assert_equal "done", done.reload.status
  end

  test "reconciles jobs queued before job tracking was introduced" do
    import = Import.create!(kind: "text", text: "Pie", origin: "web")
    id = import.active_job_id
    failed_execution(id)
    connection = SolidQueue::Record.connection
    arguments = { "arguments" => [ { "_aj_globalid" => import.to_global_id.to_s } ] }.to_json
    connection.execute("UPDATE solid_queue_jobs SET class_name = 'ImportJob', arguments = #{connection.quote(arguments)}")
    import.update!(active_job_id: nil, status: "extracting")
    ImportJob.queue_adapter = :solid_queue

    Import.reconcile_failed_jobs!

    assert_equal "failed", import.reload.status
    assert_equal id, import.active_job_id
  end

  test "running and scheduled jobs remain pending" do
    import = Import.create!(kind: "text", text: "Pie", origin: "web")
    import.advance!("extracting")
    SolidQueue::Record.connection.execute(
      "INSERT INTO solid_queue_jobs (active_job_id) VALUES (#{SolidQueue::Record.connection.quote(import.active_job_id)})"
    )
    ImportJob.queue_adapter = :solid_queue

    Import.reconcile_failed_jobs!

    assert_equal "extracting", import.reload.status
  end

  private

  def failed_execution(id)
    connection = SolidQueue::Record.connection
    job_id = connection.insert("INSERT INTO solid_queue_jobs (active_job_id) VALUES (#{connection.quote(id)})")
    connection.execute("INSERT INTO solid_queue_failed_executions (job_id) VALUES (#{Integer(job_id)})")
  end
end
