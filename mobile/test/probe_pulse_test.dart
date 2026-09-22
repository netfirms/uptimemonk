import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/widgets/probe_pulse.dart';

Widget host(Widget child, {bool reduceMotion = false}) => MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: reduceMotion),
        child: Scaffold(body: Center(child: child)),
      ),
    );

void main() {
  group('ProbePulse', () {
    testWidgets('animates — the painter is repainting over time', (tester) async {
      await tester.pumpWidget(host(const ProbePulse()));

      CustomPaint findPaint() => tester.widget<CustomPaint>(
            find.descendant(
              of: find.byType(ProbePulse),
              matching: find.byType(CustomPaint),
            ).first,
          );

      final first = findPaint().painter!;
      await tester.pump(const Duration(milliseconds: 600));
      final later = findPaint().painter!;

      // shouldRepaint compares progress, so a true answer means the
      // controller actually advanced rather than sitting at frame zero.
      expect(later.shouldRepaint(first), isTrue);
    });

    testWidgets('stops when the platform asks for reduced motion', (tester) async {
      // A looping pulse is exactly what that OS switch exists to stop.
      await tester.pumpWidget(host(const ProbePulse(), reduceMotion: true));
      expect(
        find.descendant(
          of: find.byType(ProbePulse),
          matching: find.byType(CustomPaint),
        ),
        findsNothing,
        reason: 'no painter at all, so nothing can animate',
      );
    });

    testWidgets('a fast load never shows a message', (tester) async {
      await tester.pumpWidget(host(
        const ProbePulse(messages: ['Reaching the edge probes…']),
      ));
      await tester.pump(const Duration(milliseconds: 400));

      final opacity = tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity));
      expect(opacity.opacity, 0, reason: 'quiet until the wait is worth explaining');
    });

    testWidgets('a slow load explains itself', (tester) async {
      await tester.pumpWidget(host(
        const ProbePulse(messages: ['Reaching the edge probes…']),
      ));
      await tester.pump(const Duration(milliseconds: 1700));
      await tester.pump(const Duration(milliseconds: 100));

      final opacity = tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity));
      expect(opacity.opacity, 1);
      expect(find.text('Reaching the edge probes…'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('disposes without leaving a ticker running', (tester) async {
      await tester.pumpWidget(host(const ProbePulse()));
      await tester.pump(const Duration(milliseconds: 300));
      // A repeating controller not disposed fails the test binding here.
      await tester.pumpWidget(host(const SizedBox()));
      expect(find.byType(ProbePulse), findsNothing);
    });
  });
}
