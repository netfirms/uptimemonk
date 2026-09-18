class MonitorConfig {
  final String id;
  final String orgId;
  final String name;
  final String type; // 'http', 'keyword', 'tcp', 'dns', 'ssl', 'heartbeat'
  final String target;
  final int? port;
  final String? method;
  final Map<String, String>? requestHeaders;
  final String? keyword;
  final bool? keywordInverted;
  final String? dnsRecordType;
  final String? dnsExpectedValue;
  final int intervalSeconds;
  final int timeoutSeconds;
  final int confirmationThreshold;
  final bool enabled;
  final bool publicOnStatusPage;
  final bool muteAlerts;
  final List<String> alertContactIds;
  final String? heartbeatToken;

  MonitorConfig({
    required this.id,
    required this.orgId,
    required this.name,
    required this.type,
    required this.target,
    this.port,
    this.method,
    this.requestHeaders,
    this.keyword,
    this.keywordInverted,
    this.dnsRecordType,
    this.dnsExpectedValue,
    this.intervalSeconds = 60,
    this.timeoutSeconds = 10,
    this.confirmationThreshold = 2,
    this.enabled = true,
    this.publicOnStatusPage = false,
    this.muteAlerts = false,
    this.alertContactIds = const [],
    this.heartbeatToken,
  });

  factory MonitorConfig.fromFirestore(String id, Map<String, dynamic> data) {
    return MonitorConfig(
      id: id,
      orgId: data['orgId'] as String? ?? '',
      name: data['name'] as String? ?? 'Untitled',
      type: data['type'] as String? ?? 'http',
      target: data['target'] as String? ?? '',
      port: (data['port'] as num?)?.toInt(),
      method: data['method'] as String?,
      requestHeaders: (data['requestHeaders'] as Map<String, dynamic>?)?.map(
        (k, v) => MapEntry(k, v.toString()),
      ),
      keyword: data['keyword'] as String?,
      keywordInverted: data['keywordInverted'] as bool?,
      dnsRecordType: data['dnsRecordType'] as String?,
      dnsExpectedValue: data['dnsExpectedValue'] as String?,
      intervalSeconds: (data['intervalSeconds'] as num?)?.toInt() ?? 60,
      timeoutSeconds: (data['timeoutSeconds'] as num?)?.toInt() ?? 10,
      confirmationThreshold: (data['confirmationThreshold'] as num?)?.toInt() ?? 2,
      enabled: data['enabled'] != false,
      publicOnStatusPage: data['publicOnStatusPage'] == true,
      muteAlerts: data['muteAlerts'] == true,
      alertContactIds: (data['alertContactIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      heartbeatToken: data['heartbeatToken'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'type': type,
      'target': target,
      if (port != null) 'port': port,
      if (method != null) 'method': method,
      if (keyword != null) 'keyword': keyword,
      if (keywordInverted != null) 'keywordInverted': keywordInverted,
      if (dnsRecordType != null) 'dnsRecordType': dnsRecordType,
      if (dnsExpectedValue != null) 'dnsExpectedValue': dnsExpectedValue,
      'intervalSeconds': intervalSeconds,
      'timeoutSeconds': timeoutSeconds,
      'confirmationThreshold': confirmationThreshold,
      'publicOnStatusPage': publicOnStatusPage,
      'muteAlerts': muteAlerts,
      'alertContactIds': alertContactIds,
    };
  }
}
