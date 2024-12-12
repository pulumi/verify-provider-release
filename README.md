# Verify Pulumi Provider Release Action

[![GitHub Super-Linter](https://github.com/pulumi/verify-provider-release/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/pulumi/verify-provider-release/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/pulumi/verify-provider-release/actions/workflows/check-dist.yml/badge.svg)](https://github.com/pulumi/verify-provider-release/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/pulumi/verify-provider-release/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/pulumi/verify-provider-release/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Verify that a published Pulumi provider is usable from its SDK for a particular
platform.

This action performs a simple preview operation of a program having installed
the specified SDK version. This can be executed in Linux, Mac and Windows
environments to ensure cross-platform builds work correctly.

## Usage

```yaml
- uses: pulumi/verify-provider-release@v1
  with:
    # The runtime to test against. One of `nodejs`, `python`, `dotnet` or `go`.
    runtime: 'nodejs'
    # Path to a Pulumi program to use for the test.
    directory: examples/simple-nodejs
    # The name of the provider (excluding the publisher prefix)
    provider: xyz
    # The version of the provider to be tested.
    providerVersion: '1.0.0'
    # The version of the package to be tested. Defaults to `providerVersion`
    # if not set. This must be set for Go because its versions are always a
    # different format to the provider's.
    packageVersion: '1.0.0'
    # Template to generate the go module to be used.
    # Available template fields: `{publisher}`, `{provider}`, `{moduleVersionSuffix}`
    # {moduleVersionSuffix} is calculated from the provider version e.g. "/v2"
    # Defaults to: `github.com/{publisher}/pulumi-{provider}/sdk{moduleVersionSuffix}`
    goModuleTemplate: 'github.com/{publisher}/pulumi-{provider}/sdk{moduleVersionSuffix}'
```

### Language-Specific Details

#### Python

1. When testing prereleases, you'll need to set the `packageVersion` because it
   will always be a different format to the provider's version.
1. The `Pulumi.yaml` runtime must set the `virtualenv` option to `venv`:

   ```yaml
   runtime:
     name: python
     options:
       virtualenv: venv
   ```

## Development Setup

1. :hammer_and_wrench: Install the dependencies

   ```bash
   npm install
   ```

1. :building_construction: Package the TypeScript for distribution

   ```bash
   npm run bundle
   ```

1. :white_check_mark: Run the tests

   ```bash
   $ npm test

   PASS  ./index.test.js
     ✓ throws invalid number (3ms)
     ✓ wait 500 ms (504ms)
     ✓ test runs (95ms)

   ...
   ```

## Publishing a New Release

1. [Create a GitHub release](https://github.com/pulumi/verify-provider-release/releases/new)
   specifying a new tag (e.g. `v1.2.3`) & generating release notes. This helps
   to communicate improvements and keep a record of significant changes. We
   **MUST** follow semantic versioning - only major versions can have breaking
   changes.

1. Fast-forward the major version branch (e.g. `v1`) to the latest commit on the
   `main` branch and push it. This is used to let our projects pin to just the
   major versions and automatically recieve non-breaking changes.
