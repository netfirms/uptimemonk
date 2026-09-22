import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../data/models/history.dart';

/// A status-history bar chart: one bar per bucket, coloured by how much of that
/// hour (or day) was healthy.
///
/// This is the "monitoring result" view, as opposed to [ResponseChart] which
/// plots how *fast* responses were. A bucket that lost no checks is green, one
/// that lost every check is red, and a partial outage is amber sized to its
/// uptime ratio — so a bad period is both the wrong colour and short.
///
/// It reads [MonitorHistory.buckets], which the API returns for every range:
/// hourly buckets up to 7d, daily rollups for 30d and 90d. The same widget
/// therefore works at all four ranges without knowing which table answered.
class StatusBarsChart extends StatelessWidget {
  final MonitorHistory history;
  final String activeRange;
  final ValueChanged<String> onRangeSelected;

  const StatusBarsChart({
    super.key,
    required this.history,
    required this.activeRange,
    required this.onRangeSelected,
  });

  static const _ranges = ['24h', '7d', '30d', '90d'];

  @override
  Widget build(BuildContext context) {
    final buckets = history.buckets;

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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'STATUS HISTORY',
                style: TextStyle(
                  color: AppTheme.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              Row(children: _ranges.map(_rangeButton).toList()),
            ],
          ),
          const SizedBox(height: 14),
          if (buckets.isEmpty)
            SizedBox(
              height: 64,
              child: Center(
                child: Text(
                  'No history for this range yet',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                ),
              ),
            )
          else ...[
            SizedBox(
              height: 64,
              child: _Bars(buckets: buckets),
            ),
            const SizedBox(height: 10),
            _legend(buckets),
          ],
        ],
      ),
    );
  }

  Widget _rangeButton(String r) {
    final isSelected = activeRange == r;
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: InkWell(
        onTap: () => onRangeSelected(r),
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: isSelected
                ? AppTheme.primary.withValues(alpha: 0.2)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
              color: isSelected ? AppTheme.primary : AppTheme.borderDark,
            ),
          ),
          child: Text(
            r,
            style: TextStyle(
              color: isSelected ? AppTheme.primary : AppTheme.textMuted,
              fontSize: 11,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }

  Widget _legend(List<Bucket> buckets) {
    int up = 0, down = 0, partial = 0, empty = 0;
    for (final b in buckets) {
      final checks = b.up + b.down;
      if (checks == 0) {
        empty++;
      } else if (b.down == 0) {
        up++;
      } else if (b.up == 0) {
        down++;
      } else {
        partial++;
      }
    }

    return Wrap(
      spacing: 12,
      runSpacing: 4,
      children: [
        _legendDot(AppTheme.statusUp, 'Up', up),
        if (partial > 0) _legendDot(AppTheme.statusPending, 'Degraded', partial),
        if (down > 0) _legendDot(AppTheme.statusDown, 'Down', down),
        if (empty > 0) _legendDot(AppTheme.borderLight, 'No data', empty),
      ],
    );
  }

  Widget _legendDot(Color color, String label, int count) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 5),
        Text(
          '$label $count',
          style: const TextStyle(color: AppTheme.textMuted, fontSize: 10.5),
        ),
      ],
    );
  }
}

/// The bars themselves. Laid out with a spot gap so adjacent bars stay
/// distinguishable even when a 7d range puts 168 of them on screen.
class _Bars extends StatelessWidget {
  final List<Bucket> buckets;

  const _Bars({required this.buckets});

  @override
  Widget build(BuildContext context) {
    final sorted = [...buckets]..sort((a, b) => a.t.compareTo(b.t));

    // Keep the most recent 180 buckets at most — beyond that bars are sub-pixel
    // and the chart communicates nothing the legend does not.
    final windowed = sorted.length > 180
        ? sorted.sublist(sorted.length - 180)
        : sorted;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var i = 0; i < windowed.length; i++) ...[
          if (i > 0) const SizedBox(width: 1),
          Expanded(child: _bar(windowed[i])),
        ],
      ],
    );
  }

  Widget _bar(Bucket b) {
    final checks = b.up + b.down;

    final Color color;
    final double fraction;
    if (checks == 0) {
      // No probes in this bucket: a faint stub reads as a gap, not an outage.
      color = AppTheme.borderLight;
      fraction = 0.15;
    } else if (b.down == 0) {
      color = AppTheme.statusUp;
      fraction = 1.0;
    } else if (b.up == 0) {
      color = AppTheme.statusDown;
      fraction = 1.0;
    } else {
      color = AppTheme.statusPending;
      // Height still reflects health, so a mostly-down hour is visibly short.
      fraction = (b.uptimeRatio.isFinite ? b.uptimeRatio : 1.0)
          .clamp(0.15, 1.0)
          .toDouble();
    }

    return Tooltip(
      message: '${(b.uptimeRatio * 100).toStringAsFixed(1)}% · '
          '${b.up} up, ${b.down} down',
      child: Align(
        alignment: Alignment.bottomCenter,
        child: FractionallySizedBox(
          heightFactor: fraction,
          child: Container(
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.9),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(1)),
            ),
          ),
        ),
      ),
    );
  }
}
