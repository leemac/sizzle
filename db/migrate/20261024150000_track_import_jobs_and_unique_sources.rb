class TrackImportJobsAndUniqueSources < ActiveRecord::Migration[8.1]
  def change
    add_column :imports, :active_job_id, :string
    remove_index :recipes, :source_url
    add_index :recipes, :source_url, unique: true
  end
end
