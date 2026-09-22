/// A monitor's current state, as mirrored into `orgStatus/{orgId}` by the
/// worker.
///
/// The field names here have to match `buildStatusDoc` in
/// `server/src/sync/mirror.ts` exactly. A key that does not match does not
/// fail — it silently parses as null, and the UI renders an em dash as though
/// the value were legitimately unknown. That is how `lastResponseTimeMs` sat
/// broken: the mirror writes `lastResponseTimeMs`, this read `responseTimeMs`,
/// and every latency in the app came back empty while looking like real
/// "not measured yet" data.
class LiveState {
  final String status; // 'up', 'down', 'pending', 'paused', 'maintenance'

  /// Named for the wire field on purpose. When the two drift the failure is
  /// invisible, so the local name is not allowed to drift either.
  final int? lastResponseTimeMs;
  final int? lastCheckedAt;
  final String? lastError;
  final double? uptime24h;
  final double? uptime30d;

  /// Written only for `ssl` monitors, and only when a certificate expiry is
  /// known — see the conditional spread in `buildStatusDoc`.
  final int? certExpiresAt;

  LiveState({
    this.status = 'pending',
    this.lastResponseTimeMs,
    this.lastCheckedAt,
    this.lastError,
    this.uptime24h,
    this.uptime30d,
    this.certExpiresAt,
  });

  factory LiveState.fromMap(Map<String, dynamic> data) {
    return LiveState(
      status: data['status'] as String? ?? 'pending',
      lastResponseTimeMs: (data['lastResponseTimeMs'] as num?)?.toInt(),
      lastCheckedAt: (data['lastCheckedAt'] as num?)?.toInt(),
      lastError: data['lastError'] as String?,
      uptime24h: (data['uptime24h'] as num?)?.toDouble(),
      uptime30d: (data['uptime30d'] as num?)?.toDouble(),
      certExpiresAt: (data['certExpiresAt'] as num?)?.toInt(),
      // `uptime7d` and `certIssuer` used to be parsed here. The mirror has
      // never written either one, so both were always null and nothing read
      // them — fields that can only ever be null are worse than absent ones,
      // because they read as features that are merely switched off.
    );
  }

  bool get isUp => status == 'up';
  bool get isDown => status == 'down';
  bool get isPaused => status == 'paused';
  bool get isPending => status == 'pending';
}
