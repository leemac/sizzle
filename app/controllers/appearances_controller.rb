# Lets each browser pick a theme and light, dark or auto. The choice is stored
# in cookies (see Appearance); nothing is written to the database.
class AppearancesController < InertiaController
  def show
    render inertia: "appearance/show", props: { themes: ThemeSerializer.call }
  end

  def update
    appearance = Appearance.new(theme_id: params[:theme], mode: params[:mode])
    # Only setup is an allowed "next" step, so the param can't redirect anywhere else.
    from_setup = params[:next] == "setup"

    if appearance.save(cookies, secure: request.ssl?)
      redirect_to from_setup ? setup_path(step: "ready") : appearance_path, notice: "Appearance saved."
    else
      redirect_to from_setup ? setup_path(step: "look") : appearance_path,
                  inertia: { errors: { theme: appearance.errors[:theme_id].to_sentence, mode: appearance.errors[:mode].to_sentence }.compact_blank }
    end
  end
end
