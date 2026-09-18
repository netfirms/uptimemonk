class AppConstants {
  static const String appName = 'UptimeMonke';
  static const String apiUrl = 'https://api.uptimemonke.com';
  static const String appUrl = 'https://uptimemonke.com';

  static const Duration requestTimeout = Duration(seconds: 15);
  static const int defaultIntervalSeconds = 60;
  static const int minIntervalSeconds = 5;

  // Notification Channel Constants (Android)
  static const String notificationChannelId = 'uptime_alerts';
  static const String notificationChannelName = 'Downtime & Recovery Alerts';
  static const String notificationChannelDesc = 'High-priority notifications for service outages and restorations';
}
