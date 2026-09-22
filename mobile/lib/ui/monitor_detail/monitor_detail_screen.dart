import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../data/models/monitor.dart';
import '../../data/models/live_state.dart';
import '../../viewmodels/monitor_detail_viewmodel.dart';
import '../monitor_form/monitor_form_screen.dart';
import '../widgets/probe_pulse.dart';
import '../widgets/stagger_in.dart';
import 'widgets/status_bars_chart.dart';
import 'widgets/response_chart.dart';
import 'widgets/incident_list.dart';

class MonitorDetailScreen extends StatelessWidget {
  final MonitorConfig monitor;
  final LiveState live;

  const MonitorDetailScreen({
    super.key,
    required this.monitor,
    required this.live,
  });

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => MonitorDetailViewModel(monitor: monitor),
      child: Consumer<MonitorDetailViewModel>(
        builder: (context, vm, _) {
          return Scaffold(
            appBar: AppBar(
              title: Text(monitor.name),
              actions: [
                IconButton(
                  icon: Icon(
                    monitor.enabled ? Icons.pause_circle_outline : Icons.play_circle_outline,
                    color: AppTheme.textSecondary,
                  ),
                  tooltip: monitor.enabled ? 'Pause Monitor' : 'Resume Monitor',
                  onPressed: () async {
                    final ok = await vm.togglePause();
                    if (ok && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(monitor.enabled ? 'Monitor paused' : 'Monitor resumed'),
                        ),
                      );
                    }
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, color: AppTheme.textSecondary),
                  tooltip: 'Edit Monitor',
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => MonitorFormScreen(existingMonitor: monitor),
                      ),
                    );
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: AppTheme.statusDown),
                  tooltip: 'Delete Monitor',
                  onPressed: () async {
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        backgroundColor: AppTheme.bgSurfaceElevated,
                        title: const Text('Delete Monitor?'),
                        content: Text('Are you sure you want to delete "${monitor.name}"? This cannot be undone.'),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: const Text('Cancel'),
                          ),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.statusDown),
                            onPressed: () => Navigator.pop(ctx, true),
                            child: const Text('Delete', style: TextStyle(color: Colors.white)),
                          ),
                        ],
                      ),
                    );

                    if (confirm == true) {
                      final ok = await vm.deleteMonitor();
                      if (ok && context.mounted) {
                        Navigator.pop(context);
                      }
                    }
                  },
                ),
              ],
            ),
            body: RefreshIndicator(
              onRefresh: () => vm.fetchHistory(),
              color: AppTheme.primary,
              backgroundColor: AppTheme.bgSurface,
              child: ListView(
                children: [
                  // Status Header Box
                  _buildHeaderCard(context),

                  // Charts — the range selector lives on the status chart and
                  // drives both, so one tap relabels and refetches everything.
                  if (vm.isLoading && vm.history == null)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        // The same loader as the rest of the app. A bare spinner
                        // said nothing about what was being waited on; the pulse
                        // says probe history is being fetched, which is what is
                        // actually happening.
                        child: ProbePulse(
                          size: 104,
                          messages: [
                            'Fetching probe history\u2026',
                            'Replaying the last checks\u2026',
                          ],
                        ),
                      ),
                    )
                  else if (vm.history != null) ...[
                    // The panels arrive in reading order rather than all at
                    // once, so the eye lands on the uptime bars first. Keyed by
                    // range so switching 24h/7d/30d replays the entrance and
                    // makes it obvious the data underneath changed.
                    StaggerIn(
                      index: 0,
                      key: ValueKey('status-${vm.range}'),
                      // Monitoring result first: up/down history over the range.
                      child: StatusBarsChart(
                        history: vm.history!,
                        activeRange: vm.range,
                        onRangeSelected: (r) => vm.setRange(r),
                      ),
                    ),
                    StaggerIn(
                      index: 1,
                      key: ValueKey('response-${vm.range}'),
                      // Then response time, the same buckets' latency.
                      child: ResponseChart(
                        history: vm.history!,
                        activeRange: vm.range,
                        onRangeSelected: (r) => vm.setRange(r),
                      ),
                    ),
                  ],

                  // Incidents
                  if (vm.history != null)
                    StaggerIn(
                      index: 2,
                      key: ValueKey('incidents-${vm.range}'),
                      child: IncidentList(incidents: vm.history!.incidents),
                    ),

                  const SizedBox(height: 30),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeaderCard(BuildContext context) {
    Color statusColor;
    String statusText;

    if (!monitor.enabled) {
      statusColor = AppTheme.statusPaused;
      statusText = 'PAUSED';
    } else {
      switch (live.status) {
        case 'up':
          statusColor = AppTheme.statusUp;
          statusText = 'OPERATIONAL';
          break;
        case 'down':
          statusColor = AppTheme.statusDown;
          statusText = 'OUTAGE DETECTED';
          break;
        default:
          statusColor = AppTheme.statusPending;
          statusText = 'CHECKING STATUS';
      }
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                statusText,
                style: TextStyle(
                  color: statusColor,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.bgDark,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppTheme.borderDark),
                ),
                child: Text(
                  'Every ${monitor.intervalSeconds}s',
                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            monitor.type == 'heartbeat' ? 'Cron / Push Heartbeat' : monitor.target,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimary,
              fontFamily: 'monospace',
            ),
          ),
          if (live.lastError != null && live.lastError!.isNotEmpty && monitor.enabled) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.statusDown.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.statusDown.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, size: 16, color: AppTheme.statusDown),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      live.lastError!,
                      style: const TextStyle(color: AppTheme.statusDown, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
