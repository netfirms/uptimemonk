import 'package:flutter/material.dart';
import '../../../core/theme.dart';

class StatsHeader extends StatelessWidget {
  final int total;
  final int up;
  final int down;
  final int paused;
  final double avgUptime;

  const StatsHeader({
    super.key,
    required this.total,
    required this.up,
    required this.down,
    required this.paused,
    required this.avgUptime,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '24-HOUR AVAILABILITY',
                    style: TextStyle(
                      color: AppTheme.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        '${avgUptime.toStringAsFixed(2)}%',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: avgUptime >= 99.0
                              ? AppTheme.statusUp
                              : avgUptime >= 95.0
                                  ? AppTheme.statusPending
                                  : AppTheme.statusDown,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: (down == 0 ? AppTheme.statusUp : AppTheme.statusDown)
                              .withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          down == 0 ? 'Operational' : '$down Degraded',
                          style: TextStyle(
                            color: down == 0 ? AppTheme.statusUp : AppTheme.statusDown,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.bgDark,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.borderDark),
                ),
                child: Column(
                  children: [
                    const Text(
                      'TOTAL',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      '$total',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _buildCountPill('Up', up, AppTheme.statusUp),
              const SizedBox(width: 8),
              _buildCountPill('Down', down, AppTheme.statusDown),
              const SizedBox(width: 8),
              _buildCountPill('Paused', paused, AppTheme.statusPaused),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCountPill(String label, int count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.bgDark,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppTheme.borderDark),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
            Text(
              '$label: ',
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
            ),
            Text(
              '$count',
              style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }
}
