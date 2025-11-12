# Starter Monorepo

Starter monorepo designed to work with pnpm and turbo repo.

Comes out of the box with configuration for helpful devtools
- [pnpm](https://pnpm.io/): Efficient package manager used for [workspace](https://pnpm.io/workspaces) management configured in [pnpm-workspace.yaml](./pnpm-workspace.yaml) and hoisting configured in [.npmrc](./.npmrc)
- [syncpack](https://github.com/JamieMason/syncpack): Sync dependency Versions
- [depcheck](https://github.com/depcheck/depcheck): Eliminate unused dependencies
- [dotenv](https://github.com/motdotla/dotenv) & [dotenv-vault](https://github.com/dotenv-org/dotenv-vault): For local & remote envvar management
- [turborepo](https://turbo.build/repo/docs): For build step caching in large monorepos with configuration in [turbo.json](./turbo.json)
- [changesets](https://github.com/changesets/changesets): For automated package release management
- [esbuild](https://esbuild.github.io/): For fast Typescript transpilation to JS with shared config
- [eslint](https://eslint.org/): For linting with shared config

Additional configs include
- [.vscode/extensions.json](./.vscode/extensions.json): Recommended VSCode extensions
- [.vscode/settings.json](./.vscode/settings.json): Recommended VSCode settings
- [.github/workflows/build.yml](./github/workflows/build.yml): Github Action CI
