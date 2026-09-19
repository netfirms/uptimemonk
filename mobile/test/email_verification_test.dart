import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/email_verification.dart';

bool check({
  String? email = 'a@b.com',
  bool emailVerified = false,
  String? signInProvider,
  List<String> linked = const [],
}) =>
    needsEmailConfirmation(
      email: email,
      emailVerified: emailVerified,
      signInProvider: signInProvider,
      linkedProviderIds: linked,
    );

void main() {
  group('needsEmailConfirmation', () {
    test('a password sign-in with an unconfirmed address is gated', () {
      // The rule the gate exists for: anyone can type any address into a form.
      expect(check(signInProvider: 'password'), isTrue);
    });

    test('Google, GitHub and Apple sign-ins are let straight through', () {
      // Firebase reports emailVerified false for GitHub and Apple, so gating
      // on the flag would strand them behind a link they can never receive.
      for (final p in ['google.com', 'github.com', 'apple.com']) {
        expect(check(signInProvider: p), isFalse, reason: p);
      }
    });

    test('an Apple private relay address is not asked to confirm', () {
      // Only Apple can confirm @privaterelay.appleid.com.
      expect(
        check(
          email: 'abc123@privaterelay.appleid.com',
          signInProvider: 'apple.com',
        ),
        isFalse,
      );
    });

    test('a provider nobody enumerated is still a federated provider', () {
      expect(check(signInProvider: 'facebook.com'), isFalse);
    });

    test('a confirmed address is never gated', () {
      expect(check(emailVerified: true, signInProvider: 'password'), isFalse);
    });

    test('an account with no address at all is not gated', () {
      expect(check(email: null, signInProvider: 'password'), isFalse);
      expect(check(email: '', signInProvider: 'password'), isFalse);
    });

    group('before the token resolves', () {
      test('a password-only account is gated', () {
        expect(check(linked: ['password']), isTrue);
      });

      test('a federated account is not, so the screen never flashes past', () {
        expect(check(linked: ['github.com']), isFalse);
        expect(check(linked: ['apple.com']), isFalse);
        expect(check(linked: ['password', 'google.com']), isFalse);
      });

      test('an account with no providers yet is not gated', () {
        expect(check(linked: []), isFalse);
      });
    });

    test('the token wins over the linked providers once it is known', () {
      // Signing in with a password on an account that also has Google linked
      // must match the server, which gates on how *this session* signed in.
      expect(check(signInProvider: 'password', linked: ['password', 'google.com']), isTrue);
    });
  });
}
