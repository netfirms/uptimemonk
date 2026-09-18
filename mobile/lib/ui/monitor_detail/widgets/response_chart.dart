import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../data/models/history.dart';

class ResponseChart extends StatelessWidget {
  final MonitorHistory history;
  final String activeRange;
  final ValueChanged<String> onRangeSelected;

  const ResponseChart({
    super.key,
    required this.history,
    required this.activeRange,
    required this.onRangeSelected,
  });

  @override
  Widget build(BuildContext context) {
    final points = history.points;
    final buckets = history.buckets;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with Range Selector
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'RESPONSE TIME',
                style: TextStyle(
                  color: AppTheme.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              Row(
                children: ['24h', '7d', '30d', '90d'].map((r) {
                  final isSelected = activeRange == r;
                  return Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: InkWell(
                      onTap: () => onRangeSelected(r),
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.primaryEmerald.withValues(alpha: 0.2) : Colors.transparent,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isSelected ? AppTheme.primaryEmerald : AppTheme.borderDark,
                          ),
                        ),
                        child: Text(
                          r,
                          style: TextStyle(
                            color: isSelected ? AppTheme.primaryEmerald : AppTheme.textMuted,
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Summary Stats
          Row(
            children: [
              if (history.summary['avgMs'] != null)
                _buildMetric(
                  'AVG LATENCY',
                  '${(history.summary['avgMs'] as num).toInt()} ms',
                  AppTheme.accentCyan,
                ),
              const SizedBox(width: 24),
              if (history.summary['checks'] != null)
                _buildMetric(
                  'CHECKS',
                  '${history.summary['checks']}',
                  AppTheme.textPrimary,
                ),
            ],
          ),
          const SizedBox(height: 16),
          // FL Chart
          SizedBox(
            height: 180,
            child: points.isNotEmpty
                ? LineChart(_buildLineChartData(points))
                : buckets.isNotEmpty
                    ? LineChart(_buildBucketChartData(buckets))
                    : const Center(
                        child: Text(
                          'No telemetry data available for this range',
                          style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetric(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: AppTheme.textMuted, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
      ],
    );
  }

  LineChartData _buildLineChartData(List<HistoryPoint> points) {
    final spots = <FlSpot>[];
    for (int i = 0; i < points.length; i++) {
      spots.add(FlSpot(i.toDouble(), points[i].ms));
    }

    return LineChartData(
      gridData: FlGridData(
        show: true,
        drawVerticalLine: false,
        getDrawingHorizontalLine: (value) => const FlLine(color: AppTheme.borderDark, strokeWidth: 1),
      ),
      titlesData: const FlTitlesData(
        leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
        topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      borderData: FlBorderData(show: false),
      lineBarsData: [
        LineChartBarData(
          spots: spots,
          isCurved: true,
          color: AppTheme.accentCyan,
          barWidth: 2,
          isStrokeCapRound: true,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(
            show: true,
            gradient: LinearGradient(
              colors: [
                AppTheme.accentCyan.withValues(alpha: 0.3),
                AppTheme.accentCyan.withValues(alpha: 0.0),
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
      ],
      lineTouchData: LineTouchData(
        touchTooltipData: LineTouchTooltipData(
          getTooltipItems: (touchedSpots) {
            return touchedSpots.map((s) {
              return LineTooltipItem(
                '${s.y.toInt()} ms',
                const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
              );
            }).toList();
          },
        ),
      ),
    );
  }

  LineChartData _buildBucketChartData(List<Bucket> buckets) {
    final spots = <FlSpot>[];
    for (int i = 0; i < buckets.length; i++) {
      spots.add(FlSpot(i.toDouble(), buckets[i].avgMs));
    }

    return LineChartData(
      gridData: FlGridData(
        show: true,
        drawVerticalLine: false,
        getDrawingHorizontalLine: (value) => const FlLine(color: AppTheme.borderDark, strokeWidth: 1),
      ),
      titlesData: const FlTitlesData(
        leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
        topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      borderData: FlBorderData(show: false),
      lineBarsData: [
        LineChartBarData(
          spots: spots,
          isCurved: true,
          color: AppTheme.primaryEmerald,
          barWidth: 2,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(
            show: true,
            gradient: LinearGradient(
              colors: [
                AppTheme.primaryEmerald.withValues(alpha: 0.3),
                AppTheme.primaryEmerald.withValues(alpha: 0.0),
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
      ],
    );
  }
}
