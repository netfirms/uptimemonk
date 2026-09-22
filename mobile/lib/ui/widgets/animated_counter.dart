import 'package:flutter/material.dart';

/// A number that travels to its new value instead of snapping to it.
///
/// The dashboard's figures change underneath the user — a probe comes back,
/// a monitor drops, the rolling average shifts. Swapping "42" for "41" in a
/// single frame is very easy to miss, which is the opposite of what these
/// numbers are for. Moving between them draws the eye to the one box that
/// changed.
///
/// Two things this has to get right:
///
///  - it must stop when the platform asks. `MediaQuery.disableAnimations` is
///    the OS reduce-motion switch, and counting digits is exactly the kind of
///    motion it exists to suppress. The value still updates, it just arrives
///    immediately.
///  - it must not animate on a rebuild that did not change the value.
///    `TweenAnimationBuilder` only runs when the tween's end moves, which is
///    why the value drives the tween rather than a controller — the dashboard
///    rebuilds on every `notifyListeners` and a controller would restart the
///    count each time.
class AnimatedCounter extends StatelessWidget {
  const AnimatedCounter({
    super.key,
    required this.value,
    required this.format,
    required this.style,
    this.duration = const Duration(milliseconds: 650),
    this.curve = Curves.easeOutCubic,
  });

  /// The number to show. Interpolation is always over a double so the same
  /// widget handles a count and a percentage; [format] decides how it reads.
  final double value;

  /// Turns the interpolated value into the string on screen. Kept as a
  /// callback because the caller knows whether this is "12", "99.98%" or
  /// "143 ms" — and an intermediate frame has to be formatted the same way as
  /// the final one or the text visibly changes shape as it settles.
  final String Function(double) format;

  final TextStyle style;
  final Duration duration;
  final Curve curve;

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: value),
      duration: reduceMotion ? Duration.zero : duration,
      curve: curve,
      builder: (context, animated, _) => Text(
        format(animated),
        style: style,
      ),
    );
  }
}

/// A colour that eases between states rather than cutting.
///
/// "Down monitors" turning from grey to red is the single most important
/// state change on the dashboard, and a hard cut reads as a repaint rather
/// than as news. Separate from [AnimatedCounter] because the colour and the
/// number change on different occasions — a count can move while the status
/// stays the same.
class AnimatedStatusColor extends StatelessWidget {
  const AnimatedStatusColor({
    super.key,
    required this.color,
    required this.builder,
    this.duration = const Duration(milliseconds: 420),
  });

  final Color color;
  final Widget Function(BuildContext, Color) builder;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    return TweenAnimationBuilder<Color?>(
      tween: ColorTween(end: color),
      duration: reduceMotion ? Duration.zero : duration,
      curve: Curves.easeOut,
      builder: (context, animated, _) => builder(context, animated ?? color),
    );
  }
}
