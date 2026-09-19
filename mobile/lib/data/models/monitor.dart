class MonitorConfig {
  final String id;
  final String orgId;
  final String name;
  final String type; // 'http', 'keyword', 'tcp', 'dns', 'ssl', 'icmp', 'heartbeat'
  final String target;
  final int? port;
  final String? method;
  final Map<String, String>? requestHeaders;
  final String? keyword;
  final bool? keywordInverted;
  final bool? keywordRegex;
  final String? jsonPath;
  final String? jsonPathExpected;
  final int? maxResponseTimeMs;
  final int? sslExpiryWarningDays;
  final String? sslExpectedFingerprint;
  final String? sslMinVersion;
  final List<int>? sslExpiryAlertDays;
  final String? tcpPayload;
  final String? tcpExpectedResponse;
  final String? dnsRecordType;
  final String? dnsExpectedValue;
  final String? dnsServer;
  final int? icmpPacketCount;
  final int? icmpMaxLossPercent;
  final int intervalSeconds;
  final int timeoutSeconds;
  final int confirmationThreshold;
  final bool enabled;
  final bool publicOnStatusPage;
  final bool muteAlerts;
  final List<String> alertContactIds;
  final String? heartbeatToken;
  final int? heartbeatGraceSeconds;

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
    this.keywordRegex,
    this.jsonPath,
    this.jsonPathExpected,
    this.maxResponseTimeMs,
    this.sslExpiryWarningDays,
    this.sslExpectedFingerprint,
    this.sslMinVersion,
    this.sslExpiryAlertDays,
    this.tcpPayload,
    this.tcpExpectedResponse,
    this.dnsRecordType,
    this.dnsExpectedValue,
    this.dnsServer,
    this.icmpPacketCount,
    this.icmpMaxLossPercent,
    this.intervalSeconds = 60,
    this.timeoutSeconds = 10,
    this.confirmationThreshold = 2,
    this.enabled = true,
    this.publicOnStatusPage = false,
    this.muteAlerts = false,
    this.alertContactIds = const [],
    this.heartbeatToken,
    this.heartbeatGraceSeconds,
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
      keywordRegex: data['keywordRegex'] as bool?,
      jsonPath: data['jsonPath'] as String?,
      jsonPathExpected: data['jsonPathExpected'] as String?,
      maxResponseTimeMs: (data['maxResponseTimeMs'] as num?)?.toInt(),
      sslExpiryWarningDays: (data['sslExpiryWarningDays'] as num?)?.toInt(),
      sslExpectedFingerprint: data['sslExpectedFingerprint'] as String?,
      sslMinVersion: data['sslMinVersion'] as String?,
      sslExpiryAlertDays: (data['sslExpiryAlertDays'] as List<dynamic>?)
          ?.map((e) => (e as num).toInt())
          .toList(),
      tcpPayload: data['tcpPayload'] as String?,
      tcpExpectedResponse: data['tcpExpectedResponse'] as String?,
      dnsRecordType: data['dnsRecordType'] as String?,
      dnsExpectedValue: data['dnsExpectedValue'] as String?,
      dnsServer: data['dnsServer'] as String?,
      icmpPacketCount: (data['icmpPacketCount'] as num?)?.toInt(),
      icmpMaxLossPercent: (data['icmpMaxLossPercent'] as num?)?.toInt(),
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
      heartbeatGraceSeconds: (data['heartbeatGraceSeconds'] as num?)?.toInt(),
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
      if (keywordRegex != null) 'keywordRegex': keywordRegex,
      if (jsonPath != null) 'jsonPath': jsonPath,
      if (jsonPathExpected != null) 'jsonPathExpected': jsonPathExpected,
      if (maxResponseTimeMs != null) 'maxResponseTimeMs': maxResponseTimeMs,
      if (sslExpiryWarningDays != null) 'sslExpiryWarningDays': sslExpiryWarningDays,
      if (sslExpectedFingerprint != null) 'sslExpectedFingerprint': sslExpectedFingerprint,
      if (sslMinVersion != null && sslMinVersion != 'none') 'sslMinVersion': sslMinVersion,
      if (sslExpiryAlertDays != null) 'sslExpiryAlertDays': sslExpiryAlertDays,
      if (tcpPayload != null) 'tcpPayload': tcpPayload,
      if (tcpExpectedResponse != null) 'tcpExpectedResponse': tcpExpectedResponse,
      if (dnsRecordType != null) 'dnsRecordType': dnsRecordType,
      if (dnsExpectedValue != null) 'dnsExpectedValue': dnsExpectedValue,
      if (dnsServer != null) 'dnsServer': dnsServer,
      if (icmpPacketCount != null) 'icmpPacketCount': icmpPacketCount,
      if (icmpMaxLossPercent != null) 'icmpMaxLossPercent': icmpMaxLossPercent,
      'intervalSeconds': intervalSeconds,
      'timeoutSeconds': timeoutSeconds,
      'confirmationThreshold': confirmationThreshold,
      'publicOnStatusPage': publicOnStatusPage,
      'muteAlerts': muteAlerts,
      'alertContactIds': alertContactIds,
      if (heartbeatGraceSeconds != null) 'heartbeatGraceSeconds': heartbeatGraceSeconds,
    };
  }
}
