import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'api_client.dart';

typedef NotificationTapCallback = void Function(String monitorId);

class PushNotificationService {
  final ApiClient _apiClient;
  NotificationTapCallback? onNotificationTap;
  String? _currentToken;

  PushNotificationService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  String? get currentToken => _currentToken;

  /// Request permissions and configure FCM handlers
  Future<void> initialize() async {
    final messaging = FirebaseMessaging.instance;

    // Request permissions (especially required on iOS & Android 13+)
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('Push notification permission denied by user.');
      return;
    }

    // Configure foreground presentation options for iOS
    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    // Fetch and register the device token
    try {
      final token = await messaging.getToken();
      if (token != null) {
        _currentToken = token;
        await _registerToken(token);
      }
    } catch (e) {
      debugPrint('Failed to get FCM device token: $e');
    }

    // Listen to token refreshes
    messaging.onTokenRefresh.listen((newToken) async {
      _currentToken = newToken;
      await _registerToken(newToken);
    });

    // Handle messages while the app is in foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('Received foreground FCM message: ${message.notification?.title}');
    });

    // Handle background notification click that brings app to foreground
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      _handleNotificationClick(message);
    });

    // Handle cold-start launch via notification tap
    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationClick(initialMessage);
    }
  }

  void _handleNotificationClick(RemoteMessage message) {
    final monitorId = message.data['monitorId'] as String?;
    if (monitorId != null && monitorId.isNotEmpty) {
      onNotificationTap?.call(monitorId);
    }
  }

  Future<void> _registerToken(String token) async {
    try {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _apiClient.registerDevice(
        token: token,
        platform: platform,
        name: '${Platform.isIOS ? "iPhone" : "Android"} Push Alert',
      );
      debugPrint('Registered device FCM token with backend.');
    } catch (e) {
      debugPrint('Failed to register device token with backend: $e');
    }
  }

  Future<void> unregister() async {
    if (_currentToken != null) {
      try {
        await _apiClient.unregisterDevice(_currentToken!);
        _currentToken = null;
      } catch (e) {
        debugPrint('Error unregistering device: $e');
      }
    }
  }
}
