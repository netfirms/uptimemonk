import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/external_link.dart';

/// Covers the branches that do not reach the platform.
///
/// The launch itself is a plugin call over a pigeon channel; mocking it would
/// assert that Flutter can dispatch a method call, which is not in doubt and
/// not what breaks. What breaks is a malformed URL reaching the platform, or a
/// failure crashing the sheet instead of reporting itself — and both of those
/// are testable here.
void main() {
  Future<void> pumpWithButton(
    WidgetTester tester,
    String url,
    void Function(bool) onDone, {
    UrlLauncher? launcher,
  }) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async => onDone(
              await openExternalUrl(
                context,
                url,
                launcher: launcher ?? (_) async => true,
              ),
            ),
            child: const Text('go'),
          ),
        ),
      ),
    ));
  }

  testWidgets('rejects a string with no scheme rather than handing it over',
      (tester) async {
    // "uptimemonke.com/status/abc" parses fine and has no scheme. Passing it
    // through reaches the platform as a relative URI, which fails in a way
    // that is much harder to read than this message.
    bool? result;
    await pumpWithButton(tester, 'uptimemonke.com/status/abc', (r) => result = r);
    await tester.tap(find.text('go'));
    await tester.pump();

    expect(result, isFalse);
    expect(find.text('That link is not valid.'), findsOneWidget);
  });

  testWidgets('rejects an empty string', (tester) async {
    bool? result;
    await pumpWithButton(tester, '', (r) => result = r);
    await tester.tap(find.text('go'));
    await tester.pump();

    expect(result, isFalse);
    expect(find.text('That link is not valid.'), findsOneWidget);
  });

  testWidgets('reports a thrown launch failure instead of crashing',
      (tester) async {
    // The real shape of this: no browser, a locked-down device, or a plugin
    // that is not registered. The sheet has to stay up and say something.
    bool? result;
    await pumpWithButton(
      tester,
      'https://uptimemonke.com/status/abc',
      (r) => result = r,
      launcher: (_) async => throw Exception('no activity found'),
    );
    await tester.tap(find.text('go'));
    await tester.pumpAndSettle();

    expect(result, isFalse);
    expect(find.text('Could not open the link.'), findsOneWidget);
  });

  testWidgets('reports a declined launch', (tester) async {
    // The platform understood the request and said no — a different branch
    // from a thrown error, and a different message.
    bool? result;
    await pumpWithButton(
      tester,
      'https://uptimemonke.com/status/abc',
      (r) => result = r,
      launcher: (_) async => false,
    );
    await tester.tap(find.text('go'));
    await tester.pumpAndSettle();

    expect(result, isFalse);
    expect(find.text('No app on this device can open that link.'), findsOneWidget);
  });

  testWidgets('opens a valid https link', (tester) async {
    Uri? launched;
    bool? result;
    await pumpWithButton(
      tester,
      'https://uptimemonke.com/status/abc',
      (r) => result = r,
      launcher: (u) async {
        launched = u;
        return true;
      },
    );
    await tester.tap(find.text('go'));
    await tester.pumpAndSettle();

    expect(result, isTrue);
    expect(launched.toString(), 'https://uptimemonke.com/status/abc');
    // Nothing to apologise for on the happy path.
    expect(find.byType(SnackBar), findsNothing);
  });
}
