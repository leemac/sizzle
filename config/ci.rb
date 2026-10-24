# Run using bin/ci — the same checks GitHub Actions runs. Agents and humans
# should see this pass before opening a pull request.

CI.run do
  step "Setup", "bin/setup --skip-server"

  step "Style: Ruby", "bin/rubocop"
  step "Style: Frontend", "npm run -s format:check"
  step "Lint: Frontend", "npm run -s lint"
  step "Types: Frontend", "npm run -s check"

  step "Security: Gem audit", "bin/bundler-audit check --update"
  step "Security: npm audit", "npm audit --audit-level=high --omit=dev"
  step "Security: Brakeman code analysis", "bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error"

  step "Tests: Frontend", "npm test --silent"
  step "Tests: Rails", "bin/rails test"
  step "Tests: Browser", "npm run test:browser"
end
