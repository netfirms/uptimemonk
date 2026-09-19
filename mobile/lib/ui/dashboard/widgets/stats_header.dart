import 'package:flutter/material.dart';
import '../../../core/theme.dart';

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
                  value: '${avgUptime30d.toStringAsFixed(2)}%',
                  valueColor: AppTheme.primaryGreen,
                  subtext: 'System-wide operational ratio',
                  accentColor: AppTheme.primaryGreen,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildStatBox(
                  title: 'UP MONITORS',
                  trailing: Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: AppTheme.primaryGreen,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primaryGreen,
                          blurRadius: 5,
                          spreadRadius: 0.5,
                        ),
                      ],
                    ),
                  ),
                  value: '$up',
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
                  trailing: Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: down > 0 ? AppTheme.statusDown : AppTheme.textMuted,
                      shape: BoxShape.circle,
                      boxShadow: down > 0
                          ? [
                              const BoxShadow(
                                color: AppTheme.statusDown,
                                blurRadius: 5,
                                spreadRadius: 0.5,
                              ),
                            ]
                          : null,
                    ),
                  ),
                  value: '$down',
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
                  value: avgLatency != null ? '$avgLatency ms' : '—',
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
    required String value,
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
          // Big value number
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              fontFamily: 'monospace',
              color: valueColor,
              letterSpacing: -0.5,
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
