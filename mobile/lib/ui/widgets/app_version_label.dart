import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../core/theme.dart';

/// The app version, read from the platform rather than hardcoded.
///
/// `package_info_plus` reports the version baked into the build (the
/// `version:` in pubspec.yaml), so bumping the release updates this label
/// automatically. A constant in Dart would drift silently from the actual
/// build, which is worse than showing nothing.
///
/// Shared by the login and settings screens so the two cannot disagree.
class AppVersionLabel extends StatefulWidget {
  final String prefix;
  final TextAlign align;
  final Color color;

  const AppVersionLabel({
    super.key,
    this.prefix = 'UptimeMonke',
    this.align = TextAlign.center,
    this.color = AppTheme.textDim,
  });

  @override
  State<AppVersionLabel> createState() => _AppVersionLabelState();
}

class _AppVersionLabelState extends State<AppVersionLabel> {
  String? _label;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (!mounted) return;
      // Build number is shown only when it is not the default "1", so a debug
      // build does not read as "1.0.0 (1)" but a real build still carries it.
      final build = info.buildNumber;
      final suffix = (build.isEmpty || build == '1') ? '' : ' ($build)';
      setState(() => _label = '${widget.prefix} v${info.version}$suffix');
    } catch (_) {
      // The version is a nicety; never let it break the screen it sits on.
      if (mounted) setState(() => _label = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Collapse to nothing until (or unless) the version resolves, so the
    // layout does not jump when it arrives.
    if (_label == null) return const SizedBox.shrink();

    return Text(
      _label!,
      textAlign: widget.align,
      style: TextStyle(
        color: widget.color,
        fontSize: 11,
        letterSpacing: 0.2,
      ),
    );
  }
}
