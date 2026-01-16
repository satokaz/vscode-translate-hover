# Change Log
All notable changes to the "vscode-translate-hover" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2026-01-16

### Changed
- **Major Update**: Migrated from deprecated `request` package to `axios` for HTTP requests
- Updated VS Code engine requirement to `^1.85.0` (from `^1.14.0`)
- Updated TypeScript to version `5.3.3` (from `2.0.3`)
- Updated to modern VS Code extension development tooling:
  - Replaced `vscode` package with `@types/vscode` and `@vscode/test-electron`
  - Added `@vscode/test-cli` for testing
- Updated Node.js types to `^20.x` (from `^6.0.40`)
- Modernized TypeScript configuration:
  - Target ES2020 (from ES6)
  - Enabled strict mode and additional type checking
  - Added esModuleInterop and resolveJsonModule
- Improved code quality with strict TypeScript checks
- Added proper null/undefined checks for editor instances
- Removed deprecated `activationEvents` configuration
- Updated build scripts to use modern npm commands

### Fixed
- Fixed potential null pointer exceptions with editor access
- Improved error handling in translation requests
- Added timeout configuration for HTTP requests (10 seconds)

### Security
- Removed dependency on deprecated and unmaintained `request` and `request-promise` packages
- Updated all dependencies to latest secure versions

## [0.0.2]
- Previous release

## [Unreleased]
- Initial release