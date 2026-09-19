import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme.dart';
import '../../../data/models/monitor.dart';
import '../../../data/models/live_state.dart';
import '../../../data/models/history.dart';
import '../../../main.dart';
import 'hourly_bars.dart';

class MonitorCard extends StatefulWidget {
  final MonitorConfig config;
  final LiveState live;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onTogglePause;
  final VoidCallback onDelete;

  /// Recent hourly history for this monitor, or null while it is still being
  /// fetched. When absent the card simply omits the sparkline rather than
  /// showing a misleading empty chart.
  final MonitorHistory? history;

  const MonitorCard({
    super.key,
    required this.config,
    required this.live,
    required this.onTap,
    required this.onEdit,
    required this.onTogglePause,
    required this.onDelete,
    this.history,
  });

  @override
  State<MonitorCard> createState() => _MonitorCardState();
}

class _MonitorCardState extends State<MonitorCard> with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;
  bool _copied = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.6).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  String _sinceLabel(int? at) {
    if (at == null || at == 0) return 'Never checked';
    final secs = ((DateTime.now().millisecondsSinceEpoch - at) / 1000).round();
    if (secs < 60) return '${secs < 0 ? 0 : secs}s ago';
    if (secs < 3600) return '${(secs / 60).round()}m ago';
    if (secs < 86400) return '${(secs / 3600).round()}h ago';
    return '${(secs / 86400).round()}d ago';
  }

  String _formatInterval(int? seconds) {
    if (seconds == null) return '5 min';
    if (seconds >= 3600) return '${(seconds / 3600).round()} hr';
    if (seconds >= 60) return '${(seconds / 60).round()} min';
    return '${seconds}s';
  }

  IconData _protocolIcon(String type) {
    switch (type.toLowerCase()) {
      case 'http':
        return Icons.language_rounded;
      case 'ssl':
        return Icons.verified_user_rounded;
      case 'keyword':
        return Icons.manage_search_rounded;
      case 'icmp':
      case 'ping':
        return Icons.query_stats_rounded;
      case 'tcp':
      case 'port':
        return Icons.router_rounded;
      case 'dns':
        return Icons.alt_route_rounded;
      case 'heartbeat':
      case 'cron':
        return Icons.favorite_rounded;
      default:
        return Icons.dns_rounded;
    }
  }

  Color _protocolColor(String type) {
    switch (type.toLowerCase()) {
      case 'http':
        return AppTheme.primaryGreen;
      case 'ssl':
        return const Color(0xFF38BDF8);
      case 'keyword':
        return const Color(0xFFA78BFA);
      case 'icmp':
      case 'ping':
        return const Color(0xFFFBBF24);
      case 'tcp':
      case 'port':
        return const Color(0xFF34D399);
      case 'dns':
        return const Color(0xFF818CF8);
      case 'heartbeat':
      case 'cron':
        return const Color(0xFFEC4899);
      default:
        return AppTheme.primaryGreen;
    }
  }

  void _copyHeartbeatUrl(String token) {
    final url = 'https://api.uptimemonke.com/heartbeat/$token';
    Clipboard.setData(ClipboardData(text: url));
    setState(() => _copied = true);
    rootScaffoldMessengerKey.currentState?.showSnackBar(
      const SnackBar(
        content: Text('Heartbeat ingest URL copied to clipboard'),
        duration: Duration(seconds: 2),
      ),
    );
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isPaused = !widget.config.enabled;
    final status = isPaused ? 'paused' : widget.live.status.toLowerCase();
    final isUp = status == 'up';
    final isDown = status == 'down';

    Color statusColor;
    Color statusBg;
    Color statusBorder;

    if (isUp) {
      statusColor = AppTheme.primaryGreen;
      statusBg = AppTheme.primaryGreen.withValues(alpha: 0.15);
      statusBorder = AppTheme.primaryGreen.withValues(alpha: 0.35);
    } else if (isDown) {
      statusColor = AppTheme.statusDown;
      statusBg = AppTheme.statusDown.withValues(alpha: 0.15);
      statusBorder = AppTheme.statusDown.withValues(alpha: 0.35);
    } else if (isPaused) {
      statusColor = AppTheme.statusPaused;
      statusBg = AppTheme.statusPaused.withValues(alpha: 0.12);
      statusBorder = AppTheme.statusPaused.withValues(alpha: 0.25);
    } else {
      statusColor = AppTheme.statusPending;
      statusBg = AppTheme.statusPending.withValues(alpha: 0.15);
      statusBorder = AppTheme.statusPending.withValues(alpha: 0.3);
    }

    final latency = widget.live.responseTimeMs;
    Color latencyColor;
    if (latency == null) {
      latencyColor = AppTheme.textMuted;
    } else if (latency < 250) {
      latencyColor = AppTheme.latencyFast;
    } else if (latency < 600) {
      latencyColor = AppTheme.latencyMed;
    } else {
      latencyColor = AppTheme.latencySlow;
    }

    final protoColor = _protocolColor(widget.config.type);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      decoration: BoxDecoration(
        color: AppTheme.bgSurfaceCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDown
              ? AppTheme.statusDown.withValues(alpha: 0.5)
              : AppTheme.borderDark,
          width: 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Status Pill, Protocol Icon, and Action Icons.
                // The monitor name deliberately sits on its own line below
                // (see the next Row) rather than competing for width here —
                // sharing this row squeezed a normal 20-character name down to
                // a few pixels and ellipsized it.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // 1. Status Pill (Web style with pulsing glow ring)
                    Flexible(
                      child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: statusBorder, width: 1),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 10,
                            height: 10,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                if (isUp || isDown)
                                  AnimatedBuilder(
                                    animation: _pulseAnimation,
                                    builder: (ctx, child) {
                                      return Transform.scale(
                                        scale: _pulseAnimation.value,
                                        child: Container(
                                          width: 8,
                                          height: 8,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: statusColor.withValues(
                                              alpha: (1.6 - _pulseAnimation.value).clamp(0.0, 0.5),
                                            ),
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    color: statusColor,
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: statusColor.withValues(alpha: 0.6),
                                        blurRadius: 4,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 5),
                          Flexible(
                            child: Text(
                              status.toUpperCase(),
                              style: TextStyle(
                                color: statusColor,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.4,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              softWrap: false,
                            ),
                          ),
                        ],
                      ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // 2. Protocol Icon Badge
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: protoColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: protoColor.withValues(alpha: 0.25)),
                      ),
                      child: Center(
                        child: Icon(
                          _protocolIcon(widget.config.type),
                          size: 15,
                          color: protoColor,
                        ),
                      ),
                    ),
                    // 3. Spacer pushes the action buttons to the far right.
                    const Spacer(),

                    // 4. Action Buttons (Edit, Pause/Resume, Delete)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _actionIcon(
                          icon: Icons.edit_outlined,
                          color: AppTheme.textMuted,
                          tooltip: 'Edit Monitor',
                          onPressed: widget.onEdit,
                        ),
                        _actionIcon(
                          icon: isPaused
                              ? Icons.play_arrow_rounded
                              : Icons.pause_rounded,
                          color: isPaused
                              ? AppTheme.primaryGreen
                              : AppTheme.textMuted,
                          tooltip: isPaused ? 'Resume' : 'Pause',
                          onPressed: widget.onTogglePause,
                        ),
                        _actionIcon(
                          icon: Icons.delete_outline_rounded,
                          color: AppTheme.statusDown.withValues(alpha: 0.75),
                          tooltip: 'Delete Monitor',
                          onPressed: widget.onDelete,
                        ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // Monitor Name — full card width, so ordinary names are never
                // truncated. Two lines is enough for anything long; beyond
                // that it ellipsizes rather than pushing the card taller.
                Text(
                  widget.config.name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                    letterSpacing: -0.2,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),

                // Last 12 hours at a glance. Hidden while paused: a paused
                // monitor has no fresh bars, and an empty sparkline would read
                // as an outage rather than a deliberate stop.
                if (!isPaused && widget.history != null) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Text(
                        'Last 12h',
                        style: TextStyle(
                          color: AppTheme.textDim,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: HourlyBars(
                          buckets: widget.history!.buckets,
                          hours: 12,
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 8),

                // Middle Row: Tags (Protocol, Interval, Public, Cert Expiry, Muted)
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _buildTag(
                      widget.config.type.toUpperCase(),
                      protoColor,
                      protoColor.withValues(alpha: 0.12),
                    ),
                    _buildTag(
                      _formatInterval(widget.config.intervalSeconds),
                      AppTheme.textSecondary,
                      Colors.white.withValues(alpha: 0.05),
                    ),
                    if (widget.config.publicOnStatusPage)
                      _buildTag(
                        'Public',
                        AppTheme.accentCyan,
                        AppTheme.accentCyan.withValues(alpha: 0.12),
                      ),
                    if (widget.config.muteAlerts)
                      _buildTag(
                        'Muted',
                        AppTheme.textMuted,
                        Colors.white.withValues(alpha: 0.05),
                      ),
                    if (widget.live.certExpiresAt != null) ...[
                      _buildCertTag(widget.live.certExpiresAt!),
                    ],
                  ],
                ),

                const SizedBox(height: 8),

                // Target URL or Heartbeat Token & Copy Button
                if (widget.config.type == 'heartbeat' && widget.config.heartbeatToken != null)
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.04),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '.../heartbeat/${widget.config.heartbeatToken!.substring(0, 10.clamp(0, widget.config.heartbeatToken!.length))}…',
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 11.5,
                              color: AppTheme.textMuted,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      SizedBox(
                        height: 24,
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            backgroundColor: _copied
                                ? AppTheme.primaryGreen.withValues(alpha: 0.15)
                                : Colors.white.withValues(alpha: 0.06),
                            side: BorderSide(
                              color: _copied
                                  ? AppTheme.primaryGreen.withValues(alpha: 0.4)
                                  : AppTheme.borderDark,
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 7),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                          onPressed: () => _copyHeartbeatUrl(widget.config.heartbeatToken!),
                          icon: Icon(
                            _copied ? Icons.check_rounded : Icons.copy_rounded,
                            size: 11,
                            color: _copied ? AppTheme.primaryGreen : AppTheme.textSecondary,
                          ),
                          label: Text(
                            _copied ? 'Copied' : 'Copy URL',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: _copied ? AppTheme.primaryGreen : AppTheme.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    ],
                  )
                else
                  Text(
                    widget.config.target.isNotEmpty ? '${widget.config.target} ↗' : 'Heartbeat Push API',
                    style: const TextStyle(
                      color: AppTheme.textMuted,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),

                const SizedBox(height: 10),
                const Divider(height: 1, color: AppTheme.borderDark),
                const SizedBox(height: 8),

                                // Bottom Metrics Row: Latency, 30d Uptime, Last Checked.
                // Every cell is Expanded so each gets an equal share and none
                // can overflow; the text inside ellipsizes rather than crop.
                Row(
                  children: [
                    // Latency
                    Expanded(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: latency != null ? '$latency ms' : '—',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                fontFamily: 'monospace',
                                color: latencyColor,
                              ),
                            ),
                            const TextSpan(
                              text: ' response',
                              style: TextStyle(
                                color: AppTheme.textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        softWrap: false,
                      ),
                    ),

                    // 30d Uptime
                    Expanded(
                      child: Text(
                        widget.live.uptime30d != null
                            ? '${widget.live.uptime30d!.toStringAsFixed(1)}% / 30d'
                            : '…',
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        softWrap: false,
                        style: const TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),

                    // Last Checked relative time
                    Expanded(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          const Icon(Icons.history_rounded,
                              size: 12, color: AppTheme.textMuted),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              _sinceLabel(widget.live.lastCheckedAt),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              softWrap: false,
                              style: const TextStyle(
                                color: AppTheme.textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ),
                      ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// A compact icon action. Kept as one helper so the three buttons share an
  /// identical, small footprint — three default IconButtons with their own
  /// padding and gaps were what pushed the header row past a 320px screen.
  Widget _actionIcon({
    required IconData icon,
    required Color color,
    required String tooltip,
    required VoidCallback onPressed,
  }) {
    return IconButton(
      icon: Icon(icon, size: 16),
      color: color,
      padding: const EdgeInsets.all(4),
      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
      splashRadius: 16,
      visualDensity: VisualDensity.compact,
      tooltip: tooltip,
      onPressed: onPressed,
    );
  }

  Widget _buildTag(String label, Color textColor, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: textColor,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  Widget _buildCertTag(int expiresAt) {
    final days = ((expiresAt - DateTime.now().millisecondsSinceEpoch) / 86400000).floor();
    Color color;
    String text;

    if (days < 0) {
      text = 'Cert Expired';
      color = AppTheme.statusDown;
    } else if (days == 0) {
      text = 'Expires Today';
      color = AppTheme.statusDown;
    } else if (days <= 7) {
      text = '${days}d left';
      color = AppTheme.statusDown;
    } else if (days <= 30) {
      text = '${days}d left';
      color = AppTheme.statusPending;
    } else {
      text = '${days}d left';
      color = AppTheme.primaryGreen;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.lock_outline_rounded, size: 10, color: color),
          const SizedBox(width: 3),
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
