# Guides setup without accepting or exposing server credentials.
class SetupController < InertiaController
  def show
    return redirect_to setup_path(step: "ready") if params[:step] == "privacy"

    step = %w[welcome ready claude].include?(params[:step]) ? params[:step] : "welcome"
    render inertia: "setup/show", props: { setup: SetupSerializer.call, step: }
  end
end
