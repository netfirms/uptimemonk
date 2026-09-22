import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// The Grid — a perspective plane receding to a lit horizon.
///
/// The web client draws this with a CSS 3D transform on a tiled background;
/// here it is a painter, because the equivalent trick in Flutter (a
/// `Transform` with a perspective matrix over a repeating image) has to
/// rasterise a very large layer to look right, and the lines are cheaper to
/// compute directly.
///
/// Projection: a point at depth `t` (0 at the horizon, 1 at the viewer) sits
/// at screen y = height * t^[_falloff]. Raising t to a power is what bunches
/// the lines toward the horizon; a linear ramp gives evenly spaced stripes
/// that read as a ladder rather than as a plane going away.
///
/// Decorative only. It carries no information, so it is wrapped in
/// [ExcludeSemantics] by the caller and never announced.
class GridFloor extends StatefulWidget {
  const GridFloor({
    super.key,
    this.height = 260,
    this.accent = false,
    this.animate = true,
  });

  final double height;

  /// CLU orange instead of the programs' cyan.
  final bool accent;

  /// The plane drifts toward the viewer. Ignored when the platform asks for
  /// reduced motion — a looping background is exactly what that setting is
  /// for.
  final bool animate;

  @override
  State<GridFloor> createState() => _GridFloorState();
}

class _GridFloorState extends State<GridFloor> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 7),
    );
  }

  /// Starts or stops the drift to match the current state.
  ///
  /// Called from `build` as well, because reduce-motion can change without
  /// this widget's own configuration changing at all.
  void _sync() {
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final shouldRun = widget.animate && !reduceMotion;
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
    final hue = widget.accent ? AppTheme.accent : AppTheme.primary;

    return ExcludeSemantics(
      child: IgnorePointer(
        child: SizedBox(
          height: widget.height,
          width: double.infinity,
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) => CustomPaint(
              painter: _GridPainter(phase: _controller.value, hue: hue),
            ),
          ),
        ),
      ),
    );
  }
}

class _GridPainter extends CustomPainter {
  _GridPainter({required this.phase, required this.hue});

  /// 0..1 through one cell of travel. Looping on a whole cell is what makes
  /// the drift seamless instead of snapping back.
  final double phase;
  final Color hue;

  /// How hard the depth ramp bunches lines toward the horizon.
  static const double _falloff = 2.6;

  /// Rows drawn between the horizon and the viewer.
  static const int _rows = 13;

  /// Verticals either side of centre.
  static const int _columns = 11;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final cx = w / 2;

    // Screen y for a normalised depth.
    double yAt(double t) => h * math.pow(t.clamp(0.0, 1.0), _falloff).toDouble();

    // Fade with depth so the far field dissolves rather than ending on a line.
    double alphaAt(double t) => (0.06 + 0.34 * t).clamp(0.0, 0.42);

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    // --- horizontals: one per row, marching toward the viewer -------------
    for (int i = 0; i < _rows; i++) {
      // The phase offset is what moves the plane. Taking the fraction keeps
      // every row inside 0..1 as it wraps.
      final t = ((i + phase) / _rows) % 1.0;
      final y = yAt(t);
      paint.color = hue.withValues(alpha: alphaAt(t));
      canvas.drawLine(Offset(0, y), Offset(w, y), paint);
    }

    // --- verticals: converge on the vanishing point -----------------------
    // Every vertical meets the centre of the horizon, so they are straight
    // lines from the vanishing point out to the near edge — no phase term,
    // because a plane sliding along itself does not move its verticals.
    final nearY = h;
    for (int i = -_columns; i <= _columns; i++) {
      if (i == 0) continue;
      // Spread widens with distance from centre so the near edge runs well
      // past the sides of the box, as a real plane would.
      final nearX = cx + i * (w / _columns) * 0.62;
      paint.color = hue.withValues(alpha: 0.16);
      canvas.drawLine(Offset(cx, 0), Offset(nearX, nearY), paint);
    }

    // --- the horizon ------------------------------------------------------
    // A single lit line sells the depth more than the grid does.
    final horizon = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.transparent,
          hue.withValues(alpha: 0.5),
          hue.withValues(alpha: 0.75),
          hue.withValues(alpha: 0.5),
          Colors.transparent,
        ],
        stops: const [0.0, 0.22, 0.5, 0.78, 1.0],
      ).createShader(Rect.fromLTWH(0, 0, w, 1))
      ..strokeWidth = 1.4;
    canvas.drawLine(const Offset(0, 0), Offset(w, 0), horizon);

    // Bloom under the horizon, so the line reads as lit rather than drawn.
    final glow = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [hue.withValues(alpha: 0.18), Colors.transparent],
      ).createShader(Rect.fromLTWH(0, 0, w, 44));
    canvas.drawRect(Rect.fromLTWH(0, 0, w, 44), glow);
  }

  @override
  bool shouldRepaint(_GridPainter old) => old.phase != phase || old.hue != hue;
}

/// Puts [GridFloor] behind a screen's content, pinned to the bottom.
///
/// Pinned rather than placed in the scroll view: a floor that scrolls away
/// reads as a decorative band partway down the page, where the point of it is
/// to be ground the content stands on.
class GridBackdrop extends StatelessWidget {
  const GridBackdrop({
    super.key,
    required this.child,
    this.height = 300,
    this.accent = false,
  });

  final Widget child;
  final double height;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: GridFloor(height: height, accent: accent),
        ),
        child,
      ],
    );
  }
}
