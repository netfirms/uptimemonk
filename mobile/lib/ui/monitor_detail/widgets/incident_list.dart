import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../../data/models/history.dart';

class IncidentList extends StatelessWidget {
  final List<HistoryIncident> incidents;

  const IncidentList({super.key, required this.incidents});

  String _formatDate(int epochMs) {
    final dt = DateTime.fromMillisecondsSinceEpoch(epochMs);
    return DateFormat('MMM d, HH:mm').format(dt);
  }

  String _formatDuration(int seconds) {
    if (seconds < 60) return '${seconds}s';
    final mins = seconds ~/ 60;
    if (mins < 60) return '${mins}m';
    final hrs = mins ~/ 60;
    final remMins = mins % 60;
    return '${hrs}h ${remMins}m';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'INCIDENT LOG',
            style: TextStyle(
              color: AppTheme.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          if (incidents.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text(
                  'No incidents recorded for this window.',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: incidents.length,
              separatorBuilder: (_, __) => const Divider(height: 16),
              itemBuilder: (ctx, idx) {
                final inc = incidents[idx];
                final isResolved = inc.isResolved;

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 3),
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: isResolved ? AppTheme.statusUp : AppTheme.statusDown,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                isResolved ? 'Resolved Outage' : 'Ongoing Outage',
                                style: TextStyle(
                                  color: isResolved ? AppTheme.textPrimary : AppTheme.statusDown,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              if (inc.durationSeconds != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppTheme.bgDark,
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(color: AppTheme.borderDark),
                                  ),
                                  child: Text(
                                    _formatDuration(inc.durationSeconds!),
                                    style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            inc.cause,
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _formatDate(inc.startedAt),
                            style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }
}
