import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../../../core/theme.dart';
import '../../../viewmodels/auth_viewmodel.dart';

class SocialAuthButtons extends StatelessWidget {
  final VoidCallback? onSuccess;

  const SocialAuthButtons({
    super.key,
    this.onSuccess,
  });

  static const String _googleSvg = '''<svg viewBox="0 0 24 24" width="20" height="20">
  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
</svg>''';

  static const String _githubSvg = '''<svg viewBox="0 0 24 24" width="20" height="20">
  <path fill="#F3F4F6" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
</svg>''';

  static const String _appleSvg = '''<svg viewBox="0 0 24 24" width="20" height="20">
  <path fill="#F3F4F6" d="M17.05 12.94c-.03-2.9 2.37-4.3 2.48-4.36-1.35-1.98-3.46-2.25-4.21-2.28-1.79-.18-3.5 1.05-4.41 1.05-.91 0-2.31-1.03-3.8-1-1.95.03-3.75 1.13-4.75 2.88-2.03 3.51-.52 8.71 1.46 11.56.97 1.4 2.12 2.96 3.63 2.9 1.46-.06 2.01-.94 3.78-.94 1.76 0 2.27.94 3.81.91 1.57-.03 2.57-1.42 3.53-2.82 1.11-1.62 1.57-3.19 1.6-3.27-.04-.02-3.07-1.18-3.1-4.66zM14.2 4.41c.8-.98 1.35-2.33 1.2-3.68-1.16.05-2.57.77-3.4 1.75-.74.86-1.39 2.24-1.22 3.56 1.29.1 2.61-.66 3.42-1.63z"/>
</svg>''';

  @override
  Widget build(BuildContext context) {
    final authVm = Provider.of<AuthViewModel>(context);
    final isBusy = authVm.isAnyLoading;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Google Sign In Button
        _SocialButton(
          label: 'Continue with Google',
          icon: SvgPicture.string(_googleSvg, width: 20, height: 20),
          isLoading: authVm.isGoogleLoading,
          disabled: isBusy,
          onTap: () async {
            final ok = await authVm.signInWithGoogle();
            if (ok && context.mounted && onSuccess != null) {
              onSuccess!();
            }
          },
        ),
        const SizedBox(height: 10),

        // GitHub Sign In Button
        _SocialButton(
          label: 'Continue with GitHub',
          icon: SvgPicture.string(_githubSvg, width: 20, height: 20),
          isLoading: authVm.isGithubLoading,
          disabled: isBusy,
          onTap: () async {
            final ok = await authVm.signInWithGithub();
            if (ok && context.mounted && onSuccess != null) {
              onSuccess!();
            }
          },
        ),

        // Sign in with Apple — iOS only.
        //
        // Apple requires it wherever an app offers other third-party sign-in,
        // and off iOS the provider would need its OAuth code flow configured
        // in Firebase, which it does not have. Hiding it elsewhere keeps the
        // button from being offered where it cannot complete.
        if (Platform.isIOS) ...[
          const SizedBox(height: 10),
          _SocialButton(
            label: 'Continue with Apple',
            icon: SvgPicture.string(_appleSvg, width: 20, height: 20),
            isLoading: authVm.isAppleLoading,
            disabled: isBusy,
            onTap: () async {
              final ok = await authVm.signInWithApple();
              if (ok && context.mounted && onSuccess != null) {
                onSuccess!();
              }
            },
          ),
        ],

        const SizedBox(height: 20),

        // "OR" Divider
        Row(
          children: [
            const Expanded(
              child: Divider(color: AppTheme.borderSubtle, thickness: 1),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text(
                'OR CONTINUE WITH EMAIL',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.8,
                  color: AppTheme.textMuted.withValues(alpha: 0.8),
                ),
              ),
            ),
            const Expanded(
              child: Divider(color: AppTheme.borderSubtle, thickness: 1),
            ),
          ],
        ),
        const SizedBox(height: 20),
      ],
    );
  }
}

class _SocialButton extends StatelessWidget {
  final String label;
  final Widget icon;
  final bool isLoading;
  final bool disabled;
  final VoidCallback onTap;

  const _SocialButton({
    required this.label,
    required this.icon,
    required this.isLoading,
    required this.disabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: OutlinedButton(
        onPressed: disabled ? null : onTap,
        style: OutlinedButton.styleFrom(
          backgroundColor: AppTheme.bgSurfaceCard,
          side: const BorderSide(color: AppTheme.borderSubtle, width: 1),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          elevation: 0,
        ),
        child: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppTheme.textPrimary,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  icon,
                  const SizedBox(width: 12),
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                      letterSpacing: -0.2,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
