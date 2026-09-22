import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../widgets/grid_floor.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../widgets/app_version_label.dart';
import 'register_screen.dart';
import 'widgets/social_auth_buttons.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit(AuthViewModel authVm) {
    if (_formKey.currentState?.validate() != true) return;
    FocusScope.of(context).unfocus();
    authVm.signIn(_emailController.text, _passwordController.text);
  }

  Future<void> _forgotPassword(AuthViewModel authVm) async {
    final error = await authVm.sendPasswordReset(_emailController.text);
    if (!mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          error ??
              'If that address has an account, a reset link is on its way.',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authVm = Provider.of<AuthViewModel>(context);
    final isBusy = authVm.isAnyLoading;

    return Scaffold(
      body: GridBackdrop(
          child: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: ConstrainedBox(
                // Fill the viewport so the form stays centred, but never
                // stretch wider than a comfortable reading width on tablets.
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - 48,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const _Header(),
                          const SizedBox(height: 28),

                          // Social authentication first — it is the faster path
                          // and the one most people take. SocialAuthButtons
                          // ends with its own "or continue with email" divider,
                          // so the email form reads as the alternative beneath.
                          const SocialAuthButtons(),
                          const SizedBox(height: 16),

                          // Form card — matches the dashboard's card language.
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: AppTheme.bgSurfaceCard,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: AppTheme.borderSubtle,
                                width: 1,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                const Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(
                                    'Sign in with email',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                      color: AppTheme.textPrimary,
                                      letterSpacing: -0.2,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 16),

                                // Email
                                TextFormField(
                                  controller: _emailController,
                                  keyboardType: TextInputType.emailAddress,
                                  textInputAction: TextInputAction.next,
                                  autofillHints: const [
                                    AutofillHints.email,
                                    AutofillHints.username,
                                  ],
                                  decoration: const InputDecoration(
                                    labelText: 'Email Address',
                                    prefixIcon: Icon(
                                      Icons.email_outlined,
                                      size: 20,
                                      color: AppTheme.textMuted,
                                    ),
                                  ),
                                  validator: (v) {
                                    if (v == null || !v.contains('@')) {
                                      return 'Enter a valid email';
                                    }
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 14),

                                // Password
                                TextFormField(
                                  controller: _passwordController,
                                  obscureText: _obscurePassword,
                                  textInputAction: TextInputAction.done,
                                  autofillHints: const [AutofillHints.password],
                                  onFieldSubmitted: (_) => _submit(authVm),
                                  decoration: InputDecoration(
                                    labelText: 'Password',
                                    prefixIcon: const Icon(
                                      Icons.lock_outline,
                                      size: 20,
                                      color: AppTheme.textMuted,
                                    ),
                                    suffixIcon: IconButton(
                                      tooltip: _obscurePassword
                                          ? 'Show password'
                                          : 'Hide password',
                                      icon: Icon(
                                        _obscurePassword
                                            ? Icons.visibility_off_outlined
                                            : Icons.visibility_outlined,
                                        size: 20,
                                        color: AppTheme.textMuted,
                                      ),
                                      onPressed: () => setState(
                                        () => _obscurePassword =
                                            !_obscurePassword,
                                      ),
                                    ),
                                  ),
                                  validator: (v) {
                                    if (v == null || v.length < 6) {
                                      return 'Password must be at least 6 characters';
                                    }
                                    return null;
                                  },
                                ),

                                // Forgot password
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton(
                                    onPressed: isBusy
                                        ? null
                                        : () => _forgotPassword(authVm),
                                    style: TextButton.styleFrom(
                                      minimumSize: const Size(0, 40),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                      ),
                                      foregroundColor: AppTheme.textMuted,
                                    ),
                                    child: const Text(
                                      'Forgot password?',
                                      style: TextStyle(fontSize: 12.5),
                                    ),
                                  ),
                                ),

                                // Error message
                                if (authVm.errorMessage != null)
                                  Container(
                                    margin: const EdgeInsets.only(bottom: 14),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 10,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppTheme.statusDownBg,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: AppTheme.statusDownBorder,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(
                                          Icons.error_outline_rounded,
                                          size: 18,
                                          color: AppTheme.statusDown,
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            authVm.errorMessage!,
                                            style: const TextStyle(
                                              color: AppTheme.statusDown,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),

                                // Sign In
                                SizedBox(
                                  height: 50,
                                  child: ElevatedButton(
                                    onPressed:
                                        isBusy ? null : () => _submit(authVm),
                                    child: isBusy
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.black,
                                            ),
                                          )
                                        : const Text('Sign In with Email'),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 16),

                          // Switch to sign up
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text(
                                "Don't have an account? ",
                                style: TextStyle(
                                  color: AppTheme.textMuted,
                                  fontSize: 13,
                                ),
                              ),
                              TextButton(
                                onPressed: isBusy
                                    ? null
                                    : () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) =>
                                                const RegisterScreen(),
                                          ),
                                        );
                                      },
                                style: TextButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                  ),
                                  foregroundColor: AppTheme.accentDeep,
                                ),
                                child: const Text(
                                  'Create workspace',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),

                          // App version at the foot of the page. Useful when a
                          // user is reporting an issue from a screenshot.
                          const SizedBox(height: 20),
                          const AppVersionLabel(),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      )),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Soft brand glow behind the mark, so the dark screen is not flat.
        Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                AppTheme.primary.withValues(alpha: 0.10),
                Colors.transparent,
              ],
            ),
          ),
          child: Center(
            child: Container(
              width: 112,
              height: 112,
              decoration: BoxDecoration(
                color: AppTheme.bgSurfaceCard,
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: AppTheme.borderSubtle,
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.18),
                    blurRadius: 28,
                    spreadRadius: 4,
                  ),
                ],
              ),
              // The asset is a palette PNG with no alpha channel, so its near
              // black background is baked in and cannot be made transparent.
              // Padding it inside a lighter tile drew a hard black square in
              // the middle of a rounded card. Clipping it to fill the tile
              // instead makes that background the tile — which reads as an
              // app icon rather than a mistake.
              clipBehavior: Clip.antiAlias,
              child: Image.asset(
                'assets/mascot-128.png',
                fit: BoxFit.cover,
                semanticLabel: 'UptimeMonke',
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'UptimeMonke',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w800,
            color: AppTheme.textPrimary,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Uptime monitoring, without the noise',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
        ),
      ],
    );
  }
}
