fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## Android

### android test

```sh
[bundle exec] fastlane android test
```

Runs all the tests

### android prepare

```sh
[bundle exec] fastlane android prepare
```

Prepare and archive app

### android prepare_single_apk

```sh
[bundle exec] fastlane android prepare_single_apk
```

Prepare and archive single apk app

### android firebase_deploy

```sh
[bundle exec] fastlane android firebase_deploy
```

[Firebase-App-Distribute] Deploy a new version to the Firebase App-Distribute

### android internal_deploy

```sh
[bundle exec] fastlane android internal_deploy
```

[Internal-Track] Deploy a new version to the Google Play

### android alpha_deploy

```sh
[bundle exec] fastlane android alpha_deploy
```

[Alpha-Track] Deploy a new version to the Google Play

### android huawei_deploy

```sh
[bundle exec] fastlane android huawei_deploy
```

[Alpha-Track] Deploy a new version to the Huawei

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
