import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// The app's loading state: a probe going out and coming back.
///
/// A bare spinner says "wait"; this says what the product does. Rings expand
/// from the mark the way a check reaches an endpoint, which is the one
/// animation this app can justify on every screen.
///
/// Three things it has to get right:
///
///  - it must not spin forever with no explanation. The caption appears only
///    after [messageDelay], so a fast load stays quiet and a slow one
///    reassures rather than leaving somebody staring at a mark.
///  - it must stop when the platform asks. `MediaQuery.disableAnimations` is
///    set by the OS reduce-motion switch, and a looping animation is exactly
///    what that setting exists to stop.
///  - it must dispose its controller. A repeating controller left running is
///    a frame callback for the life of the process.
class ProbePulse extends StatefulWidget {
  const ProbePulse({
    super.key,
    this.size = 96,
    this.showMark = true,
    this.messages = const [],
    this.messageDelay = const Duration(milliseconds: 1600),
  });

  final double size;

  /// The mascot in the middle. Off for inline use, where it would dominate.
  final bool showMark;

  /// Cycled once the load is slow enough to be worth explaining.
  final List<String> messages;
  final Duration messageDelay;

  @override
  State<ProbePulse> createState() => _ProbePulseState();
}

class _ProbePulseState extends State<ProbePulse> with SingleTickerProviderStateMixin {
  static const _ringCount = 3;
  static const _period = Duration(milliseconds: 2200);

  late final AnimationController _controller;
  /// Held so it can be cancelled: a `Future.delayed` cannot be, and would
  /// outlive the widget — firing against a disposed state and, in tests,
  /// leaving a pending timer the binding rightly complains about.
  Timer? _messageTimer;
  int _messageIndex = 0;
  bool _showMessage = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: _period)..repeat();

    if (widget.messages.isNotEmpty) {
      // Only worth saying something if the wait is long enough to notice.
      _messageTimer = Timer(widget.messageDelay, () {
        if (mounted) setState(() => _showMessage = true);
      });
      _controller.addListener(_advanceMessage);
    }
  }

  void _advanceMessage() {
    if (!_showMessage || widget.messages.length < 2) return;
    // One message per full cycle, so the text changes with the rings rather
    // than on its own timer drifting against them.
    final cycle = (_controller.lastElapsedDuration ?? Duration.zero).inMilliseconds ~/
        _period.inMilliseconds;
    final next = cycle % widget.messages.length;
    if (next != _messageIndex) setState(() => _messageIndex = next);
  }

  @override
  void dispose() {
    _messageTimer?.cancel();
    _controller.removeListener(_advanceMessage);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Set by the OS reduce-motion switch. A looping pulse is precisely what
    // that asks us not to do, so it becomes a still mark.
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: widget.size,
          height: widget.size,
          child: reduceMotion
              ? _Mark(size: widget.size, show: widget.showMark)
              : AnimatedBuilder(
                  animation: _controller,
                  builder: (context, child) => CustomPaint(
                    painter: _PulsePainter(
                      progress: _controller.value,
                      ringCount: _ringCount,
                      colour: AppTheme.primaryEmerald,
                    ),
                    child: child,
                  ),
                  child: _Mark(size: widget.size, show: widget.showMark),
                ),
        ),
        if (widget.messages.isNotEmpty) ...[
          const SizedBox(height: 22),
          AnimatedOpacity(
            opacity: _showMessage ? 1 : 0,
            duration: const Duration(milliseconds: 400),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 350),
              child: Text(
                widget.messages[_messageIndex],
                key: ValueKey(_messageIndex),
                style: const TextStyle(
                  color: AppTheme.textMuted,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Mark extends StatelessWidget {
  const _Mark({required this.size, required this.show});

  final double size;
  final bool show;

  @override
  Widget build(BuildContext context) {
    if (!show) {
      return Center(
        child: Container(
          width: size * 0.16,
          height: size * 0.16,
          decoration: const BoxDecoration(
            color: AppTheme.primaryEmerald,
            shape: BoxShape.circle,
          ),
        ),
      );
    }
    return Center(
      child: Container(
        width: size * 0.46,
        height: size * 0.46,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(size * 0.14),
          // Same treatment as the login mark: the asset has no alpha, so it
          // fills its tile rather than sitting padded inside one.
          color: AppTheme.bgSurfaceCard,
        ),
        child: Image.asset('assets/mascot-128.png', fit: BoxFit.cover),
      ),
    );
  }
}

/// Expanding rings, evenly out of phase so one is always leaving.
class _PulsePainter extends CustomPainter {
  _PulsePainter({
    required this.progress,
    required this.ringCount,
    required this.colour,
  });

  final double progress;
  final int ringCount;
  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    final centre = Offset(size.width / 2, size.height / 2);
    final maxRadius = size.width / 2;
    final minRadius = size.width * 0.24;

    for (var i = 0; i < ringCount; i++) {
      // Phase-shift each ring by an equal slice of the cycle.
      final t = (progress + i / ringCount) % 1.0;

      // Ease out, so a ring moves quickly at first and settles — a linear
      // ring reads as a mechanical sweep rather than something propagating.
      final eased = 1 - math.pow(1 - t, 2).toDouble();
      final radius = minRadius + (maxRadius - minRadius) * eased;

      // Fade as it travels, and again at the very start, so a ring never
      // pops into existence at full strength.
      final fade = (1 - t) * math.min(1, t * 6);

      canvas.drawCircle(
        centre,
        radius,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..color = colour.withValues(alpha: 0.42 * fade),
      );
    }
  }

  @override
  bool shouldRepaint(_PulsePainter old) => old.progress != progress;
}
