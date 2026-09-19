import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/history.dart';
import 'package:mobile/ui/monitor_detail/widgets/status_bars_chart.dart';
import 'package:mobile/core/theme.dart';

// The detail-screen status chart is the primary "was this up?" answer across a
// range, so its colour rules and range selector are worth pinning: green when a
// bucket lost nothing, red when it lost everything, amber when mixed, and a
// neutral stub — never red — for a bucket with no checks at all.

Bucket _b({required int t, int up = 0, int down = 0, double? ratio}) => Bucket(
      t: t,
      up: up,
      down: down,
      avgMs: 100,
      uptimeRatio: ratio ?? (up + down == 0 ? 1.0 : up / (up + down)),
    );

MonitorHistory _history(List<Bucket> buckets, {String range = '24h'}) =>
    MonitorHistory(
      range: range,
      granularity: range == '30d' || range == '90d' ? 'day' : 'hour',
      buckets: buckets,
      points: const [],
      incidents: const [],
      summary: const {},
    );

Widget _wrap(Widget child) => MaterialApp(
      home: Scaffold(
        backgroundColor: AppTheme.bgDark,
        body: SingleChildScrollView(child: child),
      ),
    );

List<Color> _barColors(WidgetTester tester) {
  // Bars are Containers inside the private _Bars row; the legend dots are the
  // other Containers. Bars sit above the legend in the tree, and legend dots
  // are 8x8 — filter to the bars by taking Containers whose size is wider than
  // tall (the bars) is fragile, so instead find by the Tooltip each bar carries.
  final tooltips = find.byType(Tooltip);
  final colors = <Color>[];
  for (final element in tester.elementList(tooltips)) {
    final container = find.descendant(
      of: find.byElementPredicate((e) => e == element),
      matching: find.byType(Container),
    );
    final widgets = tester.widgetList<Container>(container).toList();
    if (widgets.isEmpty) continue;
    final deco = widgets.first.decoration as BoxDecoration?;
    if (deco?.color != null) colors.add(deco!.color!);
  }
  return colors;
}

void main() {
  testWidgets('renders the range selector with the active range highlighted',
      (tester) async {
    String selected = '24h';
    await tester.pumpWidget(_wrap(StatefulBuilder(
      builder: (ctx, setState) => StatusBarsChart(
        history: _history([_b(t: 0, up: 60)]),
        activeRange: selected,
        onRangeSelected: (r) => setState(() => selected = r),
      ),
    )));
    await tester.pump();

    for (final r in ['24h', '7d', '30d', '90d']) {
      expect(find.text(r), findsOneWidget);
    }

    // Tapping a range notifies the callback.
    await tester.tap(find.text('90d'));
    await tester.pump();
    expect(selected, '90d');
  });

  testWidgets('empty history shows a message, not an empty chart',
      (tester) async {
    await tester.pumpWidget(_wrap(StatusBarsChart(
      history: _history([]),
      activeRange: '24h',
      onRangeSelected: (_) {},
    )));
    await tester.pump();

    expect(find.text('No history for this range yet'), findsOneWidget);
  });

  testWidgets('colours buckets by outcome: up green, down red, mixed amber',
      (tester) async {
    await tester.pumpWidget(_wrap(StatusBarsChart(
      history: _history([
        _b(t: 0, up: 60),
        _b(t: 3600, down: 60),
        _b(t: 7200, up: 30, down: 30, ratio: 0.5),
      ]),
      activeRange: '24h',
      onRangeSelected: (_) {},
    )));
    await tester.pump();

    final colors = _barColors(tester);
    expect(colors.length, 3);
    expect(colors[0], AppTheme.statusUp.withValues(alpha: 0.9));
    expect(colors[1], AppTheme.statusDown.withValues(alpha: 0.9));
    expect(colors[2], AppTheme.statusPending.withValues(alpha: 0.9));
  });

  testWidgets('a bucket with no checks is a neutral gap, not an outage',
      (tester) async {
    await tester.pumpWidget(_wrap(StatusBarsChart(
      history: _history([_b(t: 0)]),
      activeRange: '24h',
      onRangeSelected: (_) {},
    )));
    await tester.pump();

    expect(_barColors(tester).single, AppTheme.borderLight.withValues(alpha: 0.9));
  });

  testWidgets('legend counts each bucket class', (tester) async {
    await tester.pumpWidget(_wrap(StatusBarsChart(
      history: _history([
        _b(t: 0, up: 60),
        _b(t: 3600, up: 60),
        _b(t: 7200, down: 60),
        _b(t: 10800, up: 30, down: 30, ratio: 0.5),
        _b(t: 14400),
      ]),
      activeRange: '24h',
      onRangeSelected: (_) {},
    )));
    await tester.pump();

    expect(find.text('Up 2'), findsOneWidget);
    expect(find.text('Down 1'), findsOneWidget);
    expect(find.text('Degraded 1'), findsOneWidget);
    expect(find.text('No data 1'), findsOneWidget);
  });

  testWidgets('handles a 7d range of 168 hourly buckets without overflow',
      (tester) async {
    await tester.pumpWidget(_wrap(StatusBarsChart(
      history: _history(
        [for (var i = 0; i < 168; i++) _b(t: i * 3600000, up: 60)],
        range: '7d',
      ),
      activeRange: '7d',
      onRangeSelected: (_) {},
    )));
    await tester.pump();

    expect(tester.takeException(), isNull);
  });
}
