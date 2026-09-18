import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../viewmodels/dashboard_viewmodel.dart';

class FilterBar extends StatelessWidget {
  final FilterStatus currentFilter;
  final ValueChanged<FilterStatus> onFilterChanged;
  final ValueChanged<String> onSearchChanged;

  const FilterBar({
    super.key,
    required this.currentFilter,
    required this.onFilterChanged,
    required this.onSearchChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          // Search input
          TextField(
            onChanged: onSearchChanged,
            decoration: InputDecoration(
              hintText: 'Search monitors by name or URL...',
              prefixIcon: const Icon(Icons.search, size: 20, color: AppTheme.textMuted),
              suffixIcon: IconButton(
                icon: const Icon(Icons.clear, size: 18, color: AppTheme.textMuted),
                onPressed: () => onSearchChanged(''),
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('All', FilterStatus.all),
                const SizedBox(width: 8),
                _buildFilterChip('Up', FilterStatus.up),
                const SizedBox(width: 8),
                _buildFilterChip('Down', FilterStatus.down),
                const SizedBox(width: 8),
                _buildFilterChip('Paused', FilterStatus.paused),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, FilterStatus filter) {
    final isSelected = currentFilter == filter;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => onFilterChanged(filter),
      showCheckmark: false,
    );
  }
}
