class Bucket {
  final int t;
  final int up;
  final int down;
  final double avgMs;
  final double uptimeRatio;

  Bucket({
    required this.t,
    required this.up,
    required this.down,
    required this.avgMs,
    required this.uptimeRatio,
  });

  factory Bucket.fromJson(Map<String, dynamic> json) {
    return Bucket(
      t: (json['t'] as num).toInt(),
      up: (json['up'] as num?)?.toInt() ?? 0,
      down: (json['down'] as num?)?.toInt() ?? 0,
      avgMs: (json['avgMs'] as num?)?.toDouble() ?? 0.0,
      uptimeRatio: (json['uptimeRatio'] as num?)?.toDouble() ?? 1.0,
    );
  }
}

class HistoryPoint {
  final int t;
  final double ms;
  final bool ok;
  final int? code;

  HistoryPoint({
    required this.t,
    required this.ms,
    required this.ok,
    this.code,
  });

  factory HistoryPoint.fromJson(Map<String, dynamic> json) {
    return HistoryPoint(
      t: (json['t'] as num).toInt(),
      ms: (json['ms'] as num).toDouble(),
      ok: json['ok'] == true,
      code: (json['code'] as num?)?.toInt(),
    );
  }
}

class HistoryIncident {
  final String id;
  final int startedAt;
  final int? resolvedAt;
  final int? durationSeconds;
  final String cause;
  final String status;

  HistoryIncident({
    required this.id,
    required this.startedAt,
    this.resolvedAt,
    this.durationSeconds,
    required this.cause,
    required this.status,
  });

  factory HistoryIncident.fromJson(Map<String, dynamic> json) {
    return HistoryIncident(
      id: json['id'] as String,
      startedAt: (json['startedAt'] as num).toInt(),
      resolvedAt: (json['resolvedAt'] as num?)?.toInt(),
      durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
      cause: json['cause'] as String? ?? 'Unknown error',
      status: json['status'] as String? ?? 'open',
    );
  }

  bool get isResolved => status == 'resolved';
}

class MonitorHistory {
  final String range;
  final String granularity;
  final List<Bucket> buckets;
  final List<HistoryPoint> points;
  final List<HistoryIncident> incidents;
  final Map<String, dynamic> summary;

  MonitorHistory({
    required this.range,
    required this.granularity,
    required this.buckets,
    required this.points,
    required this.incidents,
    required this.summary,
  });

  factory MonitorHistory.fromJson(Map<String, dynamic> json) {
    return MonitorHistory(
      range: json['range'] as String? ?? '24h',
      granularity: json['granularity'] as String? ?? 'hour',
      buckets: (json['buckets'] as List<dynamic>?)
              ?.map((b) => Bucket.fromJson(b as Map<String, dynamic>))
              .toList() ??
          [],
      points: (json['points'] as List<dynamic>?)
              ?.map((p) => HistoryPoint.fromJson(p as Map<String, dynamic>))
              .toList() ??
          [],
      incidents: (json['incidents'] as List<dynamic>?)
              ?.map((i) => HistoryIncident.fromJson(i as Map<String, dynamic>))
              .toList() ??
          [],
      summary: json['summary'] as Map<String, dynamic>? ?? {},
    );
  }
}
