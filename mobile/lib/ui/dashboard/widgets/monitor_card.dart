import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../data/models/monitor.dart';
import '../../../data/models/live_state.dart';

class MonitorCard extends StatelessWidget {
  final MonitorConfig config;
  final LiveState live;
  final VoidCallback onTap;
  final VoidCallback onTogglePause;
  final VoidCallback onDelete;

  const MonitorCard({
    super.key,
    required this.config,
    required this.live,
    required this.onTap,
    required this.onTogglePause,
    required this.onDelete,
  });

  Color _statusColor() {
    if (!config.enabled) return AppTheme.statusPaused;
    switch (live.status) {
      case 'up':
        return AppTheme.statusUp;
      case 'down':
        return AppTheme.statusDown;
      case 'paused':
        return AppTheme.statusPaused;
      default:
        return AppTheme.statusPending;
    }
  }

  String _statusText() {
    if (!config.enabled) return 'PAUSED';
    return live.status.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor();

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Row: Status Dot, Name, Actions Menu
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: statusColor.withValues(alpha: 0.5),
                          blurRadius: 6,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      config.name,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                        letterSpacing: -0.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _statusText(),
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert, size: 20, color: AppTheme.textMuted),
                    color: AppTheme.bgSurfaceElevated,
                    onSelected: (val) {
                      if (val == 'pause') onTogglePause();
                      if (val == 'delete') onDelete();
                    },
                    itemBuilder: (ctx) => [
                      PopupMenuItem(
                        value: 'pause',
                        child: Row(
                          children: [
                            Icon(
                              config.enabled ? Icons.pause_circle_outline : Icons.play_circle_outline,
                              size: 18,
                              color: AppTheme.textSecondary,
                            ),
                            const SizedBox(width: 8),
                            Text(config.enabled ? 'Pause' : 'Resume'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            Icon(Icons.delete_outline, size: 18, color: AppTheme.statusDown),
                            SizedBox(width: 8),
                            Text('Delete', style: TextStyle(color: AppTheme.statusDown)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 6),
              // Target URL / Host
              Text(
                config.type == 'heartbeat' ? 'Cron / Heartbeat Worker' : config.target,
                style: const TextStyle(
                  color: AppTheme.textMuted,
                  fontSize: 13,
                  fontFamily: 'monospace',
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              // Badges Row: Type, Latency, 24h Uptime, Interval
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  _buildTag(config.type.toUpperCase(), AppTheme.accentCyan),
                  if (live.responseTimeMs != null && config.enabled)
                    _buildTag('${live.responseTimeMs} ms', AppTheme.primaryEmerald),
                  if (live.uptime24h != null)
                    _buildTag('${live.uptime24h!.toStringAsFixed(1)}% (24h)', AppTheme.textSecondary),
                  _buildTag('${config.intervalSeconds}s', AppTheme.textMuted),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTag(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppTheme.bgDark,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
