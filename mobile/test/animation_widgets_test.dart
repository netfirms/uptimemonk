import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/widgets/animated_counter.dart';
import 'package:mobile/ui/widgets/stagger_in.dart';
import 'package:mobile/ui/widgets/status_dot.dart';

/// Wraps [child] in the minimum a widget needs to build, with reduce-motion
/// forced on or off so the accessibility path is actually exercised rather
/// than assumed.
Widget _host(Widget child, {bool reduceMotion = false}) {
  return MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Directionality(
      textDirection: TextDirection.ltr,
      child: Center(child: child),
    ),
  );
}

String _textOf(WidgetTester tester) =>
    tester.widget<Text>(find.byType(Text)).data!;

void main() {
  group('AnimatedCounter', () {
    testWidgets('travels to the value instead of snapping to it', (tester) async {
      await tester.pumpWidget(_host(
        AnimatedCounter(
          value: 100,
          format: (v) => v.round().toString(),
          style: const TextStyle(),
        ),
      ));

      // First frame starts at the tween's beginning, not the target.
      expect(_textOf(tester), '0');

      await tester.pump(const Duration(milliseconds: 200));
      final midway = int.parse(_textOf(tester));
      expect(midway, greaterThan(0));
      expect(midway, lessThan(100));

      await tester.pumpAndSettle();
      expect(_textOf(tester), '100');
    });

    testWidgets('arrives immediately when the platform asks for reduced motion',
        (tester) async {
      await tester.pumpWidget(_host(
        AnimatedCounter(
          value: 42,
          format: (v) => v.round().toString(),
          style: const TextStyle(),
        ),
        reduceMotion: true,
      ));

      // The number must still be correct — reduce-motion removes the travel,
      // never the information.
      await tester.pump();
      expect(_textOf(tester), '42');
    });

    testWidgets('formats intermediate frames the same way as the final one',
        (tester) async {
      await tester.pumpWidget(_host(
        AnimatedCounter(
          value: 99.98,
          format: (v) => '${v.toStringAsFixed(2)}%',
          style: const TextStyle(),
        ),
      ));

      // A half-formatted intermediate frame would visibly change the text's
      // shape as it settles.
      await tester.pump(const Duration(milliseconds: 150));
      expect(_textOf(tester), endsWith('%'));
      expect(_textOf(tester).split('.')[1].replaceAll('%', '').length, 2);

      await tester.pumpAndSettle();
      expect(_textOf(tester), '99.98%');
    });

    testWidgets('animates again when the value changes', (tester) async {
      Widget build(double v) => _host(
            AnimatedCounter(
              value: v,
              format: (x) => x.round().toString(),
              style: const TextStyle(),
            ),
          );

      await tester.pumpWidget(build(10));
      await tester.pumpAndSettle();
      expect(_textOf(tester), '10');

      await tester.pumpWidget(build(20));
      await tester.pump(const Duration(milliseconds: 100));
      // Mid-flight between the two, not already parked on the new value.
      final mid = int.parse(_textOf(tester));
      expect(mid, greaterThan(10));
      expect(mid, lessThan(20));

      await tester.pumpAndSettle();
      expect(_textOf(tester), '20');
    });
  });

  group('StaggerIn', () {
    testWidgets('fades its child in', (tester) async {
      await tester.pumpWidget(_host(
        const StaggerIn(index: 0, child: Text('row')),
      ));

      await tester.pump();
      final start = tester.widget<FadeTransition>(find.byType(FadeTransition));
      expect(start.opacity.value, lessThan(1.0));

      await tester.pumpAndSettle();
      final end = tester.widget<FadeTransition>(find.byType(FadeTransition));
      expect(end.opacity.value, 1.0);
    });

    testWidgets('a later row waits longer than the first', (tester) async {
      await tester.pumpWidget(_host(
        const Column(
          children: [
            StaggerIn(index: 0, child: Text('first')),
            StaggerIn(index: 5, child: Text('later')),
          ],
        ),
      ));

      await tester.pump(const Duration(milliseconds: 60));
      final fades = tester.widgetList<FadeTransition>(find.byType(FadeTransition)).toList();
      // The first row is already on its way while the later one has not begun.
      expect(fades.first.opacity.value, greaterThan(0.0));
      expect(fades.last.opacity.value, 0.0);

      await tester.pumpAndSettle();
      for (final f in tester.widgetList<FadeTransition>(find.byType(FadeTransition))) {
        expect(f.opacity.value, 1.0);
      }
    });

    testWidgets('caps the delay so a far-down row is not left waiting',
        (tester) async {
      // Row 500 is built only when it scrolls into view; if the delay scaled
      // with the raw index it would sit invisible for 22 seconds.
      await tester.pumpWidget(_host(
        const StaggerIn(index: 500, child: Text('far')),
      ));

      await tester.pump(const Duration(milliseconds: 45 * 6));
      await tester.pumpAndSettle();
      expect(
        tester.widget<FadeTransition>(find.byType(FadeTransition)).opacity.value,
        1.0,
      );
    });

    testWidgets('shows the child immediately under reduced motion', (tester) async {
      await tester.pumpWidget(_host(
        const StaggerIn(index: 4, child: Text('row')),
        reduceMotion: true,
      ));

      await tester.pump();
      // No transition wrapper at all, so nothing is ever partly transparent.
      expect(find.byType(FadeTransition), findsNothing);
      expect(find.text('row'), findsOneWidget);
    });

    testWidgets('cancels its pending timer when disposed', (tester) async {
      await tester.pumpWidget(_host(
        const StaggerIn(index: 6, child: Text('row')),
      ));

      // Torn down while the start timer is still pending.
      await tester.pumpWidget(_host(const SizedBox()));
      expect(find.text('row'), findsNothing);

      // The test deliberately ends here without pumping past the delay: an
      // uncancelled Timer is then still outstanding, and the framework fails
      // the test for it. Pumping far enough forward would let the timer fire
      // and be absorbed by the callback's `mounted` check, which would make
      // this pass whether or not dispose cancelled anything.
    });
  });

  group('StatusDot', () {
    testWidgets('does not animate when it is not pulsing', (tester) async {
      await tester.pumpWidget(_host(
        const StatusDot(color: Color(0xFF00FF00), pulsing: false),
      ));
      await tester.pump();

      // Nothing to settle — pumpAndSettle would time out on a live loop.
      await tester.pumpAndSettle();
      expect(find.byType(AnimatedBuilder), findsNothing);
    });

    testWidgets('pulses while live', (tester) async {
      await tester.pumpWidget(_host(
        const StatusDot(color: Color(0xFFFF0000)),
      ));
      await tester.pump();
      expect(find.byType(AnimatedBuilder), findsOneWidget);

      // A repeating controller keeps scheduling frames.
      expect(tester.binding.hasScheduledFrame, isTrue);
    });

    testWidgets('stops when the platform asks for reduced motion', (tester) async {
      await tester.pumpWidget(_host(
        const StatusDot(color: Color(0xFFFF0000)),
        reduceMotion: true,
      ));
      await tester.pump();

      // If the loop were still running this would time out rather than settle.
      await tester.pumpAndSettle();
      expect(find.byType(StatusDot), findsOneWidget);
    });

    testWidgets('stops looping when a monitor recovers', (tester) async {
      Widget build(bool pulsing) => _host(
            StatusDot(color: const Color(0xFFFF0000), pulsing: pulsing),
          );

      await tester.pumpWidget(build(true));
      await tester.pump();
      expect(tester.binding.hasScheduledFrame, isTrue);

      await tester.pumpWidget(build(false));
      // Would hang here if the controller were left repeating under the
      // now-green dot.
      await tester.pumpAndSettle();
      expect(find.byType(AnimatedBuilder), findsNothing);
    });
  });
}
