import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/monitor.dart';
import 'package:mobile/data/models/live_state.dart';
import 'package:mobile/ui/dashboard/widgets/monitor_card.dart';
import 'package:mobile/main.dart';

// Regression guard: a 20-character monitor name was being ellipsized in the
// card header because the name competed for width with the status pill, the
// protocol badge and three action icons. The name must render in full.

MonitorConfig _config(String name) => MonitorConfig.fromFirestore('m1', {
      'orgId': 'org1',
      'name': name,
      'type': 'http',
      'target': 'https://example.com',
      'intervalSeconds': 60,
      'enabled': true,
    });

Widget _wrap(Widget child, {double width = 360}) => MaterialApp(
      scaffoldMessengerKey: rootScaffoldMessengerKey,
      home: Scaffold(
        body: Center(child: SizedBox(width: width, child: child)),
      ),
    );

void main() {
  testWidgets('a 20-character name is not ellipsized', (tester) async {
    const name = 'Production API Health'; // exactly 21 incl. spaces
    await tester.pumpWidget(_wrap(MonitorCard(
      config: _config(name),
      live: LiveState.fromMap({'status': 'up', 'lastResponseTimeMs': 120}),
      onTap: () {},
      onEdit: () {},
      onTogglePause: () {},
      onDelete: () {},
    )));
    await tester.pump();

    expect(tester.takeException(), isNull);

    final finder = find.text(name);
    expect(finder, findsOneWidget);

    // The name must not be truncated: laid out at the width the card actually
    // gives it, with the same maxLines, it must not exceed those lines.
    final paragraph = tester.renderObject<RenderBox>(finder);
    final textWidget = tester.widget<Text>(finder);
    final painter = TextPainter(
      text: TextSpan(text: name, style: textWidget.style),
      textDirection: TextDirection.ltr,
      maxLines: textWidget.maxLines,
    )..layout(maxWidth: paragraph.size.width);

    expect(
      painter.didExceedMaxLines,
      isFalse,
      reason: 'the name "$name" was ellipsized instead of wrapping',
    );
  });

  testWidgets('name stays visible with the widest status label', (tester) async {
    const name = 'Production API Health';
    await tester.pumpWidget(_wrap(
      MonitorCard(
        config: _config(name),
        live: LiveState.fromMap({'status': 'maintenance'}),
        onTap: () {},
        onEdit: () {},
        onTogglePause: () {},
        onDelete: () {},
      ),
      width: 320,
    ));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.text(name), findsOneWidget);
  });
}
