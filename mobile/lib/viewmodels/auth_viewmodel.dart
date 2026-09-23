import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../core/analytics.dart';
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

  /// See [analyticsMethodFor] — the normalisation lives there so it can be
  /// tested without Firebase.
  String get _analyticsMethod => analyticsMethodFor(_signInProvider);
  /// True when a bootstrap or claim lookup failed, as opposed to never run.
  bool _workspaceLookupFailed = false;

  /// True from the moment a deletion is requested until sign-out completes.
  ///
  /// Deleting the account makes the next forced token refresh fail, which is
  /// indistinguishable from a broken workspace lookup — so without this the
  /// router showed the workspace-unavailable error screen on the way out, and
  /// someone who just asked to be deleted was told something went wrong.
  bool _deletingAccount = false;
  bool get deletingAccount => _deletingAccount;
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

  /// Signed in, address fine, but the workspace could not be loaded.
  ///
  /// Its own state because the alternative is dumping the user back on the
  /// login screen while they hold a valid session — which invites them to
  /// sign in again, does not say what went wrong, and repeats identically on
  /// the next launch. That reads as "permanently logged out" for what is
  /// usually a transient API failure.
  /// Exposed so the router can tell a failed lookup from one still running.
  bool get workspaceLookupFailed => _workspaceLookupFailed;

  bool get workspaceUnavailable =>
      _user != null &&
      !needsEmailVerification &&
      _orgId == null &&
      _workspaceLookupFailed;

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
        _workspaceLookupFailed = false;
        return;
      }

      final claimOrgId = idTokenResult.claims?['orgId'] as String?;
      if (claimOrgId != null && claimOrgId.isNotEmpty) {
        _orgId = claimOrgId;
        // A claim already exists, so this is a returning user. Reported here
        // rather than in each of the six sign-in methods: every one of them
        // funnels through this call, so one site cannot drift out of step
        // with another, and a new provider is measured the day it is added.
        unawaited(AnalyticsEvents.signIn(_analyticsMethod));
        unawaited(Analytics.identify(claimOrgId));
        return;
      }

      // 2. Call bootstrap to ensure workspace exists and custom claim is issued
      _orgId = await _apiClient.bootstrap();
      // No claim before this call means bootstrap just created the workspace —
      // the one moment that is genuinely a sign-up rather than a login. The
      // web client draws the same line at the same place.
      unawaited(AnalyticsEvents.signUpBootstrapped(_analyticsMethod));
      unawaited(Analytics.identify(_orgId!));
      await user.getIdToken(true); // Force token refresh to get claim

      // 3. Sync FCM push notification token with backend
      await PushNotificationService.instance.syncDeviceToken();
      _workspaceLookupFailed = false;
    } catch (e) {
      debugPrint('Error resolving orgId: $e');
      // A lookup that fails because the account is being deleted is expected,
      // not a fault to report. Leaving the flags alone keeps the router off
      // the error screen.
      if (_deletingAccount) return;
      _errorMessage = _readableApiError(e);
      // The workspace lookup failing is the single worst thing that can happen
      // to a new account — it is the 403/429 class of bug that stranded users
      // before. Worth counting rather than only logging to a console nobody
      // reads in production.
      unawaited(AnalyticsEvents.actionFailed(
        'resolve_workspace',
        e is ApiException ? e.statusCode : null,
      ));
      // Recorded rather than left implicit: `_orgId == null` alone cannot
      // tell a failure apart from a lookup that has not run, and the router
      // needs that difference to show a retry instead of a login form.
      _workspaceLookupFailed = true;
    }
  }

  /// `ApiException (503): message` -> `message`. The wrapper is for logs.
  String _readableApiError(Object e) {
    final text = e.toString();
    final m = RegExp(r'\((\d{3})\):\s*(.+)$', dotAll: true).firstMatch(text);
    return m != null ? m.group(2)!.trim() : text;
  }

  /// Try the workspace lookup again, for the retry button.
  Future<bool> retryWorkspaceLookup() async {
    final user = _auth.currentUser;
    if (user == null) return false;

    _errorMessage = null;
    notifyListeners();

    await _resolveOrgId(user);
    _status = AuthStatus.authenticated;
    notifyListeners();
    return _orgId != null;
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

  /// Email a password-reset link. Returns null on success, else why not.
  ///
  /// Deliberately reports the same success whether or not the address has an
  /// account: Firebase does not tell us either, and confirming an address is
  /// registered would turn this into an account-enumeration oracle.
  Future<String?> sendPasswordReset(String email) async {
    final trimmed = email.trim();
    if (trimmed.isEmpty || !trimmed.contains('@')) {
      return 'Enter your email above first, then tap Forgot password.';
    }

    try {
      await _auth.sendPasswordResetEmail(email: trimmed);
      return null;
    } on FirebaseAuthException catch (e) {
      debugPrint('Password reset failed: ${e.code} / ${e.message}');
      if (e.code == 'too-many-requests') {
        return 'Too many requests. Wait a few minutes before trying again.';
      }
      if (e.code == 'invalid-email') {
        return 'That email address looks invalid.';
      }
      return 'Could not send the reset email. Try again shortly.';
    } catch (e) {
      debugPrint('Password reset failed: $e');
      return 'Could not send the reset email. Try again shortly.';
    }
  }

  /// Delete this account and everything in it, then sign out.
  ///
  /// Owned here rather than by the settings screen because the deletion and
  /// the auth state have to move together: the account disappears server-side
  /// before the client session does, and every listener in between sees an
  /// identity that no longer resolves.
  ///
  /// Signs out only on success. A failed deletion must leave the session
  /// intact, or the user is thrown to the login screen with their account
  /// still there and no idea which of the two happened.
  Future<void> deleteAccount() async {
    _deletingAccount = true;
    notifyListeners();
    try {
      await _apiClient.deleteAccount();
    } catch (e) {
      _deletingAccount = false;
      notifyListeners();
      rethrow;
    }
    // From here the account is gone, so sign-out failures are noise: the
    // session is already worthless.
    try {
      await signOut();
    } catch (e) {
      debugPrint('Sign-out after account deletion: $e');
      _user = null;
      _orgId = null;
      _status = AuthStatus.unauthenticated;
    }
    _deletingAccount = false;
    notifyListeners();
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
    // Otherwise the next account signed in on this device inherits the
    // previous one's org_id until its own lookup completes, attributing that
    // window of events to the wrong workspace.
    unawaited(Analytics.resetIdentity());
    _user = null;
    _orgId = null;
    _signInProvider = null;
    _workspaceLookupFailed = false;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
