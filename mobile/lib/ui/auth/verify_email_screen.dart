import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../viewmodels/auth_viewmodel.dart';

/// Shown instead of the app until a password account confirms its address.
///
/// The real enforcement is server-side — the API refuses an unverified token —
/// so this is not the lock, it is the explanation. Without it the user signs
/// in, lands back on the login screen with no message, and has no way to
/// understand why.
///
/// Only a password sign-up reaches here. A federated sign-in has nothing to
/// confirm, and offering it a "resend" button would be a dead end.
class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({super.key});

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  static const Duration _pollInterval = Duration(seconds: 4);
  static const Duration _resendCooldown = Duration(seconds: 60);

  Timer? _poll;
  Timer? _cooldownTick;
  DateTime? _sentAt;
  bool _busy = false;
  bool _checking = false;
  String? _error;
  String? _notice;

  @override
  void initState() {
    super.initState();
    // Poll quietly, so someone who confirms on another device just gets in
    // rather than having to guess that restarting the app is the answer.
    _poll = Timer.periodic(_pollInterval, (_) => _pollOnce());
  }

  @override
  void dispose() {
    _poll?.cancel();
    _cooldownTick?.cancel();
    super.dispose();
  }

  Future<void> _pollOnce() async {
    if (!mounted || _busy || _checking) return;
    final authVm = context.read<AuthViewModel>();
    await authVm.checkEmailVerified();
    // No navigation here: main.dart routes off `needsEmailVerification`, so a
    // successful check rebuilds straight into the dashboard.
  }

  Duration get _cooldownLeft {
    final sent = _sentAt;
    if (sent == null) return Duration.zero;
    final left = _resendCooldown - DateTime.now().difference(sent);
    return left.isNegative ? Duration.zero : left;
  }

  Future<void> _resend() async {
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    final problem = await context.read<AuthViewModel>().resendVerificationEmail();

    if (!mounted) return;
    setState(() {
      _busy = false;
      if (problem != null) {
        _error = problem;
      } else {
        _sentAt = DateTime.now();
        _notice = 'Sent. Check your inbox.';
      }
    });

    // Drive the countdown label.
    _cooldownTick?.cancel();
    _cooldownTick = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted || _cooldownLeft == Duration.zero) {
        t.cancel();
        if (mounted) setState(() {});
        return;
      }
      setState(() {});
    });
  }

  Future<void> _checkNow() async {
    setState(() {
      _checking = true;
      _error = null;
      _notice = null;
    });

    final verified = await context.read<AuthViewModel>().checkEmailVerified();

    if (!mounted) return;
    setState(() {
      _checking = false;
      if (!verified) {
        _error = 'Still not confirmed. Check your inbox, and your spam folder.';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authVm = context.watch<AuthViewModel>();
    final email = authVm.user?.email ?? 'your address';
    final cooling = _cooldownLeft > Duration.zero;

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
                    Icons.mark_email_unread_outlined,
                    size: 56,
                    color: AppTheme.primary,
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Confirm your email',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text.rich(
                    TextSpan(
                      children: [
                        const TextSpan(text: 'We sent a confirmation link to '),
                        TextSpan(
                          text: email,
                          style: const TextStyle(
                            color: AppTheme.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const TextSpan(
                          text: '. Open it, and this screen will let you through.',
                        ),
                      ],
                    ),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 13.5,
                      height: 1.5,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 24),

                  if (_notice != null)
                    _Banner(
                      text: _notice!,
                      color: AppTheme.primary,
                      icon: Icons.check_circle_outline,
                    ),
                  if (_error != null)
                    _Banner(
                      text: _error!,
                      color: AppTheme.statusDown,
                      icon: Icons.error_outline,
                    ),
                  if (_notice != null || _error != null)
                    const SizedBox(height: 16),

                  SizedBox(
                    height: 48,
                    child: FilledButton(
                      onPressed: _checking ? null : _checkNow,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: AppTheme.bgDark,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _checking
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppTheme.bgDark,
                              ),
                            )
                          : const Text(
                              "I've confirmed it",
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  SizedBox(
                    height: 48,
                    child: OutlinedButton(
                      onPressed: (_busy || cooling) ? null : _resend,
                      style: OutlinedButton.styleFrom(
                        backgroundColor: AppTheme.bgSurfaceCard,
                        side: const BorderSide(
                          color: AppTheme.borderSubtle,
                          width: 1,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppTheme.textPrimary,
                              ),
                            )
                          : Text(
                              cooling
                                  ? 'Resend in ${_cooldownLeft.inSeconds}s'
                                  : 'Resend the email',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  TextButton(
                    onPressed: () => context.read<AuthViewModel>().signOut(),
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

class _Banner extends StatelessWidget {
  final String text;
  final Color color;
  final IconData icon;

  const _Banner({required this.text, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        border: Border.all(color: color.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(fontSize: 13, height: 1.4, color: color),
            ),
          ),
        ],
      ),
    );
  }
}
