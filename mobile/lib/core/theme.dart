import 'package:flutter/material.dart';

/// UptimeMonke modern high-contrast dark design system.
/// Designed for low eye strain with vibrant status indicators.
class AppTheme {
  // Backgrounds
  static const Color bgDark = Color(0xFF0B131E);
  static const Color bgSurface = Color(0xFF131E2E);
  static const Color bgSurfaceElevated = Color(0xFF1B273A);
  static const Color borderDark = Color(0xFF1E2D42);
  static const Color borderLight = Color(0xFF2E3E56);
  static const Color borderSubtle = Color(0xFF1E2D42);

  // Status Backgrounds & Borders
  static Color statusDownBg = const Color(0xFFEF4444).withValues(alpha: 0.12);
  static Color statusDownBorder = const Color(0xFFEF4444).withValues(alpha: 0.3);

  // Status Colors
  static const Color statusUp = Color(0xFF10B981); // Emerald
  static const Color statusDown = Color(0xFFEF4444); // Rose
  static const Color statusPending = Color(0xFFF59E0B); // Amber
  static const Color statusPaused = Color(0xFF64748B); // Slate
  static const Color statusMaintenance = Color(0xFF8B5CF6); // Violet

  // Web UptimeRobot Brand Colors
  static const Color primaryGreen = Color(0xFF3BD671); // #3BD671 signature UptimeMonke green
  static const Color primaryEmerald = Color(0xFF3BD671);
  static const Color accentCyan = Color(0xFF06B6D4);
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textDim = Color(0xFF475569);

  // Latency rating thresholds
  static const Color latencyFast = Color(0xFF3BD671); // < 250ms
  static const Color latencyMed = Color(0xFFF59E0B);  // < 600ms
  static const Color latencySlow = Color(0xFFEF4444); // >= 600ms

  // Additional surfaces matching web CSS
  static const Color bgSurfaceCard = Color(0xFF121A24);
  static const Color bgSurfaceInput = Color(0xFF0F1823);
  static const Color bgSurfaceHover = Color(0xFF1E2B3C);

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgDark,
      primaryColor: primaryEmerald,
      colorScheme: const ColorScheme.dark(
        primary: primaryEmerald,
        secondary: accentCyan,
        surface: bgSurface,
        error: statusDown,
        onPrimary: Colors.black,
        onSecondary: Colors.black,
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
        fillColor: bgSurface,
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
          borderSide: const BorderSide(color: primaryEmerald, width: 1.5),
        ),
        hintStyle: const TextStyle(color: textMuted, fontSize: 14),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryEmerald,
          foregroundColor: Colors.black,
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
        selectedColor: primaryEmerald.withValues(alpha: 0.2),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 12),
        secondaryLabelStyle: const TextStyle(color: primaryEmerald, fontSize: 12, fontWeight: FontWeight.bold),
        side: const BorderSide(color: borderDark),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      dividerTheme: const DividerThemeData(color: borderDark, thickness: 1),
    );
  }
}
