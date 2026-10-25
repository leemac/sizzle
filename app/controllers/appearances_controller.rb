# Lets each browser pick a theme and light, dark or auto. The choice is stored
# in cookies (see Appearance); nothing is written to the database.
class AppearancesController < InertiaController
  def show
    inertia_meta.add(title: "Appearance")
    render inertia: "appearance/show", props: { themes: ThemeSerializer.call }
  end

  def update
    appearance = Appearance.new(theme_id: params[:theme], mode: params[:mode])

    if appearance.save(cookies, secure: request.ssl?)
      redirect_to appearance_path, notice: "Appearance saved."
    else
      redirect_to appearance_path,
                  inertia: { errors: { theme: appearance.errors[:theme_id].to_sentence, mode: appearance.errors[:mode].to_sentence }.compact_blank }
    end
  end
end
