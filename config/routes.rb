Rails.application.routes.draw do
  if Rails.env.development?
    # Redirect 127.0.0.1 to localhost so the page and the Vite dev server share an origin.
    constraints(host: "127.0.0.1") do
      get "(*path)", to: redirect { |params, req| "#{req.protocol}localhost:#{req.port}/#{params[:path]}" }
    end
  end

  root "recipes#index"
  resources :recipes, only: %i[show edit update destroy] do
    resource :archive, only: :create, module: :recipes
    resources :cooks, only: %i[create destroy], module: :recipes
    resource :favorite, only: %i[create destroy]
  end
  resources :imports, only: %i[index create] do
    post :retry, on: :member
  end
  get "share", to: "share#show"
  resource :settings, only: %i[show update]
  post "settings/export", to: "cookbook_exports#create", as: :cookbook_export
  resource :appearance, only: %i[show update]
  resources :themes, only: %i[new create edit update destroy]

  namespace :api do
    resources :imports, only: %i[create show]
  end

  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  get "up" => "rails/health#show", as: :rails_health_check

  # Imported images are attached on the server. No browser upload routes.
  scope "/rails/active_storage" do
    get "/blobs/proxy/:signed_id/*filename", to: "active_storage/blobs/proxy#show", as: :rails_service_blob_proxy
    get "/representations/proxy/:signed_blob_id/:variation_key/*filename",
        to: "active_storage/representations/proxy#show", as: :rails_blob_representation_proxy
  end

  direct :rails_storage_proxy do |model, options|
    if model.respond_to?(:signed_id)
      route_for(:rails_service_blob_proxy, model.signed_id, model.filename, options)
    else
      route_for(:rails_blob_representation_proxy, model.blob.signed_id, model.variation.key, model.blob.filename, options)
    end
  end
end
