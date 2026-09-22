import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/monitor.dart';
import 'package:mobile/data/models/live_state.dart';
import 'package:mobile/ui/dashboard/widgets/monitor_card.dart';
import 'package:mobile/main.dart';

// Guards the dashboard card against text cropping / horizontal overflow on
// narrow screens. The card previously had three unconstrained children in its
// bottom metrics row and an unconstrained status label, so a long value or a
// narrow phone clipped them. These tests pump the real widget at a phone
// width with worst-case strings and fail on any RenderFlex overflow.

MonitorConfig _config({
  String name = 'Inference API',
  String type = 'http',
  String target = 'https://api.example.com/health',
  int intervalSeconds = 60,
  bool publicOnStatusPage = false,
  bool muteAlerts = false,
  bool enabled = true,
}) =>
    MonitorConfig.fromFirestore('m1', {
      'orgId': 'org1',
      'name': name,
      'type': type,
      'target': target,
      'intervalSeconds': intervalSeconds,
      'publicOnStatusPage': publicOnStatusPage,
      'muteAlerts': muteAlerts,
      'enabled': enabled,
    });

Widget _wrap(Widget child, {double width = 360}) => MaterialApp(
      // Keep the pump self-contained: the card reaches for this key when the
      // heartbeat copy button is tapped, so it must exist.
      scaffoldMessengerKey: rootScaffoldMessengerKey,
      home: Scaffold(
        body: Center(
          child: SizedBox(width: width, child: child),
        ),
      ),
    );

void main() {
  testWidgets('renders a long monitor name without overflow', (tester) async {
    await tester.pumpWidget(_wrap(MonitorCard(
      config: _config(
        name: 'A very long monitor name that would previously push the row wide',
      ),
      live: LiveState.fromMap({'status': 'up', 'lastResponseTimeMs': 1234}),
      onTap: () {},
      onEdit: () {},
      onTogglePause: () {},
      onDelete: () {},
    )));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.textContaining('A very long monitor name'), findsOneWidget);
  });

  testWidgets('renders a long status label without cropping', (tester) async {
    await tester.pumpWidget(_wrap(MonitorCard(
      config: _config(),
      live: LiveState.fromMap({'status': 'maintenance', 'lastResponseTimeMs': 1}),
      onTap: () {},
      onEdit: () {},
      onTogglePause: () {},
      onDelete: () {},
    )));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.text('MAINTENANCE'), findsOneWidget);
  });

  testWidgets('bottom metrics row fits at a narrow phone width', (tester) async {
    await tester.pumpWidget(_wrap(
      MonitorCard(
        config: _config(publicOnStatusPage: true, muteAlerts: true),
        live: LiveState.fromMap({
          'status': 'down',
          'lastResponseTimeMs': 99999,
          'uptime30d': 99.999,
          'lastCheckedAt': 0,
          'certExpiresAt': DateTime.now().millisecondsSinceEpoch + 86400000,
        }),
        onTap: () {},
        onEdit: () {},
        onTogglePause: () {},
        onDelete: () {},
      ),
      width: 320, // iPhone SE-class width
    ));
    await tester.pump();

    // A RenderFlex overflow is reported as an exception via the FlutterError
    // handler; takeException() surfaces it if the layout overflowed.
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'heartbeat card renders its token preview without overflow',
      (tester) async {
    final heartbeat = MonitorConfig.fromFirestore('h1', {
      'orgId': 'org1',
      'name': 'Cron Job',
      'type': 'heartbeat',
      'target': '',
      'intervalSeconds': 300,
      'enabled': true,
      'heartbeatToken': 'abcdef0123456789abcdef0123456789',
    });

    await tester.pumpWidget(_wrap(
      MonitorCard(
        config: heartbeat,
        live: LiveState.fromMap({'status': 'up', 'lastCheckedAt': 0}),
        onTap: () {},
        onEdit: () {},
        onTogglePause: () {},
        onDelete: () {},
      ),
      width: 320,
    ));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.text('Copy URL'), findsOneWidget);
  });
}
