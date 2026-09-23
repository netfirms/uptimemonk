# UptimeMonke mobile — build & release
#
# Every build/deploy target depends on `test`, so a failing test or analyzer
# warning refuses the release. Run `make help` for the list.

FLUTTER ?= flutter
FASTLANE ?= fastlane

# Xcode keeps its bulk outside the repo, so `flutter clean` reclaims almost
# none of it. Measured on this host mid-build: DerivedData 1.9G, simulator
# devices 2.8G, mobile/build 1.2G — against 4.4G free.
DERIVED_DATA := $(HOME)/Library/Developer/Xcode/DerivedData
XCODE_ARCHIVES := $(HOME)/Library/Developer/Xcode/Archives
SIM_DEVICES := $(HOME)/Library/Developer/CoreSimulator/Devices
DEVICE_SUPPORT := $(HOME)/Library/Developer/Xcode/iOS DeviceSupport

# Free kilobytes on /, read before and after a reclaim so targets report what
# they actually recovered rather than what they hoped to.
free_kb = $$(df -k / | awk 'NR==2 {print $$4}')

# Build numbers follow the fastlane convention: 1.0.<commit count>.
BUILD_NUMBER := $(shell git rev-list --count HEAD 2>/dev/null || echo 0)
BUILD_NAME   := 1.0.$(BUILD_NUMBER)

.DEFAULT_GOAL := help
.PHONY: help deps analyze test test-only build check build-apk build-appbundle \
        build-ios deploy-android-internal deploy-android-alpha \
        deploy-android-firebase deploy-ios-testflight deploy-ios-release \
        clean space rescue clean-build clean-xcode clean-sims reset-sims \
        clean-pods clean-pub

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

# --- Disk ------------------------------------------------------------------
#
# An iOS build fills this disk. It has happened twice, and the second time the
# volume hit zero bytes, which breaks far more than the build: every tool that
# writes a temp file starts failing with ENOSPC, including editors, so you
# cannot even patch your way out. These targets are therefore deletion-only —
# they write nothing and stay usable at zero free space.
#
# Ordered by payoff. `rescue` is the one to reach for mid-build.

space: ## Report what is using disk (read-only, safe at 0 bytes free)
	@echo "Free space:"
	@df -h / | awk 'NR==1 || NR==2'
	@echo
	@echo "Reclaimable (largest first):"
	@for p in "$(DERIVED_DATA)" "$(SIM_DEVICES)" build .dart_tool \
	          "$(DEVICE_SUPPORT)" ios/Pods "$(HOME)/Library/Caches/CocoaPods"; do \
		[ -e "$$p" ] && du -sh "$$p" 2>/dev/null; \
	done | sort -rh | sed 's/^/  /'
	@echo
	@echo "Held back on purpose:"
	@[ -e "$(XCODE_ARCHIVES)" ] && du -sh "$(XCODE_ARCHIVES)" 2>/dev/null | sed 's/^/  /' || true
	@echo "    Archives carry the dSYMs that symbolicate crash reports from"
	@echo "    builds already shipped to TestFlight and the App Store. They"
	@echo "    cannot be regenerated once deleted, so no target here removes"
	@echo "    them. Delete an old dated folder by hand if you must."

rescue: ## Disk full mid-build: reclaim everything regenerable, keep your data
	@before=$(free_kb); \
	echo "== stopping the Xcode build service =="; \
	killall -9 XCBBuildService 2>/dev/null || true; \
	echo "== clearing DerivedData, build/, .dart_tool =="; \
	rm -rf "$(DERIVED_DATA)" build .dart_tool ios/.symlinks 2>/dev/null || true; \
	after=$(free_kb); \
	echo; echo "Reclaimed: $$(( (after - before) / 1024 )) MB"; \
	df -h / | awk 'NR==2 {print "Now free: " $$4}'
	@echo
	@echo "Next: 'flutter pub get' — .dart_tool was removed. The following"
	@echo "iOS build is a cold one (~9 min here, against ~70s incremental)."
	@echo
	@echo "Simulators were left alone: erasing them wipes app data and signs"
	@echo "you out of the app under test. If you still need room, see the"
	@echo "sizes in 'make space', then 'make clean-sims' (safe) or"
	@echo "'make reset-sims CONFIRM=yes' (destroys simulator state)."

clean: ## Remove this project's build artefacts (flutter clean + caches)
	$(FLUTTER) clean
	rm -rf build .dart_tool ios/.symlinks

clean-build: clean ## Alias for `clean`, kept for muscle memory

clean-xcode: ## Delete all DerivedData and the module cache (costs a full rebuild)
	# XCBBuildService holds these open. Deleting underneath a live build
	# service is what produced "unable to load transferred PIF: PIF object has
	# been invalidated" on this host — the build then fails for a reason that
	# looks nothing like the cause. Stop it first.
	@before=$(free_kb); \
	killall -9 XCBBuildService 2>/dev/null || true; \
	rm -rf "$(DERIVED_DATA)"; \
	after=$(free_kb); \
	echo "Reclaimed: $$(( (after - before) / 1024 )) MB"

clean-sims: ## Remove simulators for runtimes no longer installed (keeps your data)
	xcrun simctl delete unavailable
	@df -h / | awk 'NR==2 {print "Now free: " $$4}'

reset-sims: ## ERASE every simulator. Wipes app data and signs you out
	@if [ "$(CONFIRM)" != "yes" ]; then \
		echo "Refusing: this erases every simulator's data, including the"; \
		echo "signed-in session of the app you are testing. That cost a"; \
		echo "debugging session here once."; \
		echo "Re-run as: make reset-sims CONFIRM=yes"; \
		exit 1; \
	fi
	xcrun simctl shutdown all 2>/dev/null || true
	xcrun simctl erase all
	@df -h / | awk 'NR==2 {print "Now free: " $$4}'

clean-pods: ## Remove Pods and the CocoaPods cache
	rm -rf ios/Pods ios/Podfile.lock "$(HOME)/Library/Caches/CocoaPods"

clean-pub: ## Purge the Flutter package cache (re-download needs network)
	$(FLUTTER) pub cache clean --force
