import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/monitor.dart';
import 'package:mobile/data/models/live_state.dart';

void main() {
  test('MonitorConfig and LiveState domain models parse correctly', () {
    final monitor = MonitorConfig.fromFirestore('m1', {
      'orgId': 'org1',
      'name': 'Inference API',
      'type': 'http',
      'target': 'https://api.example.com',
      'intervalSeconds': 30,
      'enabled': true,
    });

    expect(monitor.id, 'm1');
    expect(monitor.name, 'Inference API');
    expect(monitor.intervalSeconds, 30);
    expect(monitor.enabled, isTrue);

    final live = LiveState.fromMap({
      'status': 'up',
      'responseTimeMs': 45,
      'uptime24h': 99.95,
    });

    expect(live.isUp, isTrue);
    expect(live.responseTimeMs, 45);
    expect(live.uptime24h, 99.95);
  });
}
