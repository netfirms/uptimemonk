import 'dart:async';
import 'dart:io';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import 'api_client.dart';

typedef NotificationTapCallback = void Function(String monitorId);

/// Top-level background message handler required by Firebase Messaging
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('FCM background message received: ${message.messageId}');
}

class PushNotificationService {
  static final PushNotificationService instance = PushNotificationService._internal();
  final ApiClient _apiClient;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  NotificationTapCallback? onNotificationTap;
  GlobalKey<ScaffoldMessengerState>? scaffoldMessengerKey;

  String? _currentToken;
  bool _isInitialized = false;
  StreamSubscription<User?>? _authSubscription;

  /// The registration currently in flight, if any.
  ///
  /// `syncDeviceToken()` is called from two places at startup — the
  /// `authStateChanges` listener and directly after it in `initialize()` — and
  /// on a warm start both run. Without this guard they raced: both saw a null
  /// token, both fetched the same one, and both POSTed it, so the server
  /// created two rows for one device and every alert arrived twice. Concurrent
  /// callers now await the same future instead of starting a second round trip.
  Future<void>? _syncInFlight;

  PushNotificationService._internal({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  factory PushNotificationService() => instance;

  String? get currentToken => _currentToken;

  /// Request permissions, configure FCM handlers, and attach local notification engine
  Future<void> initialize({GlobalKey<ScaffoldMessengerState>? messengerKey}) async {
    if (messengerKey != null) {
      scaffoldMessengerKey = messengerKey;
    }

    if (_isInitialized) return;
    _isInitialized = true;

    // Set background message handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Initialize local notifications for foreground presentation
    await _initLocalNotifications();

    final messaging = FirebaseMessaging.instance;

    // Request permissions (especially required on iOS & Android 13+)
    try {
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('Push notification permission denied by user.');
      }
    } catch (e) {
      debugPrint('Error requesting push notification permission: $e');
    }

    // Configure foreground presentation options for iOS
    try {
      await messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
    } catch (e) {
      debugPrint('Error setting foreground presentation options: $e');
    }

    // Listen to token refreshes
    messaging.onTokenRefresh.listen((newToken) async {
      _currentToken = newToken;
      debugPrint('FCM token refreshed: ${newToken.substring(0, 10)}...');
      await syncDeviceToken();
    });

    // Handle messages while the app is in foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
      debugPrint('Received foreground FCM message: ${message.notification?.title} - ${message.notification?.body}');
      await _showForegroundNotification(message);
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

    // Listen to authentication state: sync token whenever user signs in
    _authSubscription = FirebaseAuth.instance.authStateChanges().listen((user) async {
      if (user != null) {
        debugPrint('Auth state changed: User is signed in. Syncing FCM device token...');
        await syncDeviceToken();
      }
    });

    // Initial attempt to fetch token (and register if already signed in)
    await syncDeviceToken();
  }

  Future<void> _initLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwinSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: darwinSettings,
    );

