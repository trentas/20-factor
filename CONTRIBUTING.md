# Contributing

## Build and test locally

The site is Jekyll with the [al-folio](https://github.com/alshedivat/al-folio) theme. Use the Ruby version in `.ruby-version` and the gems in `Gemfile.lock`:

```sh
bundle install
bundle exec jekyll build
node --test "tests/*.test.cjs"   # Node 22+; tests read the build from _site
```

Pull requests run the same build and tests (`.github/workflows/validate.yml`), and a push to `main` publishes only a build that passes them.

## Writing factor content

- **State rules, not implementations.** A factor says what a mechanism must guarantee, as tables and short rules. Keep code to brief WRONG/RIGHT contrasts, diagrams, and small artifact shapes (a prompt file, a tool schema), and link to primary documentation instead of writing a full implementation.
- **Cite primary sources** — specifications, official documentation, standards, regulations — next to the claim, and check each link before committing. Keep prices, model names, and other fast-moving facts out of the rules where possible.
- **Say how strong a rule is.** Separate legal obligations (with the jurisdiction and article) from contractual requirements, technical recommendations, and this project's own choices.

## Changing a Compliance Checklist

The self-assessment reads every factor's `## Compliance Checklist` and ties saved answers to each item's exact wording.

- **Rewording an item** asks everyone who answered it to reconfirm. Do it when the meaning changes — a typo fix triggers the same review, so batch small edits.
- **Adding an item** is safe anywhere; **moving one** keeps its answers.
- The build fails if a factor has no checklist items, if two items in a factor are identical, or if front matter is missing the factor number or tier.

## Dependencies

Gems are locked in `Gemfile.lock`, GitHub Actions are pinned to commit SHAs, and the theme is pinned to a commit in `_config.yml`. Dependabot proposes updates as pull requests. When updating the theme, copy the `third_party_libraries` block from al-folio's `_config.yml` at the new commit and expand `{{version}}` in its URLs — the theme plugin that does this does not run for a remote theme.
