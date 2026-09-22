import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme.dart';
import 'package:mobile/ui/widgets/glass_panel.dart';
import 'package:mobile/ui/widgets/grid_floor.dart';

Widget _host(Widget child, {bool reduceMotion = false}) {
  return MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Directionality(
      textDirection: TextDirection.ltr,
      child: Center(child: child),
    ),
  );
}

void main() {
  group('AppTheme', () {
    test('matches the web client token for token', () {
      // These are the values in web/src/app/globals.css. If one side is
      // retuned without the other the two products drift apart, and the drift
      // is invisible until someone puts them side by side.
      expect(AppTheme.primary, const Color(0xFF6FC3DF)); // --primary
      expect(AppTheme.accent, const Color(0xFFFF9D2E)); // --accent
      expect(AppTheme.bgDark, const Color(0xFF070B10)); // --bg
      expect(AppTheme.bgSurface, const Color(0xFF0D141C)); // --surface
      expect(AppTheme.borderDark, const Color(0xFF16323F)); // --border
      expect(AppTheme.textPrimary, const Color(0xFFE8F6FC)); // --text
      expect(AppTheme.textSecondary, const Color(0xFF93A7B4)); // --text-muted
      expect(AppTheme.textMuted, const Color(0xFF7D909E)); // --text-dim
    });

    test('status colours keep their conventional meanings', () {
      // Up takes the programs' cyan, but down stays red. Orange reads as
      // "warning" to anyone who has seen a dashboard, and this is a
      // monitoring product — being truer to the film here would be worse at
      // the job the colour is doing.
      expect(AppTheme.statusUp, AppTheme.primary);
      expect(AppTheme.statusDown, const Color(0xFFFF4747));
      expect(AppTheme.statusMaintenance, const Color(0xFFFFD166));
      expect(AppTheme.statusDown, isNot(AppTheme.accent));
    });

    test('no green survives anywhere in the palette', () {
      // A green channel that dominates both others is the old brand colour.
      final colours = <Color>[
        AppTheme.primary,
        AppTheme.accentDeep,
        AppTheme.statusUp,
        AppTheme.latencyFast,
      ];
      for (final c in colours) {
        final r = (c.r * 255).round();
        final g = (c.g * 255).round();
        final b = (c.b * 255).round();
        expect(g > r && g > b + 40, isFalse,
            reason: 'green-dominant colour left in the palette: $c');
      }
    });
  });

  group('GlassPanel', () {
    testWidgets('blurs its backdrop by default', (tester) async {
      await tester.pumpWidget(_host(
        const GlassPanel(child: SizedBox(width: 100, height: 60)),
      ));
      expect(find.byType(BackdropFilter), findsOneWidget);
    });

    testWidgets('drops the blur when asked', (tester) async {
      // The escape hatch that makes this usable in a long list: the blur is
      // the expensive part and is invisible behind opaque rows anyway.
      await tester.pumpWidget(_host(
        const GlassPanel(blurEnabled: false, child: SizedBox(width: 100, height: 60)),
      ));
      expect(find.byType(BackdropFilter), findsNothing);
      // The pane itself is still drawn.
      expect(find.byType(GlassPanel), findsOneWidget);
    });

    testWidgets('passes taps through to its child', (tester) async {
      // The pane stacks a full-size blurred layer under the content and a lit
      // strip over it. Either could absorb input if it were introduced
      // carelessly, and a decorative surface that eats taps is the kind of
      // bug that only shows up on a device.
      //
      // Note the highlight itself is not the hazard: it is 1px tall and sits
      // on the border, above where the child begins, so it cannot cover the
      // child at all. The IgnorePointer on it is cheap insurance rather than
      // a fix for something this test can demonstrate.
      var taps = 0;
      await tester.pumpWidget(_host(
        GlassPanel(
          child: GestureDetector(
            // Opaque, not the default deferToChild: a childless SizedBox does
            // not paint and so is not hit-testable, which would make this
            // test fail everywhere and prove nothing.
            behavior: HitTestBehavior.opaque,
            onTap: () => taps++,
            child: const SizedBox(width: 200, height: 80),
          ),
        ),
      ));

      final box = tester.getRect(find.byType(GestureDetector));
      await tester.tapAt(box.center);
      await tester.pump();
      expect(taps, 1);

      // Just inside the child's top edge, the closest the highlight gets.
      await tester.tapAt(Offset(box.center.dx, box.top + 1));
      await tester.pump();
      expect(taps, 2);
    });

    testWidgets('renders in the accent hue when asked', (tester) async {
      await tester.pumpWidget(_host(
        const GlassPanel(accent: true, child: SizedBox(width: 80, height: 40)),
      ));
      expect(find.byType(GlassPanel), findsOneWidget);
    });
  });

  group('GridFloor', () {
    testWidgets('paints and animates', (tester) async {
      await tester.pumpWidget(_host(const GridFloor(height: 200)));
      await tester.pump();
      expect(find.byType(CustomPaint), findsWidgets);
      // A repeating controller keeps asking for frames.
      expect(tester.binding.hasScheduledFrame, isTrue);
    });

    testWidgets('stops when the platform asks for reduced motion', (tester) async {
      await tester.pumpWidget(_host(
        const GridFloor(height: 200),
        reduceMotion: true,
      ));
      await tester.pump();
      // Would time out rather than settle if the loop were still running.
      await tester.pumpAndSettle();
      expect(find.byType(GridFloor), findsOneWidget);
    });

    testWidgets('stops when animation is switched off', (tester) async {
      await tester.pumpWidget(_host(const GridFloor(height: 200, animate: false)));
      await tester.pump();
      await tester.pumpAndSettle();
      expect(find.byType(GridFloor), findsOneWidget);
    });

    testWidgets('is decorative: excluded from semantics and never hit-tested',
        (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_host(const GridFloor(height: 200)));
      await tester.pump();

      expect(find.byType(ExcludeSemantics), findsOneWidget);
      expect(find.byType(IgnorePointer), findsOneWidget);
      handle.dispose();
    });

    testWidgets('disposes without leaving a ticker running', (tester) async {
      await tester.pumpWidget(_host(const GridFloor(height: 200)));
      await tester.pump();
      await tester.pumpWidget(_host(const SizedBox()));
      expect(find.byType(GridFloor), findsNothing);
    });
  });

  group('GridBackdrop', () {
    testWidgets('puts the grid behind its child', (tester) async {
      await tester.pumpWidget(_host(
        const GridBackdrop(child: Text('content')),
      ));
      await tester.pump();
      expect(find.text('content'), findsOneWidget);
      expect(find.byType(GridFloor), findsOneWidget);

      // The child paints after the grid, so it is on top.
      final stack = tester.widget<Stack>(find.byType(Stack).first);
      expect(stack.children.last, isA<Text>());
    });
  });
}
