import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/analytics.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../data/models/alert_contact.dart';
import '../../data/models/monitor.dart';
import '../../data/services/api_client.dart';

class MonitorTypeOption {
  final String type;
  final String label;
  final String shortLabel;
  final String hint;
  final String defaultTarget;
  final String desc;
  final IconData icon;

  const MonitorTypeOption({
    required this.type,
    required this.label,
    required this.shortLabel,
    required this.hint,
    required this.defaultTarget,
    required this.desc,
    required this.icon,
  });
}

const List<MonitorTypeOption> kMonitorTypeOptions = [
  MonitorTypeOption(
    type: 'http',
    label: 'Website (HTTP)',
    shortLabel: 'HTTP',
    hint: 'https://example.com',
    defaultTarget: 'https://',
    desc: 'Checks status code 2xx/3xx',
    icon: Icons.language,
  ),
  MonitorTypeOption(
    type: 'ssl',
    label: 'SSL Certificate',
    shortLabel: 'SSL',
    hint: 'example.com',
    defaultTarget: '',
    desc: 'Warns before certificate expiry',
    icon: Icons.security,
  ),
  MonitorTypeOption(
    type: 'keyword',
    label: 'Keyword Check',
    shortLabel: 'Keyword',
    hint: 'https://example.com',
    defaultTarget: 'https://',
    desc: 'Verifies expected text is present',
    icon: Icons.search,
  ),
  MonitorTypeOption(
    type: 'icmp',
    label: 'Ping (ICMP)',
    shortLabel: 'Ping',
    hint: '1.1.1.1 or example.com',
    defaultTarget: '',
    desc: 'Network latency & packet drop',
    icon: Icons.network_ping,
  ),
  MonitorTypeOption(
    type: 'tcp',
    label: 'Port (TCP)',
    shortLabel: 'Port',
    hint: 'example.com',
    defaultTarget: '',
    desc: 'Checks connectivity on custom port',
    icon: Icons.router_outlined,
  ),
  MonitorTypeOption(
    type: 'dns',
    label: 'DNS Record',
    shortLabel: 'DNS',
    hint: 'example.com',
    defaultTarget: '',
    desc: 'Monitors DNS lookup & resolution',
    icon: Icons.alt_route,
  ),
  MonitorTypeOption(
    type: 'heartbeat',
    label: 'Cron Heartbeat',
    shortLabel: 'Heartbeat',
    hint: 'No target needed',
    defaultTarget: '',
    desc: 'Alerts if cron job fails to ping',
    icon: Icons.favorite_border,
  ),
];

class IntervalOption {
  final String label;
  final int seconds;
  const IntervalOption(this.label, this.seconds);
}

const List<IntervalOption> kIntervalOptions = [
  IntervalOption('5 sec', 5),
  IntervalOption('30 sec', 30),
  IntervalOption('1 min', 60),
  IntervalOption('5 min', 300),
  IntervalOption('15 min', 900),
  IntervalOption('1 hour', 3600),
];

class MonitorFormScreen extends StatefulWidget {
  final MonitorConfig? existingMonitor;
  final String? initialTarget;
  final String? initialType;

  const MonitorFormScreen({
    super.key,
    this.existingMonitor,
    this.initialTarget,
    this.initialType,
  });

  @override
  State<MonitorFormScreen> createState() => _MonitorFormScreenState();
}

