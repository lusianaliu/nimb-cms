# Nimb CMS Architecture (Phase 0 Draft)
Nimb CMS is designed as a plugin-first CMS where capabilities grow by extension.
The core stays domain-agnostic so it can support many content models.
Themes handle presentation only and must not own business logic.
Blocks represent content only and remain portable across themes.
Configuration should be explicit, versionable, and environment-aware.
This phase defines identity boundaries only, not runtime features.
Future phases can add services without violating these principles.
