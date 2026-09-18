import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../data/models/alert_contact.dart';
import '../../data/services/api_client.dart';
import '../../viewmodels/auth_viewmodel.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _apiClient = ApiClient();
  List<AlertContact> _contacts = [];
  bool _isLoading = true;
  bool _isTesting = false;

  @override
  void initState() {
    super.initState();
    _loadContacts();
  }

  Future<void> _loadContacts() async {
    setState(() => _isLoading = true);
    try {
      final list = await _apiClient.fetchContacts();
      if (mounted) setState(() => _contacts = list);
    } catch (e) {
      debugPrint('Failed to load contacts: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _testAlert(AlertContact c) async {
    setState(() => _isTesting = true);
    try {
      await _apiClient.testContact(c.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.statusUp,
            content: Text('Test alert sent to ${c.name.isNotEmpty ? c.name : c.destination}'),
          ),
        );
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
      if (mounted) setState(() => _isTesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authVm = Provider.of<AuthViewModel>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings & Notifications'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Account Box
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.bgSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.borderDark),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ACCOUNT & WORKSPACE',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Icon(Icons.account_circle_outlined, size: 24, color: AppTheme.accentCyan),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            authVm.user?.email ?? 'Logged In User',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Org: ${authVm.orgId ?? "Loading..."}',
                            style: const TextStyle(color: AppTheme.textMuted, fontSize: 12, fontFamily: 'monospace'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Push Notifications Box
          Container(
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
                      'MOBILE PUSH ALERTS',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.statusUp.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.check_circle, size: 12, color: AppTheme.statusUp),
                          SizedBox(width: 4),
                          Text(
                            'FCM Active',
                            style: TextStyle(color: AppTheme.statusUp, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'High-priority notifications delivered directly to this device through Firebase Cloud Messaging.',
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Alert Destinations List
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.bgSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.borderDark),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ALERT DESTINATIONS',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                if (_isLoading)
                  const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: AppTheme.primaryEmerald)))
                else if (_contacts.isEmpty)
                  const Text('No alert contacts configured.', style: TextStyle(color: AppTheme.textMuted, fontSize: 13))
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _contacts.length,
                    separatorBuilder: (_, __) => const Divider(height: 16),
                    itemBuilder: (ctx, idx) {
                      final c = _contacts[idx];
                      return Row(
                        children: [
                          Icon(
                            c.channel == 'fcm'
                                ? Icons.phone_iphone
                                : c.channel == 'email'
                                    ? Icons.email_outlined
                                    : Icons.notifications_active_outlined,
                            size: 20,
                            color: AppTheme.accentCyan,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  c.name.isNotEmpty ? c.name : c.destination,
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  c.channel.toUpperCase(),
                                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          if (c.verified)
                            IconButton(
                              icon: const Icon(Icons.send_outlined, size: 18, color: AppTheme.textSecondary),
                              tooltip: 'Send Test Alert',
                              onPressed: _isTesting ? null : () => _testAlert(c),
                            ),
                        ],
                      );
                    },
                  ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Sign Out Button
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.statusDown,
              side: const BorderSide(color: AppTheme.statusDown),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(Icons.logout, size: 18),
            label: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: () async {
              await authVm.signOut();
              if (context.mounted) {
                Navigator.pop(context);
              }
            },
          ),
        ],
      ),
    );
  }
}
