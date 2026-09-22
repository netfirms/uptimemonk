import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'theme.dart';

/// The launch itself, injectable so the failure paths can be tested.
///
/// Without this the only way to exercise "the browser refused" is to mock a
/// pigeon channel by name, which is both brittle and a test of Flutter's
/// plumbing rather than of this function's behaviour.
typedef UrlLauncher = Future<bool> Function(Uri uri);

Future<bool> _defaultLauncher(Uri uri) =>
    launchUrl(uri, mode: LaunchMode.externalApplication);

/// Opens [url] in the device's browser.
///
/// `externalApplication` rather than an in-app web view on purpose: a status
/// page is a thing people share, bookmark and send to colleagues, and all of
/// that needs a real address bar. An in-app view would also strip the padlock,
/// which is the one thing a reader checks before trusting a status page.
///
/// Returns true when the platform accepted the launch. Callers do not have to
/// check — a failure shows its own message — but the dashboard uses it to
/// decide whether to close the sheet.
///
/// Every failure is handled rather than thrown: there is no browser on some
/// simulators and locked-down devices, `canLaunchUrl` can return false for a
/// perfectly good https link on Android without the right queries entry, and
/// a crash is a much worse outcome than a toast.
Future<bool> openExternalUrl(
  BuildContext context,
  String url, {
  UrlLauncher launcher = _defaultLauncher,
}) async {
  final messenger = ScaffoldMessenger.maybeOf(context);

  void fail(String message) {
    messenger?.showSnackBar(
      SnackBar(
        backgroundColor: AppTheme.statusDown,
        content: Text(message),
      ),
    );
  }

  final uri = Uri.tryParse(url);
  if (uri == null || !uri.hasScheme) {
    fail('That link is not valid.');
    return false;
  }

  try {
    final ok = await launcher(uri);
    if (!ok) {
      // The platform understood the request and declined it — usually no
      // browser is installed, or nothing is registered for the scheme.
      fail('No app on this device can open that link.');
    }
    return ok;
  } catch (e) {
    debugPrint('Could not launch $url: $e');
    fail('Could not open the link.');
    return false;
  }
}
