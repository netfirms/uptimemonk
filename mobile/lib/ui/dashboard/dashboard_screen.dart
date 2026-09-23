import 'dart:io';

import 'package:flutter/material.dart';
import '../widgets/probe_pulse.dart';
import '../widgets/stagger_in.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/external_link.dart';
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

  String _compactChecks(int n) {
    if (n >= 1000000) {
      return '${(n / 1000000).toStringAsFixed(n >= 10000000 ? 0 : 1)}M';
    }
    if (n >= 1000) return '${(n / 1000).round()}k';
    return '$n';
  }

  void _showStatusPageModal(BuildContext context, String orgId, int publicCount) {
    final url = 'https://uptimemonke.com/status/$orgId';
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.bgSurfaceElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.accentDeep.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.public_rounded, color: AppTheme.accentDeep, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Public Status Page',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        Text(
                          publicCount > 0
                              ? '$publicCount monitor${publicCount == 1 ? '' : 's'} published'
                              : 'No monitors published yet',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.bgDark,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.borderDark),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        url,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: AppTheme.primary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.copy_rounded, size: 18, color: AppTheme.textSecondary),
                      tooltip: 'Copy status page link',
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: url));
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Status page URL copied to clipboard!')),
                        );
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Share this link with your users or stakeholders to show real-time service uptime.',
                style: TextStyle(fontSize: 12, color: AppTheme.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 16),
              // Seeing the page is what most people opened this sheet for.
              // Copying a link is how you send it to someone else — a
              // different job, and a worse default.
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: const Color(0xFF04121A),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.open_in_new_rounded, size: 18),
                  label: const Text(
                    'Open status page',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  onPressed: () async {
                    // The sheet closes only once the browser has taken it.
                    // Closing first would leave a failure message with
                    // nothing on screen to explain what failed.
                    final opened = await openExternalUrl(context, url);
                    if (opened && ctx.mounted) Navigator.pop(ctx);
                  },
                ),
              ),
              if (publicCount == 0) ...[
                const SizedBox(height: 10),
                // Worth saying before they open it: the page exists, it is
                // simply empty, and the fix is a per-monitor setting that is
                // nowhere near this sheet.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline_rounded,
                        size: 14, color: AppTheme.statusMaintenance),
                    const SizedBox(width: 6),
                    const Expanded(
                      child: Text(
                        'No monitors are published yet, so the page will look '
                        'empty. Turn on "Publish on Public Status Page" for a '
                        'monitor to list it here.',
                        style: TextStyle(
                          fontSize: 11,
                          height: 1.4,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  void _confirmDelete(BuildContext context, String id, String name, DashboardViewModel vm) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.bgSurfaceElevated,
        title: const Text('Delete Monitor'),
        content: Text('Are you sure you want to delete "$name"? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.statusDown),
            onPressed: () {
              Navigator.pop(ctx);
              vm.deleteMonitor(id);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Deleted "$name"')),
              );
            },
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DashboardViewModel>(
      builder: (context, vm, _) {
        final monitors = vm.filteredMonitors;

        return Scaffold(
          backgroundColor: AppTheme.bgDark,
          appBar: AppBar(
            backgroundColor: AppTheme.bgDark,
            elevation: 0,
            titleSpacing: 16,
            title: Row(
              children: [
                // Brand mascot image
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: Image.asset(
                    'assets/mascot-128.png',
                    width: 28,
                    height: 28,
                    fit: BoxFit.contain,
                    errorBuilder: (ctx, _, __) => Container(
                      width: 28,
                      height: 28,
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppTheme.primary, AppTheme.accentDeep],
                        ),
                        shape: BoxShape.circle,
                      ),
                      child: const Center(
                        child: Text('🐵', style: TextStyle(fontSize: 14)),
                      ),
                    ),
                  ),
                ),
                // The wordmark is gone from here on purpose: anyone looking at
                // this screen has already opened the app and knows what it is,
                // and the row is tight — dropping it gives the workspace pill
                // and the actions the width they were competing for. The
                // mascot still carries the identity.
                const SizedBox(width: 10),
                // Workspace Pill Button
                InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const SettingsScreen()),
                    );
                  },
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppTheme.borderDark),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.tune_rounded, size: 11, color: AppTheme.textMuted),
                        const SizedBox(width: 4),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 100),
                          child: Text(
                            vm.workspaceName ?? 'Workspace',
                            style: const TextStyle(
                              color: AppTheme.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            actions: [
              // Credits chip — a donated balance, so never on iOS.
              //
              // It only appears for someone who has donated, carries a coffee
              // mark, and reads as a purchased balance. App Store Guideline
              // 3.1.1 covers steering to payment outside In-App Purchase, and
              // a reviewer has no way to tell this apart from a paid-credit
              // meter. The server already withholds the funding block from
              // iOS; this is the matching half.
              if (!Platform.isIOS &&
                  vm.creditsRemaining != null &&
                  vm.creditsRemaining! > 0)
                Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('☕', style: TextStyle(fontSize: 10)),
                        const SizedBox(width: 3),
                        Text(
                          '${_compactChecks(vm.creditsRemaining!)} left',
                          style: const TextStyle(
                            color: AppTheme.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              // Alert Contacts Quick Button
              IconButton(
                icon: const Icon(Icons.notifications_outlined, size: 20),
                color: AppTheme.textSecondary,
                tooltip: 'Alert Contacts',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const SettingsScreen()),
                  );
                },
              ),
              // Settings Button
              IconButton(
                icon: const Icon(Icons.settings_outlined, size: 20),
                color: AppTheme.textSecondary,
                tooltip: 'Settings',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const SettingsScreen()),
                  );
                },
              ),
              const SizedBox(width: 4),
            ],
          ),
          body: vm.isLoading
              ? const Center(
                  child: ProbePulse(
                    size: 108,
                    showMark: false,
                    messages: ['Fetching your monitors…'],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: vm.refreshAll,
                  color: AppTheme.primary,
                  backgroundColor: AppTheme.bgSurfaceElevated,
                  child: CustomScrollView(
                  // Always scrollable so pull-to-refresh still works when the
                  // list is short enough not to scroll on its own.
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    // Global Error Callout
                    if (vm.errorMessage != null)
                      SliverToBoxAdapter(
                        child: Container(
                          margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppTheme.statusDown.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppTheme.statusDown.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline, color: AppTheme.statusDown, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  vm.errorMessage!,
                                  style: const TextStyle(color: AppTheme.statusDown, fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                    // Top 4 Stat Boxes (Overall Uptime 30d, Up, Down, Avg Response)
                    SliverToBoxAdapter(
                      child: StatsHeader(
                        total: vm.totalCount,
                        up: vm.upCount,
                        down: vm.downCount,
                        paused: vm.pausedCount,
                        pending: vm.pendingCount,
                        avgUptime30d: vm.avgUptime30d,
                        avgLatency: vm.avgLatency,
                      ),
                    ),

                    // Filter Bar: Search + Grouped Segmented Tabs + New Monitor & Status Page
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: FilterBar(
                          currentFilter: vm.filter,
                          onFilterChanged: (f) => vm.setFilter(f),
                          searchQuery: vm.searchQuery,
                          onSearchChanged: (q) => vm.setSearchQuery(q),
                          totalCount: vm.totalCount,
                          upCount: vm.upCount,
                          downCount: vm.downCount,
                          pausedCount: vm.pausedCount,
                          pendingCount: vm.pendingCount,
                          publicCount: vm.publicCount,
                          onAddMonitor: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const MonitorFormScreen()),
                            );
                          },
                          onViewStatusPage: () {
                            _showStatusPageModal(context, vm.orgId, vm.publicCount);
                          },
                        ),
                      ),
                    ),

                    // Monitors List or Empty State
                    if (monitors.isEmpty)
                      SliverToBoxAdapter(
                        child: _buildEmptyState(context, vm),
                      )
                    else
                      SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (ctx, idx) {
                            final item = monitors[idx];
                            return StaggerIn(
                              index: idx,
                              // Keyed by monitor id so a filter change or a
                              // rename reuses the same State instead of
                              // replaying the entrance on a row that was
                              // already on screen.
                              key: ValueKey(item.config.id),
                              child: MonitorCard(
                                config: item.config,
                                live: item.live,
                                history: vm.historyFor(item.config.id),
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
                                onEdit: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => MonitorFormScreen(
                                        existingMonitor: item.config,
                                      ),
                                    ),
                                  );
                                },
                                onTogglePause: () => vm.togglePause(item.config),
                                onDelete: () => _confirmDelete(
                                  context,
                                  item.config.id,
                                  item.config.name,
                                  vm,
                                ),
                              ),
                            );
                          },
                          childCount: monitors.length,
                        ),
                      ),

                    const SliverToBoxAdapter(child: SizedBox(height: 36)),
                  ],
                ),
              ),
        );
      },
    );
  }

  Widget _buildEmptyState(BuildContext context, DashboardViewModel vm) {
    if (vm.searchQuery.isNotEmpty) {
      return Container(
        margin: const EdgeInsets.all(24),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppTheme.bgSurfaceCard,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.borderDark),
        ),
        child: Column(
          children: [
            const Icon(Icons.search_off_rounded, size: 40, color: AppTheme.textMuted),
            const SizedBox(height: 12),
            const Text(
              'No matching monitors found',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 6),
            const Text(
              'No monitors match your search query. Try clearing the filter.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () {
                vm.setSearchQuery('');
                vm.setFilter(FilterStatus.all);
              },
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppTheme.borderDark),
              ),
              child: const Text('Clear Search', style: TextStyle(color: AppTheme.textPrimary)),
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.all(20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.bgSurfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The heading takes the space the badge does not, rather than both
          // sizing to their content and meeting in the middle: under
          // `spaceBetween` each child was unbounded, so on a 320pt-wide card
          // the title and the badge overlapped and the row overflowed by 58px
          // — the striped band that reads as the app having broken. Expanded
          // lets the heading wrap instead, at any width or text scale.
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Get started',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Start monitoring in under 30 seconds',
                      style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'Ready to configure',
                  style: TextStyle(
                    color: AppTheme.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Step 1
          InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const MonitorFormScreen()),
              );
            },
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.bgDark,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.borderDark),
              ),
              child: const Row(
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: AppTheme.primary,
                    child: Text('1', style: TextStyle(fontSize: 12, color: Colors.black, fontWeight: FontWeight.bold)),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Add your first monitor', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        Text('Website, API, Cron heartbeat, SSL, Ping or Port', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: AppTheme.textMuted, size: 18),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Step 2
          InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.bgDark,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.borderDark),
              ),
              child: const Row(
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: AppTheme.accentDeep,
                    child: Text('2', style: TextStyle(fontSize: 12, color: Colors.black, fontWeight: FontWeight.bold)),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Configure alert notifications', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        Text('Email, Push notifications, Slack or Webhooks', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: AppTheme.textMuted, size: 18),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
