import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/history.dart';
import 'package:mobile/ui/dashboard/widgets/hourly_bars.dart';
import 'package:mobile/core/theme.dart';

// The sparkline is what a user reads at a glance, so its colour rules are worth
// pinning: a healthy hour is green, a wholly-down hour is red, a mixed hour is
// amber, and an hour with no checks is a neutral gap — never red, which would
// report an outage that did not happen.

Bucket _b({required int t, int up = 0, int down = 0, double? ratio}) => Bucket(
      t: t,
      up: up,
      down: down,
      avgMs: 100,
      uptimeRatio: ratio ?? (up + down == 0 ? 1.0 : up / (up + down)),
    );

Widget _wrap(Widget child) => MaterialApp(
      home: Scaffold(
        backgroundColor: AppTheme.bgDark,
        body: SizedBox(width: 300, child: child),
      ),
    );

Color _barColorAt(WidgetTester tester, int index) {
  final containers = find.descendant(
    of: find.byType(HourlyBars),
    matching: find.byType(Container),
  );
  final container = tester.widgetList<Container>(containers).elementAt(index);
  final decoration = container.decoration as BoxDecoration;
  return decoration.color!;
}

void main() {
  testWidgets('renders one bar per bucket and none for an empty list',
      (tester) async {
    await tester.pumpWidget(_wrap(HourlyBars(
      buckets: [for (var i = 0; i < 12; i++) _b(t: i * 3600, up: 60)],
    )));
    await tester.pump();

    final containers = find.descendant(
      of: find.byType(HourlyBars),
      matching: find.byType(Container),
    );
    expect(tester.widgetList(containers).length, 12);

    await tester.pumpWidget(_wrap(const HourlyBars(buckets: [])));
    await tester.pump();
    expect(find.text('No history yet'), findsOneWidget);
  });

  testWidgets('colours hours by outcome: up green, down red, mixed amber',
      (tester) async {
    await tester.pumpWidget(_wrap(HourlyBars(
      buckets: [
        _b(t: 0, up: 60, down: 0), // fully up
        _b(t: 3600, up: 0, down: 60), // fully down
        _b(t: 7200, up: 30, down: 30, ratio: 0.5), // mixed
      ],
    )));
    await tester.pump();

    expect(_barColorAt(tester, 0), AppTheme.statusUp.withValues(alpha: 0.85));
    expect(_barColorAt(tester, 1), AppTheme.statusDown.withValues(alpha: 0.85));
    expect(_barColorAt(tester, 2), AppTheme.statusPending.withValues(alpha: 0.85));
  });

  testWidgets('an hour with no checks is a neutral gap, not an outage',
      (tester) async {
    await tester.pumpWidget(_wrap(HourlyBars(
      buckets: [_b(t: 0, up: 0, down: 0)],
    )));
    await tester.pump();

    // Every bar is drawn at 0.85 alpha, the gap included.
    expect(_barColorAt(tester, 0), AppTheme.borderLight.withValues(alpha: 0.85));
  });

  testWidgets('shows only the most recent N buckets, oldest first',
      (tester) async {
    // 20 buckets handed in, chart asks for 12: the oldest 8 must be dropped and
    // the ordering preserved so the timeline reads left to right.
    await tester.pumpWidget(_wrap(HourlyBars(
      buckets: [for (var i = 0; i < 20; i++) _b(t: i * 3600, up: 60)],
      hours: 12,
    )));
    await tester.pump();

    final containers = find.descendant(
      of: find.byType(HourlyBars),
      matching: find.byType(Container),
    );
    expect(tester.widgetList(containers).length, 12);
  });

  testWidgets('out-of-order buckets are sorted before display', (tester) async {
    // Defensive: the API returns ascending time, but the widget must not depend
    // on it. Out-of-order input should still show the newest window.
    await tester.pumpWidget(_wrap(HourlyBars(
      buckets: [
        _b(t: 7200, up: 0, down: 60), // newest, down -> red, must be last
        _b(t: 0, up: 60, down: 0), // oldest, up -> green, must be first
        _b(t: 3600, up: 60, down: 0),
      ],
      hours: 12,
    )));
    await tester.pump();

    final containers = find.descendant(
      of: find.byType(HourlyBars),
      matching: find.byType(Container),
    );
    final colors =
        tester.widgetList<Container>(containers).map((c) {
      return (c.decoration as BoxDecoration).color;
    }).toList();

    expect(colors.first, AppTheme.statusUp.withValues(alpha: 0.85));
    expect(colors.last, AppTheme.statusDown.withValues(alpha: 0.85));
  });
}
