# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- The `overpass` source queried the wrong area when Nominatim returned a numeric `osm_id`,
  which it now always does, and for 9-digit relation ids ([#3]).

### Changed

- HTTP requests use Node's built-in `fetch`; the deprecated `request` client and its critical
  `form-data` advisory are gone. Requires Node.js 18 or later ([#2]).
- The package is MIT-licensed; `package.json` no longer carries npm-install metadata ([#1]).

[Unreleased]: https://github.com/tibetty/QueryGeoBoundary/compare/v0.3.6...HEAD
[#1]: https://github.com/tibetty/QueryGeoBoundary/issues/1
[#2]: https://github.com/tibetty/QueryGeoBoundary/issues/2
[#3]: https://github.com/tibetty/QueryGeoBoundary/issues/3
