import 'package:flutter/material.dart';

/// A status dot that breathes while the state it reports is live.
///
/// The dashboard's dots were static, which made a red "down" indicator look
/// the same as a grey "nothing wrong" one at a glance — the colour carried
/// the whole message. A slow pulse gives the active state a second channel,
/// which matters most for the case the user needs to notice fastest.
///
/// [pulsing] is deliberately a parameter rather than something inferred from
/// the colour: "no monitors are down" is a perfectly good state and should sit
/// still. Motion here means *this is live right now*, not merely *this is
/// coloured*.
///
/// Stops when `MediaQuery.disableAnimations` is set — a repeating animation is
/// the primary thing the OS reduce-motion switch exists to stop. The dot stays
/// visible at full strength, so nothing is lost but the movement.
class StatusDot extends StatefulWidget {
  const StatusDot({
    super.key,
    required this.color,
    this.pulsing = true,
    this.size = 7,
    this.period = const Duration(milliseconds: 1800),
  });

  final Color color;
  final bool pulsing;
  final double size;
  final Duration period;

  @override
  State<StatusDot> createState() => _StatusDotState();
}

class _StatusDotState extends State<StatusDot> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.period);
  }

  @override
  void didUpdateWidget(StatusDot old) {
    super.didUpdateWidget(old);
    // A monitor recovering must actually stop the halo, not leave it looping
    // under a green dot.
    if (old.pulsing != widget.pulsing) _sync();
  }

  /// Starts or stops the loop to match the current state.
  ///
  /// Called from `build` as well as [didUpdateWidget] because reduce-motion
  /// can change without this widget's own configuration changing at all.
  void _sync() {
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final shouldRun = widget.pulsing && !reduceMotion;

    if (shouldRun && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!shouldRun && _controller.isAnimating) {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _sync();

    final dot = Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        color: widget.color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(color: widget.color, blurRadius: 5, spreadRadius: 0.5),
        ],
      ),
    );

    if (!widget.pulsing) return dot;

    // Sized to the largest the halo ever gets, so starting and stopping the
    // pulse cannot change the widget's footprint and reflow the row beside it.
    final extent = widget.size * 2.4;

    return SizedBox(
      width: extent,
      height: extent,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              final t = _controller.value;
              return Transform.scale(
                scale: 1 + t * 1.4,
                child: Container(
                  width: widget.size,
                  height: widget.size,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    // Fades as it expands, so the ring dissolves outward
                    // rather than blinking out at full opacity.
                    color: widget.color.withValues(alpha: (1 - t) * 0.45),
                  ),
                ),
              );
            },
          ),
          dot,
        ],
      ),
    );
  }
}
