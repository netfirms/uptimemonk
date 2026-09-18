import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../data/models/monitor.dart';
import '../../data/services/api_client.dart';

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

  late String _type;
  late TextEditingController _nameController;
  late TextEditingController _targetController;
  late TextEditingController _portController;
  late TextEditingController _keywordController;
  late TextEditingController _dnsExpectedController;

  late int _intervalSeconds;
  late bool _publicOnStatusPage;
  late bool _muteAlerts;
  String _dnsRecordType = 'A';
  bool _keywordInverted = false;
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
    _dnsExpectedController = TextEditingController(text: m?.dnsExpectedValue ?? '');

    _intervalSeconds = m?.intervalSeconds ?? 60;
    _publicOnStatusPage = m?.publicOnStatusPage ?? false;
    _muteAlerts = m?.muteAlerts ?? false;
    _dnsRecordType = m?.dnsRecordType ?? 'A';
    _keywordInverted = m?.keywordInverted ?? false;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _targetController.dispose();
    _portController.dispose();
    _keywordController.dispose();
    _dnsExpectedController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final payload = <String, dynamic>{
      'type': _type,
      'name': _nameController.text.trim().isEmpty ? _targetController.text.trim() : _nameController.text.trim(),
      'target': _targetController.text.trim(),
      'intervalSeconds': _intervalSeconds,
      'publicOnStatusPage': _publicOnStatusPage,
      'muteAlerts': _muteAlerts,
    };

    if (_type == 'tcp') {
      payload['port'] = int.tryParse(_portController.text.trim()) ?? 80;
    } else if (_type == 'keyword') {
      payload['keyword'] = _keywordController.text.trim();
      payload['keywordInverted'] = _keywordInverted;
    } else if (_type == 'dns') {
      payload['dnsRecordType'] = _dnsRecordType;
      if (_dnsExpectedController.text.trim().isNotEmpty) {
        payload['dnsExpectedValue'] = _dnsExpectedController.text.trim();
      }
    }

    try {
      if (widget.existingMonitor != null) {
        await _apiClient.updateMonitor(widget.existingMonitor!.id, payload);
      } else {
        await _apiClient.createMonitor(payload);
      }

      if (mounted) {
        Navigator.pop(context, true);
      }
    } catch (e) {
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

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existingMonitor != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit Monitor' : 'New Monitor'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Protocol Selector
            const Text(
              'MONITOR TYPE',
              style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildTypeChip('HTTP', 'http'),
                  _buildTypeChip('Keyword', 'keyword'),
                  _buildTypeChip('TCP Port', 'tcp'),
                  _buildTypeChip('DNS', 'dns'),
                  _buildTypeChip('SSL Cert', 'ssl'),
                  _buildTypeChip('Heartbeat', 'heartbeat'),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Target URL or Host
            if (_type != 'heartbeat') ...[
              TextFormField(
                controller: _targetController,
                keyboardType: TextInputType.url,
                decoration: InputDecoration(
                  labelText: _type == 'tcp' || _type == 'dns' || _type == 'ssl'
                      ? 'Target Host / Domain'
                      : 'Target URL',
                  hintText: _type == 'tcp'
                      ? 'api.example.com'
                      : 'https://api.example.com/health',
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Target is required';
                  return null;
                },
              ),
              const SizedBox(height: 16),
            ],

            // Keyword Specific Fields
            if (_type == 'keyword') ...[
              TextFormField(
                controller: _keywordController,
                decoration: const InputDecoration(
                  labelText: 'Expected Keyword',
                  hintText: 'e.g. {"status":"ok"}',
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Keyword is required';
                  return null;
                },
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                title: const Text('Alert if keyword IS present (Inverted)', style: TextStyle(fontSize: 14)),
                value: _keywordInverted,
                activeColor: AppTheme.primaryEmerald,
                onChanged: (v) => setState(() => _keywordInverted = v),
              ),
              const SizedBox(height: 8),
            ],

            // TCP Port
            if (_type == 'tcp') ...[
              TextFormField(
                controller: _portController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Port Number',
                  hintText: 'e.g. 443, 80, 5432',
                ),
                validator: (v) {
                  final p = int.tryParse(v ?? '');
                  if (p == null || p < 1 || p > 65535) return 'Enter a valid port (1 - 65535)';
                  return null;
                },
              ),
              const SizedBox(height: 16),
            ],

            // DNS Specific Fields
            if (_type == 'dns') ...[
              DropdownButtonFormField<String>(
                value: _dnsRecordType,
                decoration: const InputDecoration(labelText: 'DNS Record Type'),
                dropdownColor: AppTheme.bgSurfaceElevated,
                items: ['A', 'AAAA', 'CNAME', 'MX', 'TXT'].map((t) {
                  return DropdownMenuItem(value: t, child: Text(t));
                }).toList(),
                onChanged: (v) => setState(() => _dnsRecordType = v ?? 'A'),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _dnsExpectedController,
                decoration: const InputDecoration(
                  labelText: 'Expected Substring (Optional)',
                  hintText: 'e.g. 192.0.2.1',
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Friendly Name
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Friendly Name',
                hintText: 'e.g. Production API Gateway',
              ),
            ),
            const SizedBox(height: 20),

            // Check Interval Selector
            const Text(
              'CHECK FREQUENCY',
              style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildIntervalChip('10s', 10),
                _buildIntervalChip('30s', 30),
                _buildIntervalChip('1m', 60),
                _buildIntervalChip('5m', 300),
              ],
            ),
            const SizedBox(height: 20),

            // Toggles (Public Status Page, Mute Alerts)
            SwitchListTile(
              title: const Text('Publish on Public Status Page', style: TextStyle(fontSize: 14)),
              subtitle: const Text('Show this monitor on your organization status page', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
              value: _publicOnStatusPage,
              activeColor: AppTheme.primaryEmerald,
              onChanged: (v) => setState(() => _publicOnStatusPage = v),
            ),
            SwitchListTile(
              title: const Text('Mute Alerts', style: TextStyle(fontSize: 14)),
              subtitle: const Text('Do not send downtime notifications for this monitor', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
              value: _muteAlerts,
              activeColor: AppTheme.primaryEmerald,
              onChanged: (v) => setState(() => _muteAlerts = v),
            ),
            const SizedBox(height: 30),

            // Submit Button
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                    )
                  : Text(isEdit ? 'Save Changes' : 'Create Monitor'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeChip(String label, String typeKey) {
    final isSelected = _type == typeKey;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => setState(() => _type = typeKey),
        showCheckmark: false,
      ),
    );
  }

  Widget _buildIntervalChip(String label, int seconds) {
    final isSelected = _intervalSeconds == seconds;
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: ChoiceChip(
          label: Center(child: Text(label)),
          selected: isSelected,
          onSelected: (_) => setState(() => _intervalSeconds = seconds),
          showCheckmark: false,
        ),
      ),
    );
  }
}
