class AlertContact {
  final String id;
  final String channel; // 'email', 'slack', 'discord', 'telegram', 'webhook', 'fcm'
  final String name;
  final String destination;
  final String? platform;
  final bool enabled;
  final bool verified;

  AlertContact({
    required this.id,
    required this.channel,
    required this.name,
    required this.destination,
    this.platform,
    this.enabled = true,
    this.verified = false,
  });

  factory AlertContact.fromJson(Map<String, dynamic> json) {
    return AlertContact(
      id: json['id'] as String,
      channel: json['channel'] as String? ?? 'email',
      name: json['name'] as String? ?? '',
      destination: json['destination'] as String? ?? '',
      platform: json['platform'] as String?,
      enabled: json['enabled'] != false,
      verified: json['verified'] == true,
    );
  }
}
