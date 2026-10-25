# Builds a minimal YouTube watch page: the player data sits in a JavaScript
# assignment between other scripts, as it does on youtube.com.
module YoutubeWatchPage
  VIDEO_ID = "O1WQTKuWWfM".freeze

  def self.html(video_id: VIDEO_ID, title: "No-Knead Focaccia", author: "Emma's Goodies",
                description: "No-knead focaccia\n\n- 560g bread flour\n- 470g warm water\n\nMix, rest, dimple and bake.",
                status: "OK", details: {})
    player = { "playabilityStatus" => { "status" => status } }
    unless details.nil? # nil leaves videoDetails out, as for removed videos
      player["videoDetails"] = { "videoId" => video_id, "title" => title, "author" => author,
                                 "shortDescription" => description }.merge(details).compact
    end

    <<~HTML
      <!DOCTYPE html><html><head><script>var ytcfg = {"label": "{"};</script></head><body>
      <script nonce="abc">var ytInitialPlayerResponse = #{JSON.generate(player)};var meta = document.createElement('meta');</script>
      <script>var ytInitialData = {"contents": {}};</script>
      </body></html>
    HTML
  end
end
