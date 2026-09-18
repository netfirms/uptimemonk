import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../viewmodels/auth_viewmodel.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authVm = Provider.of<AuthViewModel>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Account'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Get Started with UptimeMonke',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textPrimary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Free forever: 14,400 checks/day across all monitor types',
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 28),

                  // Email
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Work Email',
                      prefixIcon: Icon(Icons.email_outlined, size: 20, color: AppTheme.textMuted),
                    ),
                    validator: (v) {
                      if (v == null || !v.contains('@')) return 'Enter a valid email address';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Password
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      prefixIcon: Icon(Icons.lock_outline, size: 20, color: AppTheme.textMuted),
                    ),
                    validator: (v) {
                      if (v == null || v.length < 6) return 'Password must be at least 6 characters';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Error Message
                  if (authVm.errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        authVm.errorMessage!,
                        style: const TextStyle(color: AppTheme.statusDown, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ),

                  // Submit Button
                  ElevatedButton(
                    onPressed: authVm.status == AuthStatus.loading
                        ? null
                        : () async {
                            if (_formKey.currentState!.validate()) {
                              final ok = await authVm.signUp(
                                _emailController.text,
                                _passwordController.text,
                              );
                              if (ok && context.mounted) {
                                Navigator.pop(context);
                              }
                            }
                          },
                    child: authVm.status == AuthStatus.loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                          )
                        : const Text('Create Workspace'),
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
