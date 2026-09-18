import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../data/services/api_client.dart';

enum AuthStatus { initial, authenticated, unauthenticated, loading }

class AuthViewModel extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final ApiClient _apiClient = ApiClient();

  User? _user;
  String? _orgId;
  AuthStatus _status = AuthStatus.initial;
  String? _errorMessage;

  User? get user => _user;
  String? get orgId => _orgId;
  AuthStatus get status => _status;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _status == AuthStatus.authenticated && _orgId != null;

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
      final claimOrgId = idTokenResult.claims?['orgId'] as String?;
      if (claimOrgId != null && claimOrgId.isNotEmpty) {
        _orgId = claimOrgId;
        return;
      }

      // 2. Call bootstrap to ensure workspace exists and custom claim is issued
      _orgId = await _apiClient.bootstrap();
      await user.getIdToken(true); // Force token refresh to get claim
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

  Future<void> signOut() async {
    await _auth.signOut();
    _user = null;
    _orgId = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
