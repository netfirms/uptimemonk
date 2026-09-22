import 'dart:async';

import 'package:flutter/material.dart';
import '../core/analytics.dart';
import '../data/models/history.dart';
import '../data/models/monitor.dart';
import '../data/services/api_client.dart';

class MonitorDetailViewModel extends ChangeNotifier {
  final MonitorConfig monitor;
  final ApiClient _apiClient = ApiClient();

  String _range = '24h';
  MonitorHistory? _history;
  bool _isLoading = false;
  String? _errorMessage;

  String get range => _range;
  MonitorHistory? get history => _history;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  MonitorDetailViewModel({required this.monitor}) {
    // Once per opening, not once per fetch: `fetchHistory` also runs on every
    // range switch and pull-to-refresh, and counting those would turn "people
    // opened history" into "people changed the time range", which is a
    // different question with a much larger number.
    unawaited(AnalyticsEvents.historyViewed(monitor.type));
    fetchHistory();
  }

  Future<void> setRange(String newRange) async {
    if (_range == newRange) return;
    _range = newRange;
    await fetchHistory();
  }

  Future<void> fetchHistory() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _history = await _apiClient.fetchHistory(monitor.id, range: _range);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> deleteMonitor() async {
    try {
      await _apiClient.deleteMonitor(monitor.id);
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> togglePause() async {
    try {
      await _apiClient.togglePause(monitor.id);
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}
