import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../data/models/history.dart';

/// A compact bar sparkline showing the last [hours] hourly buckets.
///
/// Sits on a monitor card so a glance answers "was this up lately?" without
/// opening the detail view. One bar per hour, coloured by that hour's result:
/// all up = green, any down = red, a mixed hour = amber. Hours with no data
/// (before the monitor existed, or a gap in collection) read as an empty slot
/// rather than a false "down".
class HourlyBars extends StatelessWidget {
  final List<Bucket> buckets;
  final int hours;
  final double height;

  const HourlyBars({
    super.key,
    required this.buckets,
    this.hours = 12,
    this.height = 22,
  });

  @override
  Widget build(BuildContext context) {
    // Take the most recent `hours` buckets, oldest first, so the chart reads
    // left-to-right like a timeline. The API returns buckets in ascending time
    // order, but sort defensively rather than trusting it.
    final sorted = [...buckets]..sort((a, b) => a.t.compareTo(b.t));
    final window = sorted.length > hours
        ? sorted.sublist(sorted.length - hours)
        : sorted;

    if (window.isEmpty) {
      return SizedBox(
        height: height,
        child: const Align(
          alignment: Alignment.centerLeft,
          child: Text(
            'No history yet',
            style: TextStyle(color: AppTheme.textDim, fontSize: 10),
          ),
        ),
      );
    }

    return SizedBox(
      height: height,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < window.length; i++) ...[
            if (i > 0) const SizedBox(width: 2),
            Expanded(child: _bar(window[i])),
          ],
        ],
      ),
    );
  }

  Widget _bar(Bucket b) {
    final checks = b.up + b.down;
    if (checks == 0) {
      // No probes landed in this hour — show a low, neutral stub so the gap is
      // visible but not mistaken for an outage.
      return _barShape(
        color: AppTheme.borderLight,
        fraction: 0.25,
      );
    }

    final Color color;
    if (b.down == 0) {
      color = AppTheme.statusUp;
    } else if (b.up == 0) {
      color = AppTheme.statusDown;
    } else {
      color = AppTheme.statusPending;
    }

    // Height encodes how much of the hour was healthy: a fully up hour is a
    // full bar, a mostly-down hour is a stub, so a bad hour is both red and
    // short. Clamped so the shortest bar is still visible.
    final fraction = (b.uptimeRatio.isFinite ? b.uptimeRatio : 1.0)
        .clamp(0.15, 1.0)
        .toDouble();

    return _barShape(color: color, fraction: fraction);
  }

  Widget _barShape({required Color color, required double fraction}) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: FractionallySizedBox(
        heightFactor: fraction,
        child: Container(
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.85),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
          ),
        ),
      ),
    );
  }
}
