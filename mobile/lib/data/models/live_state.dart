class LiveState {
  final String status; // 'up', 'down', 'pending', 'paused', 'maintenance'
  final int? responseTimeMs;
  final int? lastCheckedAt;
  final String? lastError;
  final double? uptime24h;
  final double? uptime7d;
  final double? uptime30d;
  final int? certExpiresAt;
  final String? certIssuer;

  LiveState({
    this.status = 'pending',
    this.responseTimeMs,
    this.lastCheckedAt,
    this.lastError,
    this.uptime24h,
    this.uptime7d,
    this.uptime30d,
    this.certExpiresAt,
    this.certIssuer,
  });

  factory LiveState.fromMap(Map<String, dynamic> data) {
    return LiveState(
      status: data['status'] as String? ?? 'pending',
      responseTimeMs: (data['responseTimeMs'] as num?)?.toInt(),
      lastCheckedAt: (data['lastCheckedAt'] as num?)?.toInt(),
      lastError: data['lastError'] as String?,
      uptime24h: (data['uptime24h'] as num?)?.toDouble(),
      uptime7d: (data['uptime7d'] as num?)?.toDouble(),
      uptime30d: (data['uptime30d'] as num?)?.toDouble(),
      certExpiresAt: (data['certExpiresAt'] as num?)?.toInt(),
      certIssuer: data['certIssuer'] as String?,
    );
  }

  bool get isUp => status == 'up';
  bool get isDown => status == 'down';
  bool get isPaused => status == 'paused';
  bool get isPending => status == 'pending';
}
