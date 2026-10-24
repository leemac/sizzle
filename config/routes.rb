Rails.application.routes.draw do
  if Rails.env.development?
    # Redirect 127.0.0.1 to localhost so the page and the Vite dev server share an origin.
    constraints(host: "127.0.0.1") do
      get "(*path)", to: redirect { |params, req| "#{req.protocol}localhost:#{req.port}/#{params[:path]}" }
    end
  end

  root "recipes#index"
  resources :recipes, only: %i[show destroy]
  resources :imports, only: %i[index create] do
    post :retry, on: :member
  end
  get "share", to: "share#show"

  namespace :api do
    resources :imports, only: %i[create show]
  end

  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  get "up" => "rails/health#show", as: :rails_health_check
end
