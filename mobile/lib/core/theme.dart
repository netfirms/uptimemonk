import 'package:flutter/material.dart';

/// UptimeMonke design system — Tron Legacy palette on near-black.
///
/// The hex values here are the same ones in `web/src/app/globals.css`, token
/// for token. Two products that are meant to look like one product cannot each
/// keep their own idea of what "the brand colour" is, and the moment they
/// diverge the drift is invisible until someone puts the two side by side.
///
/// Two forces: the cyan of the programs and CLU's orange. Status colours are
/// the deliberate exception — see [statusDown] and [statusMaintenance].
class AppTheme {
  // --- Surfaces ----------------------------------------------------------
  // Near-black rather than charcoal. Cyan only reads as luminous against
  // something close to true black; lift the base and the glow reads as a pale
  // fill instead.
  static const Color bgDark = Color(0xFF070B10); // web --bg
  static const Color bgSurface = Color(0xFF0D141C); // web --surface
  static const Color bgSurfaceCard = Color(0xFF0F1720); // web --surface-card
  static const Color bgSurfaceElevated = Color(0xFF16202B); // web --surface-hover
  static const Color bgSurfaceInput = Color(0xFF070D14); // web --surface-input
  static const Color bgSurfaceHover = Color(0xFF16202B);

  // Borders carry a cyan cast. A neutral grey hairline on this base reads as
  // grey plastic; a tinted one reads as lit.
  static const Color borderDark = Color(0xFF16323F); // web --border
  static const Color borderLight = Color(0xFF1F4D5F); // web --border-hover
  static const Color borderSubtle = Color(0xFF16323F);

  // --- Brand -------------------------------------------------------------
  /// The programs' cyan. Was `primaryGreen`/`primaryEmerald`, both holding the
  /// same green; a token named for a hue it no longer holds is how a palette
  /// rots, so they collapsed into one accurately named colour.
  static const Color primary = Color(0xFF6FC3DF); // web --primary

  /// A deeper step on the same ramp, for icons and secondary marks that would
  /// compete with [primary] at full strength.
  static const Color accentDeep = Color(0xFF3FA9C9);

  /// CLU orange — the film's counter-hue, and the one colour on the Grid that
  /// is not on the programs' side. Used sparingly and never as a status.
  static const Color accent = Color(0xFFFF9D2E); // web --accent

  // --- Status ------------------------------------------------------------
  // Up takes the programs' cyan. The rest keep their conventional meanings on
  // purpose: this is a monitoring product, and orange reads as "warning" to
  // everyone who has ever seen a dashboard. Making "down" orange would be
  // truer to the film and worse at the job the colour is doing.
  static const Color statusUp = Color(0xFF6FC3DF); // web --up
  static const Color statusDown = Color(0xFFFF4747); // web --down
  static const Color statusPending = Color(0xFF7C8B99); // web --pending
  static const Color statusPaused = Color(0xFF5C6B78);
  static const Color statusMaintenance = Color(0xFFFFD166); // web --maintenance

  static Color statusDownBg = statusDown.withValues(alpha: 0.13);
  static Color statusDownBorder = statusDown.withValues(alpha: 0.3);

  // --- Text --------------------------------------------------------------
  // Not pure white. Everything lit on the Grid carries the hue of whatever lit
  // it, and #FFFFFF beside cyan reads colder than the cyan itself.
  static const Color textPrimary = Color(0xFFE8F6FC); // web --text
  static const Color textSecondary = Color(0xFF93A7B4); // web --text-muted
  static const Color textMuted = Color(0xFF7D909E); // web --text-dim
  static const Color textDim = Color(0xFF5F7280);

  // --- Latency -----------------------------------------------------------
  static const Color latencyFast = Color(0xFF6FC3DF); // < 250ms
  static const Color latencyMed = Color(0xFFFFD166); // < 600ms
  static const Color latencySlow = Color(0xFFFF4747); // >= 600ms

  // --- Glass -------------------------------------------------------------
  // The parameters `GlassPanel` reads. Kept here rather than in the widget so
  // the whole material can be retuned in one place, the same way the web keeps
  // its --glass-* tokens together.
  //
  // iOS blurs harder than most apps do and pairs it with a saturation boost:
  // that pairing is what makes colour behind a panel bleed through as colour
  // rather than as grey. Flutter has no backdrop-saturate, so the tint below
  // carries that job instead.
  static const double glassBlur = 24;
  static const double glassRadius = 18;
  static Color get glassFill => primary.withValues(alpha: 0.055);
  static Color get glassFillStrong => primary.withValues(alpha: 0.085);
  static Color get glassBorder => primary.withValues(alpha: 0.18);

  /// The lit top lip. On iOS this is what separates a pane from a flat
  /// translucent rectangle — light catches the top edge, the bottom falls away.
  static const Color glassHighlight = Color(0x2BC8F0FF);

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgDark,
      primaryColor: primary,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        secondary: accentDeep,
        surface: bgSurface,
        error: statusDown,
        // Near-black rather than pure black: the same reasoning as textPrimary,
        // in the other direction.
        onPrimary: Color(0xFF04121A),
        onSecondary: Color(0xFF04121A),
        onSurface: textPrimary,
        onError: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: bgDark,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: textPrimary),
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.2,
        ),
      ),
      cardTheme: CardThemeData(
        color: bgSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: borderDark, width: 1),
        ),
        margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgSurfaceInput,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: borderDark),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: borderDark),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primary, width: 1.5),
        ),
        hintStyle: const TextStyle(color: textMuted, fontSize: 14),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: const Color(0xFF04121A),
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: bgSurface,
        selectedColor: primary.withValues(alpha: 0.2),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 12),
        secondaryLabelStyle:
            const TextStyle(color: primary, fontSize: 12, fontWeight: FontWeight.bold),
        side: const BorderSide(color: borderDark),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      dividerTheme: const DividerThemeData(color: borderDark, thickness: 1),
    );
  }
}
