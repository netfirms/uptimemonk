import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// A frosted pane, matching the web client's `.glass`.
///
/// What makes glass read as glass rather than as a translucent rectangle is
/// four things moving together, which is why they live in one widget instead
/// of being reapplied by hand at each call site:
///
///   * a real backdrop blur, so what is behind is legibly *behind*
///   * a gradient fill rather than an even one — real glass is lit from one
///     side, and uniform translucency is the tell that this is opacity
///   * a lit top lip and a dark bottom edge, drawn inside the pane
///   * two shadows: a tight contact shadow that anchors it and a wide soft
///     one that gives it height
///
/// [BackdropFilter] is not free. It forces the layer beneath into a saveLayer
/// for every panel, so this is for surfaces that carry the design — a topbar,
/// a hero card, a sheet — and not for every row of a scrolling list. There is
/// a [blurEnabled] escape hatch for exactly that case.
class GlassPanel extends StatelessWidget {
  const GlassPanel({
    super.key,
    required this.child,
    this.strong = false,
    this.padding,
    this.margin,
    this.borderRadius,
    this.blurEnabled = true,
    this.accent = false,
  });

  final Widget child;

  /// A brighter fill and a deeper shadow, for the one or two panels on a
  /// screen that should sit above the rest.
  final bool strong;

  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;

  /// Draws the pane without the backdrop blur.
  ///
  /// The blur is the expensive part. In a long list the cost is paid per row
  /// and per frame, and the effect is invisible anyway because the rows are
  /// opaque against each other — so the fill and edges stay, the blur goes.
  final bool blurEnabled;

  /// Tints the pane with CLU orange instead of the programs' cyan.
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(AppTheme.glassRadius);
    final hue = accent ? AppTheme.accent : AppTheme.primary;

    final pane = Container(
      padding: padding,
      decoration: BoxDecoration(
        borderRadius: radius,
        // Lit from the top-left and falling away to the bottom-right.
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            hue.withValues(alpha: strong ? 0.12 : 0.085),
            hue.withValues(alpha: strong ? 0.045 : 0.03),
            AppTheme.bgDark.withValues(alpha: strong ? 0.26 : 0.22),
          ],
          stops: const [0.0, 0.42, 1.0],
        ),
        border: Border.all(color: hue.withValues(alpha: 0.18)),
      ),
      child: child,
    );

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          // Contact shadow: anchors the pane to what is under it.
          BoxShadow(
            color: Colors.black.withValues(alpha: strong ? 0.55 : 0.5),
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
          // Height: the wide, soft one.
          BoxShadow(
            color: Colors.black.withValues(alpha: strong ? 0.58 : 0.46),
            blurRadius: strong ? 64 : 36,
            offset: Offset(0, strong ? 24 : 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          children: [
            if (blurEnabled)
              // Positioned.fill so the filter covers the pane even before the
              // child has been laid out; a bare BackdropFilter with no size
              // blurs nothing on the first frame.
              Positioned.fill(
                child: BackdropFilter(
                  filter: ImageFilter.blur(
                    sigmaX: AppTheme.glassBlur,
                    sigmaY: AppTheme.glassBlur,
                  ),
                  child: const SizedBox.expand(),
                ),
              ),
            pane,
            // The lit top lip, drawn last so it sits over the fill. Ignored by
            // hit testing — it covers the full width of the pane and would
            // otherwise swallow taps along the top edge.
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: IgnorePointer(
                child: Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.transparent,
                        AppTheme.glassHighlight,
                        AppTheme.glassHighlight,
                        Colors.transparent,
                      ],
                      stops: const [0.0, 0.18, 0.82, 1.0],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
