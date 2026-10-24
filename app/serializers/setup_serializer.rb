# Only configuration status belongs in the browser. Never send credential values.
module SetupSerializer
  extend self

  def call
    {
      claude_configured: Sizzle.claude_configured?,
      version: Sizzle.version
    }
  end
end
