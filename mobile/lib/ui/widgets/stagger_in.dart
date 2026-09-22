import 'dart:async';

import 'package:flutter/material.dart';

/// Fades and lifts a list item into place, slightly after the one above it.
///
/// A dashboard that paints its whole list in one frame gives no sense of the
/// list being assembled, and on a slow workspace load it reads as a flash.
/// Letting the rows arrive in sequence makes the load feel deliberate.
///
/// The delay is capped on purpose. These rows are built by a
/// `SliverChildBuilderDelegate`, so row 30 is not built until it scrolls into
/// view — if the delay scaled with the raw index, the row you just scrolled to
/// would sit invisible for over a second while its "turn" came round. Capping
/// at [_maxStaggerSteps] keeps the effect on the first screenful, where it is
/// the whole point, and makes every later row animate promptly on its own.
///
/// Like every other animation in the app it stops when the platform asks:
/// `MediaQuery.disableAnimations` is the OS reduce-motion switch, and an
/// entrance animation is precisely what that setting is for. The row is still
/// shown — it just starts fully visible.
class StaggerIn extends StatefulWidget {
  const StaggerIn({
    super.key,
    required this.index,
    required this.child,
    this.step = const Duration(milliseconds: 45),
    this.duration = const Duration(milliseconds: 380),
  });

  /// Position in the list. Only used to decide how long to wait.
  final int index;
  final Widget child;

  /// Gap between one row starting and the next.
  final Duration step;

  /// How long a single row takes to arrive.
  final Duration duration;

  /// Beyond this many rows the delay stops growing.
  static const int _maxStaggerSteps = 6;

  @override
  State<StaggerIn> createState() => _StaggerInState();
}

class _StaggerInState extends State<StaggerIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  /// Held so it can be cancelled in [dispose]. A pending `Future.delayed`
  /// would fire on a disposed State and throw — the same leak that had to be
  /// fixed in the splash pulse.
  Timer? _startTimer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);

    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      // A small lift only. A large offset turns a list into a slot machine.
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));

    final steps = widget.index.clamp(0, StaggerIn._maxStaggerSteps);
    final delay = widget.step * steps;

    if (delay == Duration.zero) {
      _controller.forward();
    } else {
      _startTimer = Timer(delay, () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _startTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduceMotion) {
      // Cancel rather than just skipping the visuals: a controller left
      // waiting on a timer is a frame callback nobody can see.
      _startTimer?.cancel();
      if (!_controller.isCompleted) _controller.value = 1;
      return widget.child;
    }

    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(position: _slide, child: widget.child),
    );
  }
}
