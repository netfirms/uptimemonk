import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../viewmodels/dashboard_viewmodel.dart';

class FilterBar extends StatefulWidget {
  final FilterStatus currentFilter;
  final ValueChanged<FilterStatus> onFilterChanged;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;
  final int totalCount;
  final int upCount;
  final int downCount;
  final int pausedCount;
  final int pendingCount;
  final int publicCount;
  final VoidCallback onAddMonitor;
  final VoidCallback? onViewStatusPage;

  const FilterBar({
    super.key,
    required this.currentFilter,
    required this.onFilterChanged,
    required this.searchQuery,
    required this.onSearchChanged,
    required this.totalCount,
    required this.upCount,
    required this.downCount,
    required this.pausedCount,
    required this.pendingCount,
    this.publicCount = 0,
    required this.onAddMonitor,
    this.onViewStatusPage,
  });

  @override
  State<FilterBar> createState() => _FilterBarState();
}

class _FilterBarState extends State<FilterBar> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.searchQuery);
  }

  @override
  void didUpdateWidget(FilterBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.searchQuery != _controller.text) {
      _controller.text = widget.searchQuery;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Search Box (Web style)
          Container(
            height: 42,
            decoration: BoxDecoration(
              color: AppTheme.bgSurfaceInput,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppTheme.borderDark, width: 1),
            ),
            child: TextField(
              controller: _controller,
              onChanged: widget.onSearchChanged,
              style: const TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 13.5,
              ),
              textAlignVertical: TextAlignVertical.center,
              decoration: InputDecoration(
                hintText: 'Search monitors by name or URL...',
                hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                prefixIcon: const Icon(Icons.search_rounded, size: 18, color: AppTheme.textMuted),
                suffixIcon: widget.searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close_rounded, size: 18, color: AppTheme.textMuted),
                        splashRadius: 16,
                        onPressed: () {
                          _controller.clear();
                          widget.onSearchChanged('');
                        },
                      )
                    : Container(
                        width: 32,
                        alignment: Alignment.center,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                          ),
                          child: const Text(
                            '/',
                            style: TextStyle(
                              color: AppTheme.textMuted,
                              fontSize: 11,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // 2. Segmented Tabs Group (Web .tabs-group style)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: AppTheme.bgSurfaceInput,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: AppTheme.borderDark, width: 1),
              ),
              child: Row(
                children: [
                  _buildTab(
                    label: 'All',
                    count: widget.totalCount,
                    filter: FilterStatus.all,
                    badgeType: _BadgeType.neutral,
                  ),
                  _buildTab(
                    label: 'Up',
                    count: widget.upCount,
                    filter: FilterStatus.up,
                    badgeType: _BadgeType.up,
                  ),
                  _buildTab(
                    label: 'Down',
                    count: widget.downCount,
                    filter: FilterStatus.down,
                    badgeType: _BadgeType.down,
                  ),
                  _buildTab(
                    label: 'Paused',
                    count: widget.pausedCount,
                    filter: FilterStatus.paused,
                    badgeType: _BadgeType.neutral,
                  ),
                  if (widget.pendingCount > 0)
                    _buildTab(
                      label: 'Pending',
                      count: widget.pendingCount,
                      filter: FilterStatus.pending,
                      badgeType: _BadgeType.pending,
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // 3. Quick Action Row: + New Monitor Button & Status Page
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 38,
                  child: ElevatedButton.icon(
                    onPressed: widget.onAddMonitor,
                    icon: const Icon(Icons.add_rounded, size: 18, color: Colors.black),
                    label: const Text(
                      'New Monitor',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Colors.black,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryGreen,
                      foregroundColor: Colors.black,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ),
              if (widget.onViewStatusPage != null) ...[
                const SizedBox(width: 8),
                SizedBox(
                  height: 38,
                  child: OutlinedButton.icon(
                    onPressed: widget.onViewStatusPage,
                    icon: const Icon(Icons.public_rounded, size: 16, color: AppTheme.accentCyan),
                    label: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Status Page',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                        ),
                        if (widget.publicCount > 0) ...[
                          const SizedBox(width: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: AppTheme.accentCyan.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '${widget.publicCount}',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.accentCyan,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppTheme.borderDark),
                      backgroundColor: AppTheme.bgSurfaceCard,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTab({
    required String label,
    required int count,
    required FilterStatus filter,
    required _BadgeType badgeType,
  }) {
    final isActive = widget.currentFilter == filter;

    Color badgeBg;
    Color badgeText;

    if (isActive) {
      switch (badgeType) {
        case _BadgeType.up:
          badgeBg = AppTheme.primaryGreen.withValues(alpha: 0.2);
          badgeText = AppTheme.primaryGreen;
          break;
        case _BadgeType.down:
          badgeBg = AppTheme.statusDown.withValues(alpha: 0.2);
          badgeText = AppTheme.statusDown;
          break;
        case _BadgeType.pending:
          badgeBg = AppTheme.statusPending.withValues(alpha: 0.2);
          badgeText = AppTheme.statusPending;
          break;
        case _BadgeType.neutral:
          badgeBg = Colors.white.withValues(alpha: 0.15);
          badgeText = Colors.white;
          break;
      }
    } else {
      badgeBg = Colors.white.withValues(alpha: 0.07);
      badgeText = AppTheme.textSecondary;
    }

    return InkWell(
      onTap: () => widget.onFilterChanged(filter),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? AppTheme.bgSurfaceHover : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: isActive ? Colors.white : AppTheme.textSecondary,
                fontSize: 12.5,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
              decoration: BoxDecoration(
                color: badgeBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  color: badgeText,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum _BadgeType { neutral, up, down, pending }
