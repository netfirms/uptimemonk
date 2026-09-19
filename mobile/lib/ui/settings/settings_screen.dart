import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/models/alert_contact.dart';
import '../../data/services/api_client.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../widgets/app_version_label.dart';

/// What a channel is called, what it needs, and how to draw it.
///
/// `fcm` is deliberately absent from [_addableChannels]: those contacts are
/// created by the device registering itself for push, not typed in by hand.
class _Channel {
  final String id;
  final String label;
  final String destinationLabel;
  final String hint;
  final IconData icon;
  final TextInputType keyboard;

  const _Channel(
    this.id,
    this.label,
    this.destinationLabel,
    this.hint,
    this.icon, {
    this.keyboard = TextInputType.text,
  });
}

const List<_Channel> _addableChannels = [
  _Channel('email', 'Email', 'Email address', 'alerts@yourteam.com',
      Icons.email_outlined,
      keyboard: TextInputType.emailAddress),
  _Channel('slack', 'Slack', 'Incoming webhook URL',
      'https://hooks.slack.com/services/…', Icons.tag, keyboard: TextInputType.url),
  _Channel('discord', 'Discord', 'Webhook URL',
      'https://discord.com/api/webhooks/…', Icons.forum_outlined,
      keyboard: TextInputType.url),
  _Channel('telegram', 'Telegram', 'Chat ID', '123456789', Icons.send_outlined),
  _Channel('webhook', 'Webhook', 'Endpoint URL', 'https://example.com/hooks/uptime',
      Icons.webhook_outlined, keyboard: TextInputType.url),
];

