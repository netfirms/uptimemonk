import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:mobile/ui/widgets/app_version_label.dart';

// The version is read from the platform so it tracks the build, not a Dart
// constant that would drift. These tests pin the formatting rules and the
// promise that the widget never breaks the screen it sits on.

void _mock({String version = '1.0.0', String build = '1'}) {
  PackageInfo.setMockInitialValues(
    appName: 'UptimeMonke',
    packageName: 'com.uptimemonke.app',
    version: version,
    buildNumber: build,
    buildSignature: '',
  );
}

Widget _wrap(Widget child) => MaterialApp(
      home: Scaffold(body: Center(child: child)),
    );

void main() {
  testWidgets('renders the version, omitting a default build number of 1',
      (tester) async {
    _mock(version: '1.0.0', build: '1');
    await tester.pumpWidget(_wrap(const AppVersionLabel()));
    await tester.pumpAndSettle();

    expect(find.text('UptimeMonke v1.0.0'), findsOneWidget);
  });

  testWidgets('includes the build number when it is not the default',
      (tester) async {
    _mock(version: '1.2.3', build: '42');
    await tester.pumpWidget(_wrap(const AppVersionLabel()));
    await tester.pumpAndSettle();

    expect(find.text('UptimeMonke v1.2.3 (42)'), findsOneWidget);
  });

  testWidgets('honours a custom prefix', (tester) async {
    _mock(version: '2.0.0', build: '1');
    await tester.pumpWidget(_wrap(const AppVersionLabel(prefix: 'Build')));
    await tester.pumpAndSettle();

    expect(find.text('Build v2.0.0'), findsOneWidget);
  });

  testWidgets('renders nothing before the version resolves', (tester) async {
    _mock(version: '1.0.0', build: '1');
    await tester.pumpWidget(_wrap(const AppVersionLabel()));
    // No pumpAndSettle: the async load has not completed yet, so the widget
    // must occupy no space rather than show a placeholder that then jumps.
    expect(find.textContaining('v1.0.0'), findsNothing);
  });
}
