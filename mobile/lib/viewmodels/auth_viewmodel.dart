import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../core/email_verification.dart';
import '../data/services/api_client.dart';
import '../data/services/push_service.dart';

enum AuthStatus { initial, authenticated, unauthenticated, loading }

class AuthViewModel extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final ApiClient _apiClient = ApiClient();

  User? _user;
  String? _orgId;
  /// From the ID token; null until it resolves. See [_needsVerification].
  String? _signInProvider;
  AuthStatus _status = AuthStatus.initial;
  String? _errorMessage;
  bool _isGoogleLoading = false;
  bool _isGithubLoading = false;
  bool _isAppleLoading = false;

  User? get user => _user;
  String? get orgId => _orgId;
  AuthStatus get status => _status;
  String? get errorMessage => _errorMessage;
  bool get isGoogleLoading => _isGoogleLoading;
  bool get isGithubLoading => _isGithubLoading;
  bool get isAppleLoading => _isAppleLoading;
  bool get isAnyLoading =>
      _status == AuthStatus.loading || _isGoogleLoading || _isGithubLoading || _isAppleLoading;
  bool get isAuthenticated => _status == AuthStatus.authenticated && _orgId != null;

  /// Whether the signed-in account still has a confirmation link to click.
  ///
  /// Mirrors `needsEmailConfirmation` on the server and in the web client:
  /// only a password sign-up has an address to prove. A federated sign-in
  /// arrives already proven, and Firebase reports `emailVerified` false for
  /// everything except Google, so gating on that flag alone would strand
  /// GitHub and Apple users behind a link that does not exist for them.
  bool get needsEmailVerification =>
      _user != null && _needsVerification(_user!);

  bool _needsVerification(User user) => needsEmailConfirmation(
        email: user.email,
        emailVerified: user.emailVerified,
        signInProvider: _signInProvider,
        linkedProviderIds:
            user.providerData.map((p) => p.providerId).toList(growable: false),
      );

  AuthViewModel() {
    _init();
  }

  void _init() {
    _auth.authStateChanges().listen((user) async {
      _user = user;
      if (user != null) {
        await _resolveOrgId(user);
        _status = AuthStatus.authenticated;
      } else {
        _orgId = null;
        _status = AuthStatus.unauthenticated;
      }
      notifyListeners();
    });
  }

  Future<void> _resolveOrgId(User user) async {
    try {
      // 1. Check custom claim first
      final idTokenResult = await user.getIdTokenResult(true);
      _signInProvider = idTokenResult.signInProvider;

      // Nothing to bootstrap while the address is unconfirmed — the API
      // refuses the token, so calling it would only produce a 403 this code
      // would swallow, leaving the user on a dashboard where nothing loads.
      if (_needsVerification(user)) {
        _orgId = null;
        return;
      }

      final claimOrgId = idTokenResult.claims?['orgId'] as String?;
      if (claimOrgId != null && claimOrgId.isNotEmpty) {
        _orgId = claimOrgId;
        return;
      }

      // 2. Call bootstrap to ensure workspace exists and custom claim is issued
      _orgId = await _apiClient.bootstrap();
      await user.getIdToken(true); // Force token refresh to get claim

      // 3. Sync FCM push notification token with backend
      await PushNotificationService.instance.syncDeviceToken();
    } catch (e) {
      debugPrint('Error resolving orgId: $e');
      _errorMessage = e.toString();
    }
  }

  Future<bool> signIn(String email, String password) async {
    _status = AuthStatus.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      final cred = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      if (cred.user != null) {
        await _resolveOrgId(cred.user!);
        _status = AuthStatus.authenticated;
        notifyListeners();
        return true;
      }
      return false;
    } on FirebaseAuthException catch (e) {
      _errorMessage = e.message ?? 'Authentication failed';
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = e.toString();
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return false;
    }
  }

  Future<bool> signUp(String email, String password) async {
    _status = AuthStatus.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      final cred = await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      if (cred.user != null) {
        // Only a password sign-up has an address to confirm; a federated one
        // arrives already proven. Fire and forget, matching the web client: a
        // failure to send must not block an account that already exists, and
        // the address can be confirmed later.
        if (!cred.user!.emailVerified) {
          unawaited(cred.user!.sendEmailVerification().catchError((Object e) {
            debugPrint('Could not send verification email: $e');
          }));
        }
        await _resolveOrgId(cred.user!);
        _status = AuthStatus.authenticated;
        notifyListeners();
        return true;
      }
      return false;
    } on FirebaseAuthException catch (e) {
      _errorMessage = e.message ?? 'Registration failed';
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = e.toString();
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return false;
    }
  }

  Future<bool> signInWithGoogle() async {
    _isGoogleLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      const webClientId = '174268178454-cdldtbaa3enknq32qiie9qn4hrns9ibe.apps.googleusercontent.com';
      try {
        await GoogleSignIn.instance.initialize(
          serverClientId: webClientId,
        );
      } catch (initErr) {
        debugPrint('GoogleSignIn initialize note: $initErr');
      }

      final account = await GoogleSignIn.instance.authenticate();
      final authTokens = account.authentication;
      final credential = GoogleAuthProvider.credential(
        idToken: authTokens.idToken,
      );

      final cred = await _auth.signInWithCredential(credential);
      if (cred.user != null) {
        await _resolveOrgId(cred.user!);
        _status = AuthStatus.authenticated;
        _isGoogleLoading = false;
        notifyListeners();
        return true;
      }
      _isGoogleLoading = false;
      notifyListeners();
      return false;
    } on GoogleSignInException catch (e) {
      debugPrint('GoogleSignInException: ${e.code} ${e.description}');
      if (e.code == GoogleSignInExceptionCode.canceled) {
        _isGoogleLoading = false;
        notifyListeners();
        return false;
      }
      return await _signInWithGoogleProviderFallback();
    } on FirebaseAuthException catch (e) {
      if (_isCancellationError(e.code, e.message)) {
        _isGoogleLoading = false;
        notifyListeners();
        return false;
      }
      _errorMessage = e.message ?? 'Google authentication failed';
      _isGoogleLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      debugPrint('GoogleSignIn error, falling back to provider: $e');
      return await _signInWithGoogleProviderFallback();
    }
  }

  Future<bool> _signInWithGoogleProviderFallback() async {
    try {
      final googleProvider = GoogleAuthProvider();
      googleProvider.setCustomParameters({'prompt': 'select_account'});
      final cred = await _auth.signInWithProvider(googleProvider);
      if (cred.user != null) {
        await _resolveOrgId(cred.user!);
        _status = AuthStatus.authenticated;
        _isGoogleLoading = false;
        notifyListeners();
        return true;
      }
      _isGoogleLoading = false;
      notifyListeners();
      return false;
    } on FirebaseAuthException catch (e) {
      if (_isCancellationError(e.code, e.message)) {
        _isGoogleLoading = false;
        notifyListeners();
        return false;
      }
      _errorMessage = e.message ?? 'Google authentication failed';
      _isGoogleLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      if (e.toString().toLowerCase().contains('cancel')) {
        _isGoogleLoading = false;
        notifyListeners();
        return false;
      }
      _errorMessage = e.toString();
      _isGoogleLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> signInWithGithub() async {
    _isGithubLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final githubProvider = GithubAuthProvider();
      githubProvider.addScope('read:user');
      githubProvider.addScope('user:email');

      final cred = await _auth.signInWithProvider(githubProvider);
      if (cred.user != null) {
        await _resolveOrgId(cred.user!);
        _status = AuthStatus.authenticated;
        _isGithubLoading = false;
        notifyListeners();
        return true;
      }
      _isGithubLoading = false;
      notifyListeners();
      return false;
    } on FirebaseAuthException catch (e) {
      debugPrint('GitHub FirebaseAuthException: ${e.code} / ${e.message}');
      if (_isCancellationError(e.code, e.message)) {
        _isGithubLoading = false;
        notifyListeners();
        return false;
      }
      _errorMessage = e.message ?? 'GitHub authentication failed';
      _isGithubLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      debugPrint('GitHub sign-in error: $e');
      if (e.toString().toLowerCase().contains('cancel')) {
        _isGithubLoading = false;
        notifyListeners();
        return false;
      }
      _errorMessage = e.toString();
      _isGithubLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Sign in with Apple.
  ///
  /// iOS only — the button that calls this is gated on `Platform.isIOS`. On
  /// iOS the Firebase SDK drives Apple's native sheet, which needs only the
  /// `com.apple.developer.applesignin` entitlement. Android and web would
  /// instead need Apple's OAuth "code flow" (a Services ID, team ID, key ID
  /// and private key) configured on the Firebase provider, which this project
  /// does not have — so do not surface this off iOS without setting that up.
  Future<bool> signInWithApple() async {
    _isAppleLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final appleProvider = AppleAuthProvider();
      appleProvider.addScope('email');
      appleProvider.addScope('name');

      final cred = await _auth.signInWithProvider(appleProvider);
      if (cred.user != null) {
        await _resolveOrgId(cred.user!);
        _status = AuthStatus.authenticated;
        _isAppleLoading = false;
        notifyListeners();
        return true;
      }
      _isAppleLoading = false;
      notifyListeners();
      return false;
    } on FirebaseAuthException catch (e) {
      debugPrint('Apple FirebaseAuthException: ${e.code} / ${e.message}');
      if (_isCancellationError(e.code, e.message)) {
        _isAppleLoading = false;
        notifyListeners();
        return false;
      }
      _errorMessage = e.message ?? 'Apple authentication failed';
      _isAppleLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      debugPrint('Apple sign-in error: $e');
      if (e.toString().toLowerCase().contains('cancel')) {
        _isAppleLoading = false;
        notifyListeners();
        return false;
      }
      _errorMessage = e.toString();
      _isAppleLoading = false;
      notifyListeners();
      return false;
    }
  }

  bool _isCancellationError(String code, String? message) {
    final c = code.toLowerCase();
    final m = (message ?? '').toLowerCase();
    return c == 'web-context-cancelled' ||
        c == 'canceled' ||
        c == 'cancelled' ||
        c.contains('cancel') ||
        m.contains('cancel') ||
        m.contains('closed by the user');
  }

  /// Re-read the account and, if the address is now confirmed, let them in.
  ///
  /// The trap is token staleness: clicking the link updates the account on
  /// Firebase's side, but the ID token already on the device keeps saying
  /// `email_verified: false` until it is refreshed — so the app stays locked
  /// out of an account that is, in fact, verified. `reload()` followed by a
  /// forced `getIdToken(true)` is what actually clears it.
  Future<bool> checkEmailVerified() async {
    final user = _auth.currentUser;
    if (user == null) return false;

    try {
      await user.reload();
      final refreshed = _auth.currentUser;
      if (refreshed == null) return false;

      if (!refreshed.emailVerified) {
        _user = refreshed;
        notifyListeners();
        return false;
      }

      await refreshed.getIdToken(true);
      _user = refreshed;
      _errorMessage = null;
      await _resolveOrgId(refreshed);
      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Verification check failed: $e');
      return false;
    }
  }

  /// Send the confirmation email again. Returns null on success, else why not.
  Future<String?> resendVerificationEmail() async {
    final user = _auth.currentUser;
    if (user == null) return 'You are no longer signed in.';

    try {
      await user.sendEmailVerification();
      return null;
    } on FirebaseAuthException catch (e) {
      debugPrint('Resend verification failed: ${e.code} / ${e.message}');
      if (e.code == 'too-many-requests') {
        return 'Too many requests. Wait a few minutes before asking for another.';
      }
      return 'Could not send the email. Try again shortly.';
    } catch (e) {
      debugPrint('Resend verification failed: $e');
      return 'Could not send the email. Try again shortly.';
    }
  }

  Future<void> signOut() async {
    try {
      await PushNotificationService.instance.unregister();
    } catch (e) {
      debugPrint('Error unregistering push token on signout: $e');
    }
    try {
      await GoogleSignIn.instance.signOut();
    } catch (_) {}
    await _auth.signOut();
    _user = null;
    _orgId = null;
    _signInProvider = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
