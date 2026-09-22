import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../viewmodels/auth_viewmodel.dart';

/// Signed in, but the workspace could not be loaded.
///
/// Without this the router falls through to the login screen while the user
/// holds a perfectly valid session. That invites them to sign in again, says
/// nothing about what actually failed, and repeats identically every launch —
/// so a transient API error reads as being permanently logged out.
///
/// The two things a person can usefully do from here are try again and leave,
/// so those are the only two things offered.
class WorkspaceUnavailableScreen extends StatefulWidget {
  const WorkspaceUnavailableScreen({super.key});

  @override
  State<WorkspaceUnavailableScreen> createState() =>
      _WorkspaceUnavailableScreenState();
}

class _WorkspaceUnavailableScreenState extends State<WorkspaceUnavailableScreen> {
  bool _retrying = false;

  Future<void> _retry() async {
    setState(() => _retrying = true);
    final ok = await context.read<AuthViewModel>().retryWorkspaceLookup();
    if (!mounted) return;
    setState(() => _retrying = false);
    // On success the router rebuilds straight into the dashboard; nothing to
    // navigate here. On failure the message below has already been updated.
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppTheme.statusDown,
          content: Text('Still could not load your workspace.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authVm = context.watch<AuthViewModel>();

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.cloud_off_outlined,
                    size: 56,
                    color: AppTheme.statusPending,
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Could not load your workspace',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    // Says what is and is not affected. Someone seeing this
                    // needs to know whether their monitoring stopped: it did
                    // not, the workers are unaffected by this app failing to
                    // reach the API.
                    'You are signed in as ${authVm.user?.email ?? "your account"}. '
                    'Your monitors are still running and alerts are still being '
                    'sent — this app just could not reach the API.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 13.5,
                      height: 1.5,
                      color: AppTheme.textSecondary,
                    ),
                  ),

                  if (authVm.errorMessage != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: AppTheme.statusDown.withValues(alpha: 0.10),
                        border: Border.all(
                          color: AppTheme.statusDown.withValues(alpha: 0.32),
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        authVm.errorMessage!,
                        style: const TextStyle(
                          fontSize: 12.5,
                          height: 1.45,
                          color: AppTheme.statusDown,
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 22),
                  SizedBox(
                    height: 48,
                    child: FilledButton(
                      onPressed: _retrying ? null : _retry,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: AppTheme.bgDark,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _retrying
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppTheme.bgDark,
                              ),
                            )
                          : const Text(
                              'Try again',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: _retrying
                        ? null
                        : () => context.read<AuthViewModel>().signOut(),
                    child: const Text(
                      'Sign out',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppTheme.textMuted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
