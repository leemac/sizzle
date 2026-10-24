module RuboCop
  module Cop
    module Sizzle
      # A command given as one string runs through a shell, so anything
      # interpolated into it can inject commands. Pass the program and each
      # argument separately, with "--" before user input. See AGENTS.md,
      # security rule 2.
      #
      #   # bad
      #   system("yt-dlp #{url}")
      #   `convert #{path} out.png`
      #   Open3.capture3(command)
      #
      #   # good
      #   Open3.capture3("yt-dlp", "--", url)
      class ShellString < Base
        MSG = "Run commands with an argument list, not a shell string (AGENTS.md security rule 2)."
        # Sets, because node patterns compare against a constant with ===.
        KERNEL_METHODS = Set[:system, :exec, :spawn].freeze
        CAPTURE_METHODS = Set[:capture2, :capture2e, :capture3, :popen2, :popen2e, :popen3].freeze

        def_node_matcher :kernel_command?, "(send {nil? (const {nil? cbase} :Kernel) (const {nil? cbase} :Process)} %KERNEL_METHODS ...)"
        def_node_matcher :open3_command?, "(send (const {nil? cbase} :Open3) %CAPTURE_METHODS ...)"
        def_node_matcher :popen?, "(send (const {nil? cbase} :IO) :popen ...)"

        def on_xstr(node)
          add_offense(node)
        end

        def on_send(node)
          return unless kernel_command?(node) || open3_command?(node) || popen?(node)

          add_offense(node) if shell_form?(node)
        end

        private

        # A single command argument (after an optional env hash) is shell form.
        # Several arguments, an argv array or a splat are not.
        def shell_form?(node)
          commands = node.arguments.reject(&:hash_type?)
          commands.size == 1 && !commands.first.type?(:array, :splat)
        end
      end
    end
  end
end
