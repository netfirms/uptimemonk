import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../data/models/monitor.dart';
import '../data/models/live_state.dart';
import '../data/services/api_client.dart';

enum FilterStatus { all, up, down, paused }

class MonitorWithLiveState {
  final MonitorConfig config;
  final LiveState live;

  MonitorWithLiveState({required this.config, required this.live});
}

class DashboardViewModel extends ChangeNotifier {
  final String orgId;
  final ApiClient _apiClient = ApiClient();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  StreamSubscription? _monitorsSub;
  StreamSubscription? _statusSub;

  List<MonitorConfig> _monitors = [];
  Map<String, LiveState> _liveStates = {};

  FilterStatus _filter = FilterStatus.all;
  String _searchQuery = '';
  bool _isLoading = true;
  String? _errorMessage;

  List<MonitorConfig> get monitors => _monitors;
  Map<String, LiveState> get liveStates => _liveStates;
  FilterStatus get filter => _filter;
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  DashboardViewModel({required this.orgId}) {
    _startSubscriptions();
  }

  void _startSubscriptions() {
    _isLoading = true;
    notifyListeners();

    // 1. Monitors configuration stream
    _monitorsSub = _firestore
        .collection('monitors')
        .where('orgId', isEqualTo: orgId)
        .snapshots()
        .listen((snap) {
      _monitors = snap.docs.map((d) => MonitorConfig.fromFirestore(d.id, d.data())).toList();
      _monitors.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      _isLoading = false;
      notifyListeners();
    }, onError: (err) {
      _errorMessage = 'Lost connection to monitors';
      _isLoading = false;
      notifyListeners();
    });

    // 2. Org live state mirror stream
    _statusSub = _firestore.collection('orgStatus').doc(orgId).snapshots().listen((snap) {
      if (snap.exists && snap.data() != null) {
        final rawMap = snap.data()?['monitors'] as Map<String, dynamic>? ?? {};
        _liveStates = rawMap.map(
          (k, v) => MapEntry(k, LiveState.fromMap(v as Map<String, dynamic>)),
        );
        notifyListeners();
      }
    }, onError: (err) {
      debugPrint('Error listening to orgStatus: $err');
    });
  }

  void setFilter(FilterStatus filter) {
    _filter = filter;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  List<MonitorWithLiveState> get filteredMonitors {
    return _monitors
        .where((m) {
          // Search query check
          if (_searchQuery.isNotEmpty) {
            final query = _searchQuery.toLowerCase();
            final matchesName = m.name.toLowerCase().contains(query);
            final matchesTarget = m.target.toLowerCase().contains(query);
            if (!matchesName && !matchesTarget) return false;
          }

          // Status filter check
          final live = _liveStates[m.id] ?? LiveState(status: m.enabled ? 'pending' : 'paused');
          if (!m.enabled) {
            return _filter == FilterStatus.all || _filter == FilterStatus.paused;
          }

          switch (_filter) {
            case FilterStatus.all:
              return true;
            case FilterStatus.up:
              return live.status == 'up';
            case FilterStatus.down:
              return live.status == 'down';
            case FilterStatus.paused:
              return !m.enabled || live.status == 'paused';
          }
        })
        .map((m) => MonitorWithLiveState(
              config: m,
              live: _liveStates[m.id] ?? LiveState(status: m.enabled ? 'pending' : 'paused'),
            ))
        .toList();
  }

  // --- Summary Metrics ---
  int get totalCount => _monitors.length;

  int get upCount => _monitors.where((m) {
        if (!m.enabled) return false;
        final s = _liveStates[m.id]?.status;
        return s == 'up';
      }).length;

  int get downCount => _monitors.where((m) {
        if (!m.enabled) return false;
        final s = _liveStates[m.id]?.status;
        return s == 'down';
      }).length;

  int get pausedCount => _monitors.where((m) => !m.enabled).length;

  double get avgUptime24h {
    final active = _monitors.where((m) => m.enabled).toList();
    if (active.isEmpty) return 100.0;
    double total = 0.0;
    int counted = 0;
    for (final m in active) {
      final u = _liveStates[m.id]?.uptime24h;
      if (u != null) {
        total += u;
        counted++;
      }
    }
    return counted > 0 ? total / counted : 100.0;
  }

  // --- Actions ---
  Future<void> togglePause(MonitorConfig monitor) async {
    try {
      await _apiClient.togglePause(monitor.id);
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> deleteMonitor(String id) async {
    try {
      await _apiClient.deleteMonitor(id);
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _monitorsSub?.cancel();
    _statusSub?.cancel();
    super.dispose();
  }
}
