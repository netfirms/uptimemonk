import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../viewmodels/dashboard_viewmodel.dart';
import '../monitor_detail/monitor_detail_screen.dart';
import '../monitor_form/monitor_form_screen.dart';
import '../settings/settings_screen.dart';
import 'widgets/stats_header.dart';
import 'widgets/filter_bar.dart';
import 'widgets/monitor_card.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<DashboardViewModel>(
      builder: (context, vm, _) {
        final monitors = vm.filteredMonitors;

        return Scaffold(
          appBar: AppBar(
            title: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppTheme.primaryEmerald, AppTheme.accentCyan],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Text(
                      '🐵',
                      style: TextStyle(fontSize: 14),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'UptimeMonke',
                  style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: -0.3),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.add_circle_outline, color: AppTheme.primaryEmerald),
                tooltip: 'Add Monitor',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const MonitorFormScreen()),
                  );
                },
              ),
              IconButton(
                icon: const Icon(Icons.settings_outlined, color: AppTheme.textSecondary),
                tooltip: 'Settings',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const SettingsScreen()),
                  );
                },
              ),
            ],
          ),
          body: vm.isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: AppTheme.primaryEmerald),
                )
              : CustomScrollView(
                  slivers: [
                    // Stats Summary
                    SliverToBoxAdapter(
                      child: StatsHeader(
                        total: vm.totalCount,
                        up: vm.upCount,
                        down: vm.downCount,
                        paused: vm.pausedCount,
                        avgUptime: vm.avgUptime24h,
                      ),
                    ),

                    // Filter & Search
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: FilterBar(
                          currentFilter: vm.filter,
                          onFilterChanged: (f) => vm.setFilter(f),
                          onSearchChanged: (q) => vm.setSearchQuery(q),
                        ),
                      ),
                    ),

                    // Monitors List or Empty State
                    if (monitors.isEmpty)
                      SliverToBoxAdapter(
                        child: _buildEmptyState(context),
                      )
                    else
                      SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (ctx, idx) {
                            final item = monitors[idx];
                            return MonitorCard(
                              config: item.config,
                              live: item.live,
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => MonitorDetailScreen(
                                      monitor: item.config,
                                      live: item.live,
                                    ),
                                  ),
                                );
                              },
                              onTogglePause: () => vm.togglePause(item.config),
                              onDelete: () => vm.deleteMonitor(item.config.id),
                            );
                          },
                          childCount: monitors.length,
                        ),
                      ),

                    const SliverToBoxAdapter(child: SizedBox(height: 30)),
                  ],
                ),
        );
      },
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        children: [
          const Icon(Icons.radar_outlined, size: 48, color: AppTheme.accentCyan),
          const SizedBox(height: 12),
          const Text(
            'No monitors found',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
          ),
          const SizedBox(height: 6),
          const Text(
            'Start probing your APIs, web apps, or AI gateways with zero-drift accuracy.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const MonitorFormScreen()),
              );
            },
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Add Your First Monitor'),
          ),
        ],
      ),
    );
  }
}
