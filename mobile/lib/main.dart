import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'core/analytics.dart';
import 'core/auth_routing.dart';
import 'core/theme.dart';
import 'ui/widgets/probe_pulse.dart';
import 'data/services/push_service.dart';
import 'viewmodels/auth_viewmodel.dart';
import 'viewmodels/dashboard_viewmodel.dart';
import 'ui/auth/login_screen.dart';
import 'ui/auth/verify_email_screen.dart';
import 'ui/auth/workspace_unavailable_screen.dart';
import 'ui/dashboard/dashboard_screen.dart';

final GlobalKey<ScaffoldMessengerState> rootScaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Built once, lazily.
///
/// A fresh observer per build would attach a new listener on every rebuild,
/// and the dashboard rebuilds on every `notifyListeners` — which would report
/// the same screen dozens of times. Evaluated on first access, which is during
/// the first build and therefore after `Analytics.init()` has run.
final List<NavigatorObserver> _navigatorObservers = () {
  final observer = Analytics.observer();
  return observer == null ? <NavigatorObserver>[] : <NavigatorObserver>[observer];
}();

/// The last destination reported, so a rebuild does not re-report it.
///
/// `_resolveHome` runs on every auth change and every rebuild underneath it;
/// without this the screen-view count would track rebuilds rather than
/// navigation, which is worse than not measuring it at all.
AuthDestination? _lastReportedDestination;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase (safely catches if native configuration file is pending)
  try {
    await Firebase.initializeApp();
    // Before push, so that a failure inside push setup still leaves
    // measurement running — the two are independent and a broken notification
    // permission flow is exactly the sort of thing worth having data on.
    await Analytics.init();
    // Initialize Push notifications with scaffold messenger key for in-app alert display
    await PushNotificationService.instance.initialize(messengerKey: rootScaffoldMessengerKey);
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
          // Built once: calling _resolveHome twice — for the key and the
          // child — would construct the whole destination tree twice on
          // every rebuild.
          final home = _resolveHome(authVm);
          return MaterialApp(
            title: 'UptimeMonke',
            scaffoldMessengerKey: rootScaffoldMessengerKey,
            navigatorObservers: _navigatorObservers,
            debugShowCheckedModeBanner: false,
            theme: AppTheme.darkTheme,
            // Cross-fade between destinations rather than cutting. The
            // splash-to-login and login-to-dashboard handovers were both a
            // hard swap, which reads as a flicker on a fast device.
            //
            // Keyed by runtimeType, not by widget identity: rebuilding the
            // same destination (a rebuild on any auth change) must not
            // re-run the transition, or the dashboard would fade on every
            // notifyListeners.
            home: AnimatedSwitcher(
              duration: const Duration(milliseconds: 320),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              layoutBuilder: (current, previous) => Stack(
                alignment: Alignment.center,
                children: [...previous, if (current != null) current],
              ),
              child: KeyedSubtree(
                key: ValueKey(home.runtimeType),
                child: home,
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _resolveHome(AuthViewModel authVm) {
    // The decision lives in `resolveDestination` so it can be tested without
    // Firebase. Leaving a second copy of it here is how the two drift.
    final destination = resolveDestination(
      initial: authVm.status == AuthStatus.initial,
      signedIn: authVm.user != null,
      needsEmailVerification: authVm.needsEmailVerification,
      orgId: authVm.orgId,
      workspaceLookupFailed: authVm.workspaceLookupFailed,
    );

    // These destinations are swapped by `home:` rather than pushed, so the
    // navigator observer never sees them. Reported here instead, deduped so
    // the count reflects navigation rather than rebuilds.
    if (destination != _lastReportedDestination) {
      _lastReportedDestination = destination;
      unawaited(Analytics.screenView(destination.name));
    }

    switch (destination) {
      case AuthDestination.loading:
        // The first thing anyone sees. A bare spinner here told them nothing
        // and looked like the app had stalled; the pulse says a check is
        // going out, which is what is actually happening.
        return const Scaffold(
          backgroundColor: AppTheme.bgDark,
          body: Center(
            child: ProbePulse(
              size: 132,
              messages: [
                'Waking the monkey…',
                'Reaching the edge probes…',
                'Checking your workspace…',
              ],
            ),
          ),
        );

      case AuthDestination.verifyEmail:
        return const VerifyEmailScreen();

      case AuthDestination.workspaceUnavailable:
        return const WorkspaceUnavailableScreen();

      case AuthDestination.dashboard:
        return ChangeNotifierProvider(
          key: ValueKey(authVm.orgId),
          create: (_) => DashboardViewModel(orgId: authVm.orgId!),
          child: const DashboardScreen(),
        );

      case AuthDestination.login:
        return const LoginScreen();
    }
  }
}