    await _localNotifications.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: (response) {
        final payload = response.payload;
        if (payload != null && payload.isNotEmpty) {
          onNotificationTap?.call(payload);
        }
      },
    );

    // Explicitly create high-priority notification channel for Android 8.0+
    if (Platform.isAndroid) {
      final androidPlugin = _localNotifications.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        const channel = AndroidNotificationChannel(
          AppConstants.notificationChannelId,
          AppConstants.notificationChannelName,
          description: AppConstants.notificationChannelDesc,
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
        );
        await androidPlugin.createNotificationChannel(channel);
      }
    }
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final title = message.notification?.title ?? message.data['title'] ?? 'UptimeMonke Alert';
    final body = message.notification?.body ?? message.data['body'] ?? message.data['cause'] ?? 'Service alert received';
    final monitorId = message.data['monitorId'] as String? ?? '';

    // 1. Post system tray / heads-up notification so status bar shows the alert
    try {
      const androidDetails = AndroidNotificationDetails(
        AppConstants.notificationChannelId,
        AppConstants.notificationChannelName,
        channelDescription: AppConstants.notificationChannelDesc,
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        enableVibration: true,
        icon: '@mipmap/ic_launcher',
      );

      const darwinDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      const details = NotificationDetails(
        android: androidDetails,
        iOS: darwinDetails,
      );

      await _localNotifications.show(
        id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        title: title,
        body: body,
        notificationDetails: details,
        payload: monitorId,
      );
    } catch (e) {
      debugPrint('Error showing local notification: $e');
    }

    // 2. Display in-app SnackBar banner if scaffoldMessenger is available
    if (scaffoldMessengerKey?.currentState != null) {
      final isDown = title.contains('DOWN') || message.data['event'] == 'down';
      scaffoldMessengerKey!.currentState!.showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: isDown ? AppTheme.statusDown : AppTheme.statusUp,
          duration: const Duration(seconds: 6),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 14),
              ),
              const SizedBox(height: 4),
              Text(
                body,
                style: const TextStyle(color: Colors.white, fontSize: 12),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
          action: SnackBarAction(
            label: 'DISMISS',
            textColor: Colors.white,
            onPressed: () {
              scaffoldMessengerKey!.currentState!.hideCurrentSnackBar();
            },
          ),
        ),
      );
    }
  }

  void _handleNotificationClick(RemoteMessage message) {
    final monitorId = message.data['monitorId'] as String?;
    if (monitorId != null && monitorId.isNotEmpty) {
      onNotificationTap?.call(monitorId);
    }
  }

  /// Ensure FCM token is retrieved and registered with the backend API.
  ///
  /// On iOS, `getToken()` can return null if it is called before APNs has
  /// handed the device a token — which is exactly what happens at a cold
  /// start, when this runs early in `initialize()`. The token is not lost for
  /// good, but nothing else here re-tries: `onTokenRefresh` only fires when
  /// the token *changes*, so a user already signed in at launch could go
  /// unregistered indefinitely and never receive an alert.
  ///
  /// So wait for the APNs token first, and if the FCM token is still null,
  /// retry a few times with a short backoff before giving up.
  Future<void> syncDeviceToken() {
    // Collapse concurrent callers onto one round trip. This is the client half
    // of the duplicate-push fix; the server's deterministic document id is the
    // other half, so a duplicate is prevented even if this guard is bypassed
    // by an older build still in the wild.
    return _syncInFlight ??= _syncDeviceTokenInner().whenComplete(() {
      _syncInFlight = null;
    });
  }

  Future<void> _syncDeviceTokenInner() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      debugPrint('Skipping device token sync: User is not authenticated yet.');
      return;
    }

    try {
      if (_currentToken == null) {
        if (Platform.isIOS) {
          // Waits until APNs has issued a token (or returns null on failure).
          await FirebaseMessaging.instance.getAPNSToken();
        }
        _currentToken = await _fetchFcmTokenWithRetry();
        debugPrint(
          'Retrieved FCM token: ${_currentToken != null ? "${_currentToken!.substring(0, 10)}..." : "null"}',
        );
      }

      if (_currentToken != null) {
        await _registerToken(_currentToken!);
      } else {
        debugPrint('No FCM token available yet; will retry on next sync.');
      }
    } catch (e) {
      debugPrint('Failed to sync FCM device token: $e');
    }
  }

  /// `getToken()` a few times, spaced out, for the iOS cold-start race.
  Future<String?> _fetchFcmTokenWithRetry() async {
    const attempts = 5;
    const delay = Duration(seconds: 2);
    for (var i = 0; i < attempts; i++) {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) return token;
      if (i < attempts - 1) await Future<void>.delayed(delay);
    }
    return null;
  }

  Future<void> _registerToken(String token) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      final platform = Platform.isIOS ? 'ios' : 'android';
      final deviceName = '${Platform.isIOS ? "iPhone" : "Android"} (${user.email ?? "Device"})';
      await _apiClient.registerDevice(
        token: token,
        platform: platform,
        name: deviceName,
      );
      debugPrint('Successfully registered device FCM token with backend.');
    } catch (e) {
      debugPrint('Failed to register device token with backend: $e');
    }
  }

  /// Unregister device token on user sign-out
  Future<void> unregister() async {
    if (_currentToken != null) {
      try {
        await _apiClient.unregisterDevice(_currentToken!);
        debugPrint('Successfully unregistered device token from backend.');
      } catch (e) {
        debugPrint('Error unregistering device: $e');
      }
    }
  }

  void dispose() {
    _authSubscription?.cancel();
  }
}
