# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_24_160000) do
  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "imports", force: :cascade do |t|
    t.string "kind", null: false
    t.string "origin", null: false
    t.string "url"
    t.text "text"
    t.string "status", default: "queued", null: false
    t.string "error"
    t.integer "recipe_id"
    t.datetime "finished_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "active_job_id"
    t.index ["created_at"], name: "index_imports_on_created_at"
    t.index ["recipe_id"], name: "index_imports_on_recipe_id"
    t.index ["status"], name: "index_imports_on_status"
  end

  create_table "recipes", force: :cascade do |t|
    t.string "title", null: false
    t.text "description"
    t.string "author"
    t.string "source_url"
    t.string "source_host"
    t.string "source_name"
    t.integer "servings"
    t.string "yield_text"
    t.integer "prep_minutes"
    t.integer "cook_minutes"
    t.integer "total_minutes"
    t.string "cuisine"
    t.string "course"
    t.string "main_ingredient"
    t.json "diets", default: [], null: false
    t.json "tags", default: [], null: false
    t.json "ingredients", default: [], null: false
    t.json "steps", default: [], null: false
    t.json "tips", default: [], null: false
    t.text "notes"
    t.integer "rating"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "favorited_at"
    t.index ["course"], name: "index_recipes_on_course"
    t.index ["created_at"], name: "index_recipes_on_created_at"
    t.index ["cuisine"], name: "index_recipes_on_cuisine"
    t.index ["favorited_at"], name: "index_recipes_on_favorited_at"
    t.index ["main_ingredient"], name: "index_recipes_on_main_ingredient"
    t.index ["source_url"], name: "index_recipes_on_source_url", unique: true
    t.index ["total_minutes"], name: "index_recipes_on_total_minutes"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "imports", "recipes", on_delete: :nullify

  # Virtual tables defined in this database.
  # Note that virtual tables may not work with other database engines. Be careful if changing database.
  create_virtual_table "recipe_search", "fts5", ["title", "description", "ingredients", "tags", "notes", "tokenize='porter unicode61 remove_diacritics 2'"]
end
