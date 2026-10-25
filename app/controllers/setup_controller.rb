# Guides setup without accepting or exposing server credentials.
class SetupController < InertiaController
  def show
    return redirect_to setup_path(step: "ready") if params[:step] == "privacy"

    step = %w[welcome look ready claude].include?(params[:step]) ? params[:step] : "welcome"
    # Picking a look is the one step setup can't skip.
    return redirect_to setup_path(step: "look") if step == "ready" && !helpers.appearance.chosen?

    inertia_meta.add(title: "Set up")
    props = { setup: SetupSerializer.call, step: }
    props[:themes] = ThemeSerializer.call if step == "look"
    render inertia: "setup/show", props:
  end
end
