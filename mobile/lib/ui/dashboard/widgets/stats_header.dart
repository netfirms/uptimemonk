import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../widgets/animated_counter.dart';
import '../../widgets/status_dot.dart';

class StatsHeader extends StatelessWidget {
  final int total;
  final int up;
  final int down;
  final int paused;
  final int pending;
  final double avgUptime30d;
  final int? avgLatency;

  const StatsHeader({
    super.key,
    required this.total,
    required this.up,
    required this.down,
    required this.paused,
    this.pending = 0,
    required this.avgUptime30d,
    this.avgLatency,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        children: [
          // Row 1: Overall Uptime & Up Monitors
          Row(
            children: [
              Expanded(
                child: _buildStatBox(
                  title: 'OVERALL UPTIME',
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryGreen.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      '30 DAYS',
                      style: TextStyle(
                        color: AppTheme.primaryGreen,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ),
                  value: avgUptime30d,
                  format: (v) => '${v.toStringAsFixed(2)}%',
                  valueColor: AppTheme.primaryGreen,
                  subtext: 'System-wide operational ratio',
                  accentColor: AppTheme.primaryGreen,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildStatBox(
                  title: 'UP MONITORS',
                  // Pulses only while something is actually reporting healthy;
                  // an empty workspace has nothing live to show.
                  trailing: StatusDot(
                    color: AppTheme.primaryGreen,
                    pulsing: up > 0,
                  ),
                  value: up.toDouble(),
                  format: (v) => v.round().toString(),
                  valueColor: AppTheme.primaryGreen,
                  subtext: 'Reporting healthy response',
                  accentColor: AppTheme.primaryGreen,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Row 2: Down Monitors & Avg Response
          Row(
            children: [
              Expanded(
                child: _buildStatBox(
                  title: 'DOWN MONITORS',
                  // The one indicator worth moving: an active outage should
                  // catch the eye before the number is read. All-clear sits
                  // still, so motion here always means something is wrong.
                  trailing: StatusDot(
                    color: down > 0 ? AppTheme.statusDown : AppTheme.textMuted,
                    pulsing: down > 0,
                  ),
                  value: down.toDouble(),
                  format: (v) => v.round().toString(),
                  valueColor: down > 0 ? AppTheme.statusDown : AppTheme.textPrimary,
                  subtext: down > 0 ? '$down incident${down == 1 ? '' : 's'} active' : 'All operational',
                  accentColor: down > 0 ? AppTheme.statusDown : Colors.transparent,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildStatBox(
                  title: 'AVG RESPONSE',
                  trailing: const Icon(
                    Icons.access_time_rounded,
                    size: 13,
                    color: AppTheme.textMuted,
                  ),
                  value: (avgLatency ?? 0).toDouble(),
                  // An unmeasured latency is not zero, and counting up to a
                  // dash would be nonsense — so the em dash short-circuits
                  // the format rather than the value.
                  format: (v) => avgLatency == null ? '—' : '${v.round()} ms',
                  valueColor: avgLatency == null
                      ? AppTheme.textMuted
                      : avgLatency! < 250
                          ? AppTheme.latencyFast
                          : avgLatency! < 600
                              ? AppTheme.latencyMed
                              : AppTheme.latencySlow,
                  subtext: 'Fast global edge probes',
                  accentColor: AppTheme.accentCyan,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatBox({
    required String title,
    required Widget trailing,
    required double value,
    required String Function(double) format,
    required Color valueColor,
    required String subtext,
    required Color accentColor,
  }) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppTheme.bgSurfaceCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderDark, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header title & indicator
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: AppTheme.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              trailing,
            ],
          ),
          const SizedBox(height: 6),
          // Big value number. Monospace matters more than usual here: a
          // proportional face would change width on every interpolated frame
          // and make the whole row jitter as the number settles.
          AnimatedStatusColor(
            color: valueColor,
            builder: (context, color) => AnimatedCounter(
              value: value,
              format: format,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                fontFamily: 'monospace',
                color: color,
                letterSpacing: -0.5,
              ),
            ),
          ),
          const SizedBox(height: 3),
          // Subtext
          Text(
            subtext,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppTheme.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