class _MonitorFormScreenState extends State<MonitorFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _apiClient = ApiClient();

  // Basic fields
  late String _type;
  late TextEditingController _nameController;
  late TextEditingController _targetController;
  late TextEditingController _portController;
  late TextEditingController _keywordController;
  late int _intervalSeconds;
  late bool _publicOnStatusPage;
  late bool _muteAlerts;
  List<int> _certAlertDays = [30, 14, 7, 1];

  // Contacts
  List<AlertContact> _contacts = [];
  List<String> _contactIds = [];
  bool _isLoadingContacts = true;

  // Plan limits
  int _minIntervalSeconds = 60;
  String? _planLabel;

  // Advanced Options
  bool _showAdvanced = false;
  String _method = 'GET';
  late TextEditingController _maxResponseTimeController;
  bool _keywordRegex = false;
  late TextEditingController _jsonPathController;
  late TextEditingController _jsonPathExpectedController;

  late TextEditingController _sslExpiryWarningController;
  String _sslMinVersion = 'none';
  late TextEditingController _sslFingerprintController;

  late TextEditingController _tcpPayloadController;
  late TextEditingController _tcpExpectedResponseController;

  String _dnsRecordType = 'A';
  late TextEditingController _dnsExpectedController;
  late TextEditingController _dnsServerController;

  int _icmpPacketCount = 3;
  late TextEditingController _icmpMaxLossController;

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final m = widget.existingMonitor;

    _type = m?.type ?? widget.initialType ?? 'http';
    _nameController = TextEditingController(text: m?.name ?? '');
    _targetController = TextEditingController(text: m?.target ?? widget.initialTarget ?? '');
    _portController = TextEditingController(text: m?.port?.toString() ?? '443');
    _keywordController = TextEditingController(text: m?.keyword ?? '');
    _intervalSeconds = m?.intervalSeconds ?? 300;
    _publicOnStatusPage = m?.publicOnStatusPage ?? false;
    _muteAlerts = m?.muteAlerts ?? false;
    _certAlertDays = m?.sslExpiryAlertDays ?? [30, 14, 7, 1];
    _contactIds = List.from(m?.alertContactIds ?? []);

    // Advanced fields
    _method = m?.method ?? (_type == 'keyword' ? 'GET' : 'HEAD');
    _maxResponseTimeController = TextEditingController(
      text: m?.maxResponseTimeMs != null ? m!.maxResponseTimeMs.toString() : '',
    );
    _keywordRegex = m?.keywordRegex ?? false;
    _jsonPathController = TextEditingController(text: m?.jsonPath ?? '');
    _jsonPathExpectedController = TextEditingController(text: m?.jsonPathExpected ?? '');

    _sslExpiryWarningController = TextEditingController(
      text: (m?.sslExpiryWarningDays ?? 14).toString(),
    );
    _sslMinVersion = m?.sslMinVersion ?? 'none';
    _sslFingerprintController = TextEditingController(text: m?.sslExpectedFingerprint ?? '');

    _tcpPayloadController = TextEditingController(text: m?.tcpPayload ?? '');
    _tcpExpectedResponseController = TextEditingController(text: m?.tcpExpectedResponse ?? '');

    _dnsRecordType = m?.dnsRecordType ?? 'A';
    _dnsExpectedController = TextEditingController(text: m?.dnsExpectedValue ?? '');
    _dnsServerController = TextEditingController(text: m?.dnsServer ?? '');

    _icmpPacketCount = m?.icmpPacketCount ?? 3;
    _icmpMaxLossController = TextEditingController(
      text: (m?.icmpMaxLossPercent ?? 50).toString(),
    );

    _loadMetadata();
  }

  Future<void> _loadMetadata() async {
    // 1. Load contacts
    try {
      final list = await _apiClient.fetchContacts();
      if (mounted) {
        setState(() {
          _contacts = list.where((c) => c.verified && c.enabled).toList();
          _isLoadingContacts = false;
        });
      }
    } catch (e) {
      debugPrint('Failed to load contacts: $e');
      if (mounted) setState(() => _isLoadingContacts = false);
    }

    // 2. Load workspace plan limits
    try {
      final me = await _apiClient.fetchMe();
      if (mounted && me['limits'] is Map) {
        final limits = me['limits'] as Map<String, dynamic>;
        setState(() {
          _minIntervalSeconds = (limits['minIntervalSeconds'] as num?)?.toInt() ?? 60;
          _planLabel = limits['label'] as String?;
          if (_intervalSeconds < _minIntervalSeconds) {
            _intervalSeconds = _minIntervalSeconds;
          }
        });
      }
    } catch (e) {
      debugPrint('Failed to load user limits: $e');
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _targetController.dispose();
    _portController.dispose();
    _keywordController.dispose();
    _maxResponseTimeController.dispose();
    _jsonPathController.dispose();
    _jsonPathExpectedController.dispose();
    _sslExpiryWarningController.dispose();
    _sslFingerprintController.dispose();
    _tcpPayloadController.dispose();
    _tcpExpectedResponseController.dispose();
    _dnsExpectedController.dispose();
    _dnsServerController.dispose();
    _icmpMaxLossController.dispose();
    super.dispose();
  }

  MonitorTypeOption get _selectedOption =>
      kMonitorTypeOptions.firstWhere((o) => o.type == _type, orElse: () => kMonitorTypeOptions[0]);

  String _formatInterval(int seconds) {
    if (seconds < 60) return '$seconds seconds';
    if (seconds < 3600) return '${seconds ~/ 60} minute${seconds == 60 ? "" : "s"}';
    return '${seconds ~/ 3600} hour${seconds == 3600 ? "" : "s"}';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final needsTarget = _type != 'heartbeat';
    final target = _targetController.text.trim();
    final name = _nameController.text.trim().isNotEmpty
        ? _nameController.text.trim()
        : (needsTarget && target.isNotEmpty ? target : _selectedOption.label);

    final payload = <String, dynamic>{
      'type': _type,
      'name': name,
      'target': needsTarget ? target : '',
      'intervalSeconds': _intervalSeconds,
      'publicOnStatusPage': _publicOnStatusPage,
      'muteAlerts': _muteAlerts,
      'alertContactIds': _contactIds,
    };

    if (_type == 'ssl') {
      payload['sslExpiryAlertDays'] = _certAlertDays;
      final warnDays = int.tryParse(_sslExpiryWarningController.text.trim()) ?? 14;
      payload['sslExpiryWarningDays'] = warnDays;
      if (_sslMinVersion != 'none') payload['sslMinVersion'] = _sslMinVersion;
      if (_sslFingerprintController.text.trim().isNotEmpty) {
        payload['sslExpectedFingerprint'] = _sslFingerprintController.text.trim();
      }
    }

    if (_type == 'keyword') {
      payload['keyword'] = _keywordController.text.trim();
      payload['keywordRegex'] = _keywordRegex;
      if (_jsonPathController.text.trim().isNotEmpty) {
        payload['jsonPath'] = _jsonPathController.text.trim();
      }
      if (_jsonPathExpectedController.text.trim().isNotEmpty) {
        payload['jsonPathExpected'] = _jsonPathExpectedController.text.trim();
      }
    }

    if (_type == 'tcp') {
      payload['port'] = int.tryParse(_portController.text.trim()) ?? 443;
      if (_tcpPayloadController.text.trim().isNotEmpty) {
        payload['tcpPayload'] = _tcpPayloadController.text.trim();
      }
      if (_tcpExpectedResponseController.text.trim().isNotEmpty) {
        payload['tcpExpectedResponse'] = _tcpExpectedResponseController.text.trim();
      }
    }

    if (_type == 'dns') {
      payload['dnsRecordType'] = _dnsRecordType;
      if (_dnsExpectedController.text.trim().isNotEmpty) {
        payload['dnsExpectedValue'] = _dnsExpectedController.text.trim();
      }
      if (_dnsServerController.text.trim().isNotEmpty) {
        payload['dnsServer'] = _dnsServerController.text.trim();
      }
    }

    if (_type == 'icmp') {
      payload['icmpPacketCount'] = _icmpPacketCount;
      payload['icmpMaxLossPercent'] = int.tryParse(_icmpMaxLossController.text.trim()) ?? 50;
    }

    if (_type == 'http' || _type == 'keyword') {
      payload['method'] = _method;
    }

    final maxMs = int.tryParse(_maxResponseTimeController.text.trim());
    if (maxMs != null && maxMs > 0) {
      payload['maxResponseTimeMs'] = maxMs;
    }

    try {
      if (widget.existingMonitor != null) {
        await _apiClient.updateMonitor(widget.existingMonitor!.id, payload);
        unawaited(AnalyticsEvents.monitorEdited(_type));
        if (mounted) Navigator.pop(context, true);
      } else {
        final res = await _apiClient.createMonitor(payload);
        unawaited(AnalyticsEvents.monitorCreated(_type, _intervalSeconds));
        if (mounted) {
          final heartbeatToken = res['heartbeatToken'] as String?;
          if (_type == 'heartbeat' && heartbeatToken != null && heartbeatToken.isNotEmpty) {
            await _showHeartbeatSuccessDialog(name, heartbeatToken);
          }
          if (mounted) Navigator.pop(context, true);
        }
      }
    } catch (e) {
      unawaited(AnalyticsEvents.actionFailed(
        widget.existingMonitor != null ? 'edit_monitor' : 'create_monitor',
        e is ApiException ? e.statusCode : null,
      ));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.statusDown,
            content: Text(e.toString()),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _showHeartbeatSuccessDialog(String name, String token) async {
    final ingestUrl = '${AppConstants.apiUrl}/heartbeat/$token';
    final curlCmd = 'curl -fsS -m 10 $ingestUrl';

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: AppTheme.bgSurface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.statusUp.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle, color: AppTheme.statusUp, size: 24),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Cron Heartbeat Created!',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your heartbeat monitor $name is live and waiting for its first check-in.',
                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 16),
                const Text(
                  'PING INGEST URL',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.black26,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.borderDark),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: SelectableText(
                          ingestUrl,
                          style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppTheme.accentCyan),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy, size: 18, color: AppTheme.textSecondary),
                        tooltip: 'Copy URL',
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: ingestUrl));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Heartbeat URL copied to clipboard!')),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'cURL Example',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.black26,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.borderDark),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: SelectableText(
                          curlCmd,
                          style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: AppTheme.textMuted),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy, size: 16, color: AppTheme.textSecondary),
                        tooltip: 'Copy cURL Command',
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: curlCmd));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('cURL command copied!')),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryEmerald,
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Done / Return to Dashboard'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existingMonitor != null;
    final needsTarget = _type != 'heartbeat';
    final needsPort = _type == 'tcp';
    final needsKeyword = _type == 'keyword';

    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit Monitor' : 'New Monitor'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // 1. Protocol Grid
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'MONITOR TYPE',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
                ),
                if (isEdit)
                  const Text(
                    'Locked during edit',
                    style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontStyle: FontStyle.italic),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            _buildTypeGrid(isEdit),
            const SizedBox(height: 6),
            Text(
              isEdit
                  ? "Protocol is fixed for an existing monitor — its history wouldn't be comparable."
                  : _selectedOption.desc,
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
            ),
            const SizedBox(height: 18),

            // 2. Target URL / Host
            if (needsTarget) ...[
              TextFormField(
                controller: _targetController,
                keyboardType: TextInputType.url,
                decoration: InputDecoration(
                  labelText: _type == 'http' || _type == 'keyword'
                      ? 'Target URL'
                      : 'Target Host / Domain / IP',
                  hintText: _selectedOption.hint,
                  prefixIcon: Icon(_selectedOption.icon, size: 20, color: AppTheme.accentCyan),
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Target is required';
                  return null;
                },
              ),
              const SizedBox(height: 16),
            ],

            // 3. Keyword input
            if (needsKeyword) ...[
              TextFormField(
                controller: _keywordController,
                decoration: const InputDecoration(
                  labelText: 'Expected Keyword / Substring',
                  hintText: 'e.g. {"status":"ok"} or Welcome',
                  prefixIcon: Icon(Icons.search, size: 20, color: AppTheme.accentCyan),
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Keyword is required';
                  return null;
                },
              ),
              const SizedBox(height: 16),
            ],

            // 4. TCP Port
            if (needsPort) ...[
              TextFormField(
                controller: _portController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Port Number',
                  hintText: 'e.g. 443, 80, 5432, 22',
                  prefixIcon: Icon(Icons.numbers, size: 20, color: AppTheme.accentCyan),
                ),
                validator: (v) {
                  final p = int.tryParse(v ?? '');
                  if (p == null || p < 1 || p > 65535) return 'Enter a valid port (1 - 65535)';
                  return null;
                },
              ),
              const SizedBox(height: 16),
            ],

            // 5. Friendly Name
            TextFormField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: 'Friendly Name',
                hintText: _targetController.text.trim().isNotEmpty
                    ? _targetController.text.trim()
                    : 'e.g. Production API Gateway',
                prefixIcon: const Icon(Icons.label_outline, size: 20, color: AppTheme.textSecondary),
              ),
            ),
            const SizedBox(height: 20),

            // 6. Check Frequency Chips
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'CHECK FREQUENCY',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
                ),
                if (_planLabel != null)
                  Text(
                    'Plan: $_planLabel (${_formatInterval(_minIntervalSeconds)} min floor)',
                    style: const TextStyle(color: AppTheme.accentCyan, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: kIntervalOptions.map((opt) {
                final isBelowFloor = opt.seconds < _minIntervalSeconds;
                final isSelected = _intervalSeconds == opt.seconds;

                return ChoiceChip(
                  label: Text(opt.label),
                  selected: isSelected,
                  selectedColor: AppTheme.primaryEmerald,
                  backgroundColor: isBelowFloor ? AppTheme.bgSurface.withValues(alpha: 0.5) : AppTheme.bgSurface,
                  labelStyle: TextStyle(
                    color: isSelected
                        ? Colors.black
                        : (isBelowFloor ? AppTheme.textMuted.withValues(alpha: 0.5) : Colors.white),
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    fontSize: 12,
                  ),
                  showCheckmark: false,
                  onSelected: isBelowFloor
                      ? null
                      : (_) => setState(() => _intervalSeconds = opt.seconds),
                );
              }).toList(),
            ),
            const SizedBox(height: 6),
            Text(
              _minIntervalSeconds > 5
                  ? 'Faster intervals need an upgrade — the current plan checks every ${_formatInterval(_minIntervalSeconds)} at most.'
                  : 'Sub-minute checks running from the edge probe fleet.',
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
            ),
            const SizedBox(height: 20),

            // 7. SSL Expiry Alert Days (if SSL)
            if (_type == 'ssl') ...[
              const Text(
                'WARN ME BEFORE CERTIFICATE EXPIRES',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [60, 30, 14, 7, 3, 1].map((days) {
                  final isSelected = _certAlertDays.contains(days);
                  return FilterChip(
                    label: Text(days == 1 ? '1 day' : '$days days'),
                    selected: isSelected,
                    selectedColor: AppTheme.primaryEmerald,
                    backgroundColor: AppTheme.bgSurface,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.black : Colors.white,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      fontSize: 12,
                    ),
                    showCheckmark: false,
                    onSelected: (selected) {
                      setState(() {
                        if (selected) {
                          _certAlertDays.add(days);
                          _certAlertDays.sort((a, b) => b.compareTo(a));
                        } else {
                          _certAlertDays.remove(days);
                        }
                      });
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 6),
              const Text(
                'Each fires once, and a renewal resets them. Expiring certificates do not mark the monitor down.',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
              ),
              const SizedBox(height: 20),
            ],

            // 8. Alert Contacts Picker
            _buildContactsPicker(),
            const SizedBox(height: 16),

            // 9. Toggles
            Container(
              decoration: BoxDecoration(
                color: AppTheme.bgSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.borderDark),
              ),
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Publish on Public Status Page', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Show this monitor on your organization public status page', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                    value: _publicOnStatusPage,
                    activeThumbColor: AppTheme.primaryEmerald,
                    onChanged: (v) => setState(() => _publicOnStatusPage = v),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    title: const Text('Mute Alerts', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Do not send downtime notifications for this monitor', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                    value: _muteAlerts,
                    activeThumbColor: AppTheme.primaryEmerald,
                    onChanged: (v) => setState(() => _muteAlerts = v),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // 10. Advanced Configuration Accordion
            _buildAdvancedAccordion(),
            const SizedBox(height: 28),

            // 11. Submit Button
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryEmerald,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.black),
                    )
                  : Text(
                      isEdit ? 'Save Changes' : 'Create Monitor',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeGrid(bool isEdit) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: kMonitorTypeOptions.map((opt) {
            final isSelected = _type == opt.type;
            final isLocked = isEdit && !isSelected;

            return InkWell(
              onTap: isEdit
                  ? null
                  : () {
                      setState(() {
                        _type = opt.type;
                        if (_targetController.text.isEmpty && opt.defaultTarget.isNotEmpty) {
                          _targetController.text = opt.defaultTarget;
                        }
                      });
                    },
              borderRadius: BorderRadius.circular(10),
              child: Opacity(
                opacity: isLocked ? 0.35 : 1.0,
                child: Container(
                  width: (constraints.maxWidth - 24) / 4,
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppTheme.primaryEmerald.withValues(alpha: 0.15)
                        : AppTheme.bgSurface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isSelected ? AppTheme.primaryEmerald : AppTheme.borderDark,
                      width: isSelected ? 1.5 : 1.0,
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        opt.icon,
                        size: 22,
                        color: isSelected ? AppTheme.primaryEmerald : AppTheme.textSecondary,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        opt.shortLabel,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          color: isSelected ? AppTheme.primaryEmerald : Colors.white,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }

  Widget _buildContactsPicker() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ALERT CONTACTS',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
              ),
              Text(
                _contactIds.isEmpty
                    ? 'All confirmed contacts'
                    : '${_contactIds.length} contact${_contactIds.length == 1 ? "" : "s"} chosen',
                style: const TextStyle(color: AppTheme.accentCyan, fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (_isLoadingContacts)
            const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator(strokeWidth: 2)))
          else if (_contacts.isEmpty)
            const Text(
              'No confirmed contacts found. Contacts can be added under Settings & Notifications.',
              style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
            )
          else ...[
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('All Confirmed Contacts', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text(
                'Alert all ${_contacts.length} confirmed contact${_contacts.length == 1 ? "" : "s"}, including any added later.',
                style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
              ),
              value: _contactIds.isEmpty,
              activeColor: AppTheme.primaryEmerald,
              onChanged: (checked) {
                setState(() {
                  _contactIds = (checked == true) ? [] : _contacts.map((c) => c.id).toList();
                });
              },
            ),
            if (_contactIds.isNotEmpty) ...[
              const Divider(height: 12),
              ..._contacts.map((c) {
                final isSelected = _contactIds.contains(c.id);
                return CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(c.name.isNotEmpty ? c.name : c.destination, style: const TextStyle(fontSize: 13)),
                  subtitle: Text('${c.channel.toUpperCase()} · ${c.destination}', style: const TextStyle(color: AppTheme.textMuted, fontSize: 11)),
                  value: isSelected,
                  activeColor: AppTheme.primaryEmerald,
                  onChanged: (checked) {
                    setState(() {
                      if (checked == true) {
                        _contactIds.add(c.id);
                      } else {
                        _contactIds.remove(c.id);
                      }
                    });
                  },
                );
              }),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildAdvancedAccordion() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        children: [
          ListTile(
            title: Text(
              '⚙️ Advanced Options (${_selectedOption.label})',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            ),
            trailing: Icon(
              _showAdvanced ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
              color: AppTheme.textSecondary,
            ),
            onTap: () => setState(() => _showAdvanced = !_showAdvanced),
          ),
          if (_showAdvanced)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(height: 1),
                  const SizedBox(height: 14),

                  // HTTP & Keyword Advanced
                  if (_type == 'http' || _type == 'keyword') ...[
                    DropdownButtonFormField<String>(
                      initialValue: _method,
                      decoration: const InputDecoration(labelText: 'HTTP Method'),
                      dropdownColor: AppTheme.bgSurfaceElevated,
                      items: [
                        const DropdownMenuItem(value: 'GET', child: Text('GET (Standard)')),
                        if (_type == 'http')
                          const DropdownMenuItem(value: 'HEAD', child: Text('HEAD (Fast, No Body)')),
                        const DropdownMenuItem(value: 'POST', child: Text('POST')),
                        const DropdownMenuItem(value: 'PUT', child: Text('PUT')),
                        const DropdownMenuItem(value: 'PATCH', child: Text('PATCH')),
                        const DropdownMenuItem(value: 'DELETE', child: Text('DELETE')),
                        if (_type == 'http')
                          const DropdownMenuItem(value: 'OPTIONS', child: Text('OPTIONS')),
                      ],
                      onChanged: (v) => setState(() => _method = v ?? 'GET'),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _maxResponseTimeController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Response Time SLA Threshold (ms)',
                        hintText: 'e.g. 2500 (blank = default timeout)',
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Alerts if response time exceeds this threshold, even if HTTP status is 200 OK.',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 11),
                    ),
                    const SizedBox(height: 14),
                  ],

                  // Keyword Advanced
                  if (_type == 'keyword') ...[
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Regular Expression (Regex)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                      subtitle: const Text('Evaluates keyword as a regex pattern (e.g. /v[0-9]+\\.[0-9]+/i)', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
                      value: _keywordRegex,
                      activeThumbColor: AppTheme.primaryEmerald,
                      onChanged: (v) => setState(() => _keywordRegex = v),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _jsonPathController,
                      decoration: const InputDecoration(
                        labelText: 'JSON Path Assertion (Optional)',
                        hintText: 'e.g. status or services.database.healthy',
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Validates API response JSON property directly without full HTML scanning.',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 11),
                    ),
                    const SizedBox(height: 14),
                    if (_jsonPathController.text.trim().isNotEmpty) ...[
                      TextFormField(
                        controller: _jsonPathExpectedController,
                        decoration: const InputDecoration(
                          labelText: 'Expected JSON Value',
                          hintText: 'e.g. ok or true or 1',
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],
                  ],

                  // SSL Advanced
                  if (_type == 'ssl') ...[
                    TextFormField(
                      controller: _sslExpiryWarningController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Expiry Warning Window (Days)',
                        hintText: 'e.g. 14',
                      ),
                    ),
                    const SizedBox(height: 14),
                    DropdownButtonFormField<String>(
                      initialValue: _sslMinVersion,
                      decoration: const InputDecoration(labelText: 'Minimum TLS Protocol Version'),
                      dropdownColor: AppTheme.bgSurfaceElevated,
                      items: const [
                        DropdownMenuItem(value: 'none', child: Text('Any Supported TLS Version')),
                        DropdownMenuItem(value: 'TLSv1.2', child: Text('Enforce TLS 1.2+ (Reject TLS 1.0/1.1)')),
                        DropdownMenuItem(value: 'TLSv1.3', child: Text('Enforce TLS 1.3 Only')),
                      ],
                      onChanged: (v) => setState(() => _sslMinVersion = v ?? 'none'),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _sslFingerprintController,
                      decoration: const InputDecoration(
                        labelText: 'Certificate SHA-256 Fingerprint Pinning',
                        hintText: 'e.g. AA:BB:CC:... (Hex SHA-256)',
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Alerts immediately if the certificate fingerprint changes.',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 11),
                    ),
                  ],

                  // TCP Advanced
                  if (_type == 'tcp') ...[
                    TextFormField(
                      controller: _tcpPayloadController,
                      decoration: const InputDecoration(
                        labelText: 'Send Payload / Handshake String (Optional)',
                        hintText: 'e.g. PING\\r\\n or EHLO domain\\r\\n',
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _tcpExpectedResponseController,
                      decoration: const InputDecoration(
                        labelText: 'Expected Response Banner (Optional)',
                        hintText: 'e.g. +PONG, 220, or SSH-2.0-',
                      ),
                    ),
                  ],

                  // DNS Advanced
                  if (_type == 'dns') ...[
                    DropdownButtonFormField<String>(
                      initialValue: _dnsRecordType,
                      decoration: const InputDecoration(labelText: 'DNS Record Type'),
                      dropdownColor: AppTheme.bgSurfaceElevated,
                      items: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA', 'SOA', 'PTR', 'SRV'].map((rt) {
                        return DropdownMenuItem(value: rt, child: Text('$rt Record'));
                      }).toList(),
                      onChanged: (v) => setState(() => _dnsRecordType = v ?? 'A'),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _dnsExpectedController,
                      decoration: const InputDecoration(
                        labelText: 'Expected Value or Substring',
                        hintText: 'e.g. 192.0.2.1 or v=spf1',
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _dnsServerController,
                      decoration: const InputDecoration(
                        labelText: 'Custom Nameserver / Resolver IP (Optional)',
                        hintText: 'e.g. 1.1.1.1, 8.8.8.8',
                      ),
                    ),
                  ],

                  // ICMP Advanced
                  if (_type == 'icmp') ...[
                    DropdownButtonFormField<int>(
                      initialValue: _icmpPacketCount,
                      decoration: const InputDecoration(labelText: 'Ping Packet Train Count'),
                      dropdownColor: AppTheme.bgSurfaceElevated,
                      items: const [
                        DropdownMenuItem(value: 1, child: Text('1 Packet (Fastest)')),
                        DropdownMenuItem(value: 3, child: Text('3 Packets (Recommended, measures loss %)')),
                        DropdownMenuItem(value: 5, child: Text('5 Packets (High precision)')),
                      ],
                      onChanged: (v) => setState(() => _icmpPacketCount = v ?? 3),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _icmpMaxLossController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Max Tolerable Packet Loss (%)',
                        hintText: 'e.g. 50',
                      ),
                    ),
                  ],

                  // Heartbeat Advanced (for existing monitors)
                  if (_type == 'heartbeat' && widget.existingMonitor?.heartbeatToken != null) ...[
                    const Text(
                      'ACTIVE HEARTBEAT INGEST URL',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.black26,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.borderDark),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: SelectableText(
                              '${AppConstants.apiUrl}/heartbeat/${widget.existingMonitor!.heartbeatToken}',
                              style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppTheme.accentCyan),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.copy, size: 18, color: AppTheme.textSecondary),
                            tooltip: 'Copy URL',
                            onPressed: () {
                              Clipboard.setData(
                                ClipboardData(
                                  text: '${AppConstants.apiUrl}/heartbeat/${widget.existingMonitor!.heartbeatToken}',
                                ),
                              );
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Heartbeat URL copied to clipboard!')),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}
