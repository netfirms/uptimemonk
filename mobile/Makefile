# UptimeMonke mobile — build & release
#
# Every build/deploy target depends on `test`, so a failing test or analyzer
# warning refuses the release. Run `make help` for the list.

FLUTTER ?= flutter
FASTLANE ?= fastlane

# Build numbers follow the fastlane convention: 1.0.<commit count>.
BUILD_NUMBER := $(shell git rev-list --count HEAD 2>/dev/null || echo 0)
BUILD_NAME   := 1.0.$(BUILD_NUMBER)

.DEFAULT_GOAL := help
.PHONY: help deps analyze test test-only build check build-apk build-appbundle \
        build-ios deploy-android-internal deploy-android-alpha \
        deploy-android-firebase deploy-ios-testflight deploy-ios-release \
        clean

help: ## Show this help
	@echo "UptimeMonke mobile — targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-26s\033[0m %s\n", $$1, $$2}'

deps: ## Resolve Flutter and platform dependencies
	$(FLUTTER) pub get
	cd ios && pod install && cd ..

analyze: ## Static analysis and lints (analysis_options.yaml)
	# --no-fatal-infos keeps the gate red on errors/warnings but does not block
	# on pre-existing deprecation infos already in lib/. Remove the flag once
	# those are cleared if you want infos to fail the build too.
	$(FLUTTER) analyze --no-fatal-infos

test-only: ## Run the unit/widget tests only (no analyze)
	$(FLUTTER) test

test: analyze test-only ## Gate: analyze + test. Used by every build/deploy target
	@echo "== tests and analysis passed =="

check: test ## Alias for `test`

build-apk: test ## Build a release APK (after tests pass)
	$(FLUTTER) build apk --release \
		--build-name=$(BUILD_NAME) --build-number=$(BUILD_NUMBER)

build-appbundle: test ## Build a release AAB for Play (after tests pass)
	$(FLUTTER) build appbundle --release \
		--build-name=$(BUILD_NAME) --build-number=$(BUILD_NUMBER)

build-ios: test ## Build an unsigned iOS release (after tests pass)
	$(FLUTTER) build ios --release --no-codesign \
		--build-name=$(BUILD_NAME) --build-number=$(BUILD_NUMBER)

build: test ## Build both platforms (Android AAB + iOS no-codesign)
	$(MAKE) build-appbundle
	$(MAKE) build-ios

# --- Deploys: each gated by `test` via the underlying fastlane lane, which
#     itself runs the upload after a build. Add `test` as a prerequisite here
#     too so a red test stops the command before fastlane starts.

deploy-android-internal: test ## fastlane android internal_deploy
	cd android && $(FASTLANE) android internal_deploy

deploy-android-alpha: test ## fastlane android alpha_deploy
	cd android && $(FASTLANE) android alpha_deploy

deploy-android-firebase: test ## fastlane android firebase_deploy
	cd android && $(FASTLANE) android firebase_deploy

deploy-ios-testflight: test ## fastlane ios testflightupload
	cd ios && $(FASTLANE) ios testflightupload

deploy-ios-release: test ## fastlane ios release
	cd ios && $(FASTLANE) ios release

clean: ## Remove build artefacts
	$(FLUTTER) clean
