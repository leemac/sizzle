class ReleasesController < InertiaController
  def index
    inertia_meta.add(title: "What's new")
    render inertia: "releases/index", props: { releases: ReleaseNotesSerializer.call }
  end
end