IconData _iconFor(String channel) {
  if (channel == 'fcm') return Icons.phone_iphone;
  for (final c in _addableChannels) {
    if (c.id == channel) return c.icon;
  }
  return Icons.notifications_active_outlined;
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _apiClient = ApiClient();

  List<AlertContact> _contacts = [];
  bool _isLoading = true;
  String? _displayName;
  String? _orgName;

  /// Ids of contacts with an action in flight, so one row's spinner does not
  /// freeze the whole list.
  final Set<String> _busyContacts = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _apiClient.fetchContacts(),
        _apiClient.fetchOrg().catchError((Object e) {
          debugPrint('Failed to load org: $e');
          return <String, dynamic>{};
        }),
      ]);
      if (!mounted) return;
      setState(() {
        _contacts = results[0] as List<AlertContact>;
        _orgName = (results[1] as Map<String, dynamic>)['name'] as String?;
        _displayName = FirebaseAuth.instance.currentUser?.displayName;
      });
    } catch (e) {
      debugPrint('Failed to load settings: $e');
      _toast('Could not load settings. Pull to retry.', ok: false);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _toast(String message, {bool ok = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: ok ? AppTheme.statusUp : AppTheme.statusDown,
        content: Text(message),
      ),
    );
  }

  /// One-field prompt. Returns the trimmed value, or null if cancelled.
  Future<String?> _promptText({
    required String title,
    required String label,
    String initial = '',
    String? helper,
    int maxLength = 50,
  }) async {
    final controller = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.bgSurface,
        title: Text(title, style: const TextStyle(fontSize: 17)),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: maxLength,
          textInputAction: TextInputAction.done,
          decoration: InputDecoration(labelText: label, helperText: helper),
          onSubmitted: (v) => Navigator.pop(ctx, v.trim()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.primaryEmerald,
              foregroundColor: AppTheme.bgDark,
            ),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------- account

  Future<void> _editDisplayName() async {
    final next = await _promptText(
      title: 'Your name',
      label: 'Display name',
      initial: _displayName ?? '',
      helper: 'Shown on your account. 2–50 characters.',
    );
    if (next == null || next.isEmpty || next == _displayName) return;

    try {
      final saved = await _apiClient.updateDisplayName(next);
      // The server updates the Auth record; the copy on this device is stale
      // until it is reloaded, and the rest of the app reads it from there.
      await FirebaseAuth.instance.currentUser?.reload();
      if (!mounted) return;
      setState(() => _displayName = saved);
      _toast('Name updated');
    } catch (e) {
      _toast(_readable(e), ok: false);
    }
  }

  Future<void> _editOrgName() async {
    final next = await _promptText(
      title: 'Workspace name',
      label: 'Name',
      initial: _orgName ?? '',
      helper: 'What this workspace is called across the app.',
      maxLength: 60,
    );
    if (next == null || next.isEmpty || next == _orgName) return;

    try {
      final saved = await _apiClient.updateOrgName(next);
      if (!mounted) return;
      setState(() => _orgName = saved);
      _toast('Workspace renamed');
    } catch (e) {
      _toast(_readable(e), ok: false);
    }
  }

  // --------------------------------------------------------------- contacts

  Future<void> _runOnContact(String id, Future<void> Function() action, String done) async {
    setState(() => _busyContacts.add(id));
    try {
      await action();
      await _load();
      _toast(done);
    } catch (e) {
      _toast(_readable(e), ok: false);
    } finally {
      if (mounted) setState(() => _busyContacts.remove(id));
    }
  }

  Future<void> _renameContact(AlertContact c) async {
    final next = await _promptText(
      title: 'Rename destination',
      label: 'Name',
      initial: c.name,
      helper: 'Only the label changes — the destination stays the same.',
    );
    if (next == null || next.isEmpty || next == c.name) return;
    await _runOnContact(c.id, () => _apiClient.updateContact(c.id, name: next), 'Renamed');
  }

  Future<void> _toggleContact(AlertContact c) => _runOnContact(
        c.id,
        () => _apiClient.updateContact(c.id, enabled: !c.enabled),
        c.enabled ? 'Paused' : 'Enabled',
      );

  Future<void> _deleteContact(AlertContact c) async {
    final label = c.name.isNotEmpty ? c.name : c.destination;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.bgSurface,
        title: const Text('Remove destination', style: TextStyle(fontSize: 17)),
        content: Text(
          'Alerts will stop going to $label. Monitors using it keep running.',
          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14, height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.statusDown,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _runOnContact(c.id, () => _apiClient.deleteContact(c.id), 'Removed');
  }

  Future<void> _addContact() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddContactSheet(apiClient: _apiClient),
    );
    if (created == true) {
      await _load();
      _toast('Destination added — confirm it to start receiving alerts');
    }
  }

  /// API errors arrive as `ApiException (400): message`; show only the message.
  String _readable(Object e) {
    final text = e.toString();
    final match = RegExp(r'\((\d{3})\):\s*(.+)$', dotAll: true).firstMatch(text);
    return match != null ? match.group(2)!.trim() : text;
  }

  // ------------------------------------------------------------------- view

  @override
  Widget build(BuildContext context) {
    final authVm = Provider.of<AuthViewModel>(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings & Notifications')),
      body: RefreshIndicator(
        color: AppTheme.primaryEmerald,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _card(
              title: 'ACCOUNT',
              children: [
                _editableRow(
                  icon: Icons.account_circle_outlined,
                  label: _displayName?.isNotEmpty == true
                      ? _displayName!
                      : 'Add your name',
                  sub: authVm.user?.email ?? '',
                  faded: _displayName?.isNotEmpty != true,
                  onEdit: _editDisplayName,
                ),
              ],
            ),
            const SizedBox(height: 16),

            _card(
              title: 'WORKSPACE',
              children: [
                _editableRow(
                  icon: Icons.workspaces_outline,
                  label: _orgName?.isNotEmpty == true ? _orgName! : 'Untitled workspace',
                  sub: authVm.orgId ?? '',
                  subMono: true,
                  faded: _orgName?.isNotEmpty != true,
                  onEdit: _editOrgName,
                ),
              ],
            ),
            const SizedBox(height: 16),

            _card(
              title: 'ALERT DESTINATIONS',
              trailing: TextButton.icon(
                onPressed: _addContact,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Add'),
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.primaryEmerald,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  visualDensity: VisualDensity.compact,
                ),
              ),
              children: [
                if (_isLoading)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(
                      child: CircularProgressIndicator(color: AppTheme.primaryEmerald),
                    ),
                  )
                else if (_contacts.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'No destinations yet. Without one, an outage is recorded '
                      'but nobody is told.',
                      style: TextStyle(
                          color: AppTheme.textMuted, fontSize: 13, height: 1.45),
                    ),
                  )
                else
                  for (final c in _contacts) _contactTile(c),
              ],
            ),
            const SizedBox(height: 24),

            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.statusDown,
                side: const BorderSide(color: AppTheme.statusDown),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.logout, size: 18),
              label: const Text('Sign Out',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              onPressed: () async {
                await authVm.signOut();
                if (context.mounted) Navigator.pop(context);
              },
            ),

            // Version at the foot of the settings list, where people look when
            // filing a bug report.
            const SizedBox(height: 20),
            const AppVersionLabel(),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _card({
    required String title,
    required List<Widget> children,
    Widget? trailing,
  }) {
    return Container(
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
              Text(
                title,
                style: const TextStyle(
                  color: AppTheme.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.6,
                ),
              ),
              if (trailing != null) trailing,
            ],
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _editableRow({
    required IconData icon,
    required String label,
    required String sub,
    required VoidCallback onEdit,
    bool subMono = false,
    bool faded = false,
  }) {
    return InkWell(
      onTap: onEdit,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Icon(icon, size: 24, color: AppTheme.accentCyan),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: faded ? AppTheme.textMuted : AppTheme.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (sub.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      sub,
                      style: TextStyle(
                        color: AppTheme.textMuted,
                        fontSize: 12,
                        fontFamily: subMono ? 'monospace' : null,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            const Icon(Icons.edit_outlined, size: 18, color: AppTheme.textSecondary),
          ],
        ),
      ),
    );
  }

  Widget _contactTile(AlertContact c) {
    final busy = _busyContacts.contains(c.id);
    // Push contacts belong to a device, not to a person editing this screen —
    // renaming or deleting one here would not stop the device re-registering.
    final isDevice = c.channel == 'fcm';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Opacity(
        opacity: c.enabled ? 1 : 0.55,
        child: Row(
          children: [
            Icon(_iconFor(c.channel), size: 20, color: AppTheme.accentCyan),
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
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        c.channel.toUpperCase(),
                        style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                      ),
                      if (!c.verified) ...[
                        const SizedBox(width: 6),
                        const Text(
                          '· UNCONFIRMED',
                          style: TextStyle(
                            color: AppTheme.statusPending,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ] else if (!c.enabled) ...[
                        const SizedBox(width: 6),
                        const Text(
                          '· PAUSED',
                          style: TextStyle(color: AppTheme.textMuted, fontSize: 11),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            if (busy)
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppTheme.textSecondary),
              )
            else
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, size: 20, color: AppTheme.textSecondary),
                color: AppTheme.bgSurfaceElevated,
                onSelected: (value) {
                  switch (value) {
                    case 'test':
                      _runOnContact(c.id, () => _apiClient.testContact(c.id), 'Test alert sent');
                    case 'verify':
                      _runOnContact(
                          c.id, () => _apiClient.verifyContact(c.id), 'Confirmation sent');
                    case 'rename':
                      _renameContact(c);
                    case 'toggle':
                      _toggleContact(c);
                    case 'delete':
                      _deleteContact(c);
                  }
                },
                itemBuilder: (_) => [
                  if (c.verified)
                    const PopupMenuItem(value: 'test', child: Text('Send test alert')),
                  if (!c.verified)
                    const PopupMenuItem(value: 'verify', child: Text('Send confirmation')),
                  if (!isDevice)
                    const PopupMenuItem(value: 'rename', child: Text('Rename')),
                  PopupMenuItem(
                    value: 'toggle',
                    child: Text(c.enabled ? 'Pause alerts' : 'Resume alerts'),
                  ),
                  if (!isDevice)
                    const PopupMenuItem(
                      value: 'delete',
                      child: Text('Remove', style: TextStyle(color: AppTheme.statusDown)),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

/// Sheet for adding a destination.
///
/// Channel and destination cannot be changed afterwards — the server refuses,
/// because editing either would carry the old destination's confirmed status
/// onto a new one. So they are only ever chosen here.
class _AddContactSheet extends StatefulWidget {
  final ApiClient apiClient;
  const _AddContactSheet({required this.apiClient});

  @override
  State<_AddContactSheet> createState() => _AddContactSheetState();
}

class _AddContactSheetState extends State<_AddContactSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _destinationController = TextEditingController();
  _Channel _channel = _addableChannels.first;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _destinationController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.apiClient.createContact(
        channel: _channel.id,
        name: _nameController.text.trim(),
        destination: _destinationController.text.trim(),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      final text = e.toString();
      final match = RegExp(r'\((\d{3})\):\s*(.+)$', dotAll: true).firstMatch(text);
      if (mounted) {
        setState(() {
          _error = match != null ? match.group(2)!.trim() : text;
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      // Lift above the keyboard, or the destination field sits under it.
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: AppTheme.bgSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppTheme.borderLight,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Add alert destination',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                value: _channel.id,
                dropdownColor: AppTheme.bgSurfaceElevated,
                decoration: const InputDecoration(labelText: 'Channel'),
                items: [
                  for (final c in _addableChannels)
                    DropdownMenuItem(
                      value: c.id,
                      child: Row(
                        children: [
                          Icon(c.icon, size: 18, color: AppTheme.accentCyan),
                          const SizedBox(width: 10),
                          Text(c.label),
                        ],
                      ),
                    ),
                ],
                onChanged: _saving
                    ? null
                    : (v) => setState(() {
                          _channel =
                              _addableChannels.firstWhere((c) => c.id == v);
                          _destinationController.clear();
                        }),
              ),
              const SizedBox(height: 14),

              TextFormField(
                controller: _nameController,
                enabled: !_saving,
                maxLength: 50,
                decoration: const InputDecoration(
                  labelText: 'Label',
                  helperText: 'How this shows up in your list.',
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Give it a name' : null,
              ),
              const SizedBox(height: 4),

              TextFormField(
                controller: _destinationController,
                enabled: !_saving,
                keyboardType: _channel.keyboard,
                autocorrect: false,
                decoration: InputDecoration(
                  labelText: _channel.destinationLabel,
                  hintText: _channel.hint,
                ),
                validator: (v) {
                  final value = (v ?? '').trim();
                  if (value.isEmpty) return 'Required';
                  if (_channel.id == 'email' && !value.contains('@')) {
                    return 'That does not look like an email address';
                  }
                  if (_channel.keyboard == TextInputType.url &&
                      !value.startsWith('http')) {
                    return 'Must start with https://';
                  }
                  return null;
                },
              ),

              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(
                      color: AppTheme.statusDown, fontSize: 13, height: 1.4),
                ),
              ],

              const SizedBox(height: 18),
              SizedBox(
                height: 48,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.primaryEmerald,
                    foregroundColor: AppTheme.bgDark,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _saving ? null : _submit,
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: AppTheme.bgDark),
                        )
                      : const Text('Add destination',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'New destinations start unconfirmed. We send a confirmation '
                'first, so nobody can be paged without agreeing to it.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: AppTheme.textMuted, fontSize: 11.5, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
