import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'core/theme.dart';
import 'data/services/push_service.dart';
import 'viewmodels/auth_viewmodel.dart';
import 'viewmodels/dashboard_viewmodel.dart';
import 'ui/auth/login_screen.dart';
import 'ui/dashboard/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase (safely catches if native configuration file is pending)
  try {
    await Firebase.initializeApp();
    // Initialize Push notifications
    final pushService = PushNotificationService();
    await pushService.initialize();
  } catch (e) {
    debugPrint('Firebase initialization notice: $e');
  }

  runApp(const UptimeMonkeApp());
}

class UptimeMonkeApp extends StatelessWidget {
  const UptimeMonkeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthViewModel()),
      ],
      child: Consumer<AuthViewModel>(
        builder: (context, authVm, _) {
          return MaterialApp(
            title: 'UptimeMonke',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.darkTheme,
            home: _resolveHome(authVm),
          );
        },
      ),
    );
  }

  Widget _resolveHome(AuthViewModel authVm) {
    if (authVm.status == AuthStatus.initial || authVm.status == AuthStatus.loading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: AppTheme.primaryEmerald),
        ),
      );
    }

    if (authVm.isAuthenticated && authVm.orgId != null) {
      return ChangeNotifierProvider(
        key: ValueKey(authVm.orgId),
        create: (_) => DashboardViewModel(orgId: authVm.orgId!),
        child: const DashboardScreen(),
      );
    }

    return const LoginScreen();
  }
}
