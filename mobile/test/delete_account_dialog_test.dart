import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/settings/settings_screen.dart';

/// The red screen on account deletion.
///
/// `showDialog`'s future completes when the route is *popped*, not when it has
/// finished leaving: the exit transition keeps rebuilding the dialog for the
/// length of its animation. The confirmation used to be a `StatefulBuilder`
/// closing over a controller the caller disposed the moment that future
/// resolved, so those trailing rebuilds read a disposed
/// `TextEditingController` and threw from inside `build` — a red error screen
/// over the app, and an element tree left corrupt enough that the unmount
/// cascaded into `_dependents.isEmpty`, duplicate GlobalKeys, multiple heroes
/// and "dirty widget in the wrong build scope".
///
/// The pumps after each pop are the whole point. Settling immediately would
/// skip the window the bug lives in and the test would pass against the
/// broken code.
Future<bool?> _openAndPop(WidgetTester tester, {required String type}) async {
  bool? result;
  await tester.pumpWidget(
    MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () async {
                result = await showDialog<bool>(
                  context: context,
                  builder: (_) => const DeleteConfirmDialog(),
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();

  if (type.isNotEmpty) {
    await tester.enterText(find.byType(TextField), type);
    await tester.pumpAndSettle();
  }
  return result;
}

void main() {
  testWidgets('surviving its own exit animation after confirming',
      (tester) async {
    await _openAndPop(tester, type: 'DELETE');

    await tester.tap(find.text('Delete forever'));
    // One frame at a time, across the exit transition. This is where the
    // disposed controller was read.
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 20));
      expect(tester.takeException(), isNull,
          reason: 'threw while the dialog was still animating out');
    }
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('surviving its own exit animation after cancelling',
      (tester) async {
    await _openAndPop(tester, type: 'DELETE');

    await tester.tap(find.text('Cancel'));
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 20));
      expect(tester.takeException(), isNull);
    }
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('the destructive button is inert until the word is typed',
      (tester) async {
    await _openAndPop(tester, type: '');

    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNull,
        reason: 'an empty field must not arm an irreversible delete');

    await tester.enterText(find.byType(TextField), 'DELETE');
    await tester.pumpAndSettle();
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNotNull,
    );
  });

  group('confirmationMatches', () {
    test('accepts the word, however the keyboard capitalises it', () {
      expect(confirmationMatches('DELETE'), isTrue);
      expect(confirmationMatches('delete'), isTrue);
      expect(confirmationMatches('Delete'), isTrue);
    });

    test('tolerates the autospace iOS appends', () {
      expect(confirmationMatches('DELETE '), isTrue);
      expect(confirmationMatches(' delete'), isTrue);
    });

    test('refuses anything else', () {
      for (final s in ['', ' ', 'DELET', 'DELETEE', 'remove', 'DEL ETE']) {
        expect(confirmationMatches(s), isFalse, reason: 'armed on "$s"');
      }
    });
  });
}
