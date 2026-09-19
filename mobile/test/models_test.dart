import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/monitor.dart';
import 'package:mobile/data/models/live_state.dart';
import 'package:mobile/data/models/history.dart';
import 'package:mobile/data/models/alert_contact.dart';

void main() {
  group('MonitorConfig.fromFirestore', () {
    test('parses a full monitor document', () {
      final m = MonitorConfig.fromFirestore('m1', {
        'orgId': 'org1',
        'name': 'Inference API',
        'type': 'http',
        'target': 'https://api.example.com',
        'intervalSeconds': 30,
        'timeoutSeconds': 5,
        'confirmationThreshold': 3,
        'enabled': true,
        'publicOnStatusPage': true,
        'muteAlerts': false,
        'alertContactIds': ['c1', 'c2'],
        'method': 'GET',
        'maxResponseTimeMs': 800,
      });

      expect(m.id, 'm1');
      expect(m.orgId, 'org1');
      expect(m.name, 'Inference API');
      expect(m.type, 'http');
      expect(m.target, 'https://api.example.com');
      expect(m.intervalSeconds, 30);
      expect(m.timeoutSeconds, 5);
      expect(m.confirmationThreshold, 3);
      expect(m.enabled, isTrue);
      expect(m.publicOnStatusPage, isTrue);
      expect(m.muteAlerts, isFalse);
      expect(m.alertContactIds, ['c1', 'c2']);
      expect(m.maxResponseTimeMs, 800);
    });

    test('applies defaults on an empty map', () {
      final m = MonitorConfig.fromFirestore('m2', {});
      expect(m.orgId, '');
      expect(m.name, 'Untitled');
      expect(m.type, 'http');
      expect(m.target, '');
      expect(m.intervalSeconds, 60);
      expect(m.timeoutSeconds, 10);
      expect(m.confirmationThreshold, 2);
      expect(m.enabled, isTrue);
      expect(m.publicOnStatusPage, isFalse);
      expect(m.muteAlerts, isFalse);
      expect(m.alertContactIds, isEmpty);
    });

    test('publicOnStatusPage is opt-in: absence means private', () {
      // A monitor written before the field existed must not become public.
      final missing = MonitorConfig.fromFirestore('m3', {'name': 'old'});
      expect(missing.publicOnStatusPage, isFalse);

      final explicitTrue =
          MonitorConfig.fromFirestore('m4', {'publicOnStatusPage': true});
      expect(explicitTrue.publicOnStatusPage, isTrue);

      final explicitFalse =
          MonitorConfig.fromFirestore('m5', {'publicOnStatusPage': false});
      expect(explicitFalse.publicOnStatusPage, isFalse);
    });

    test('enabled is false only when explicitly false', () {
      expect(MonitorConfig.fromFirestore('a', {}).enabled, isTrue);
      expect(
        MonitorConfig.fromFirestore('b', {'enabled': false}).enabled,
        isFalse,
      );
    });

    test('coerces numeric fields from double to int', () {
      final m = MonitorConfig.fromFirestore('m6', {'intervalSeconds': 45.0});
      expect(m.intervalSeconds, 45);
    });

    test('maps requestHeaders values to strings', () {
      final m = MonitorConfig.fromFirestore('m7', {
        'requestHeaders': {'X-Retries': 3, 'Accept': 'application/json'},
      });
      expect(m.requestHeaders, {'X-Retries': '3', 'Accept': 'application/json'});
    });

    test('parses sslExpiryAlertDays list of ints', () {
      final m = MonitorConfig.fromFirestore('m8', {
        'sslExpiryAlertDays': [30, 7, 1],
      });
      expect(m.sslExpiryAlertDays, [30, 7, 1]);
    });

    test('strips sslMinVersion when it is "none" in toJson', () {
      final m = MonitorConfig.fromFirestore('m9', {'sslMinVersion': 'none'});
      expect(m.toJson().containsKey('sslMinVersion'), isFalse);
    });
  });

  group('MonitorConfig.toJson', () {
    test('omits null optional fields', () {
      final json = MonitorConfig.fromFirestore('m1', {
        'name': 'x',
        'target': 'https://x.test',
      }).toJson();

      expect(json.containsKey('port'), isFalse);
      expect(json.containsKey('keyword'), isFalse);
      expect(json.containsKey('heartbeatGraceSeconds'), isFalse);
      // Required fields are always present.
      expect(json['intervalSeconds'], 60);
      expect(json['timeoutSeconds'], 10);
      expect(json['confirmationThreshold'], 2);
      expect(json['publicOnStatusPage'], isFalse);
      expect(json['muteAlerts'], isFalse);
      expect(json['alertContactIds'], isEmpty);
    });

    test('includes optional fields when set', () {
      final json = MonitorConfig.fromFirestore('m1', {
        'name': 'x',
        'target': 'https://x.test',
        'port': 443,
        'keyword': 'ok',
        'heartbeatGraceSeconds': 120,
      }).toJson();

      expect(json['port'], 443);
      expect(json['keyword'], 'ok');
      expect(json['heartbeatGraceSeconds'], 120);
    });
  });

  group('LiveState', () {
    test('parses a full state map', () {
      final s = LiveState.fromMap({
        'status': 'up',
        'responseTimeMs': 45,
        'lastCheckedAt': 1700000000000,
        'uptime24h': 99.95,
        'uptime7d': 99.9,
        'uptime30d': 99.8,
        'certExpiresAt': 1800000000000,
        'certIssuer': "Let's Encrypt",
      });

      expect(s.status, 'up');
      expect(s.responseTimeMs, 45);
      expect(s.lastCheckedAt, 1700000000000);
      expect(s.uptime24h, 99.95);
      expect(s.uptime7d, 99.9);
      expect(s.uptime30d, 99.8);
      expect(s.certExpiresAt, 1800000000000);
      expect(s.certIssuer, "Let's Encrypt");
    });

    test('defaults status to pending on an empty map', () {
      final s = LiveState.fromMap({});
      expect(s.status, 'pending');
      expect(s.isPending, isTrue);
      expect(s.responseTimeMs, isNull);
      expect(s.uptime24h, isNull);
    });

    test('status helpers are mutually consistent', () {
      expect(LiveState.fromMap({'status': 'up'}).isUp, isTrue);
      expect(LiveState.fromMap({'status': 'down'}).isDown, isTrue);
      expect(LiveState.fromMap({'status': 'paused'}).isPaused, isTrue);
      expect(LiveState.fromMap({'status': 'pending'}).isPending, isTrue);
      expect(LiveState.fromMap({'status': 'up'}).isDown, isFalse);
    });

    test('coerces integer uptime into double', () {
      final s = LiveState.fromMap({'uptime24h': 100});
      expect(s.uptime24h, 100.0);
    });
  });

  group('AlertContact.fromJson', () {
    test('parses a verified, enabled contact', () {
      final c = AlertContact.fromJson({
        'id': 'c1',
        'channel': 'email',
        'name': 'Ops',
        'destination': 'ops@example.com',
        'enabled': true,
        'verified': true,
      });
      expect(c.id, 'c1');
      expect(c.channel, 'email');
      expect(c.name, 'Ops');
      expect(c.destination, 'ops@example.com');
      expect(c.enabled, isTrue);
      expect(c.verified, isTrue);
    });

    test('verified is false unless explicitly true', () {
      // A client that could set this could page a stranger.
      expect(AlertContact.fromJson({'id': 'x'}).verified, isFalse);
      expect(AlertContact.fromJson({'id': 'x', 'verified': 'yes'}).verified,
          isFalse);
    });

    test('enabled defaults to true, false only when explicitly false', () {
      expect(AlertContact.fromJson({'id': 'x'}).enabled, isTrue);
      expect(AlertContact.fromJson({'id': 'x', 'enabled': false}).enabled,
          isFalse);
    });

    test('defaults channel to email and strings to empty', () {
      final c = AlertContact.fromJson({'id': 'x'});
      expect(c.channel, 'email');
      expect(c.name, '');
      expect(c.destination, '');
    });
  });

  group('History models', () {
    test('Bucket.fromJson parses and defaults', () {
      final b = Bucket.fromJson({
        't': 1700000000000,
        'up': 10,
        'down': 1,
        'avgMs': 42.5,
        'uptimeRatio': 0.99,
      });
      expect(b.t, 1700000000000);
      expect(b.up, 10);
      expect(b.down, 1);
      expect(b.avgMs, 42.5);
      expect(b.uptimeRatio, 0.99);

      final empty = Bucket.fromJson({'t': 1});
      expect(empty.up, 0);
      expect(empty.down, 0);
      expect(empty.avgMs, 0.0);
      expect(empty.uptimeRatio, 1.0);
    });

    test('HistoryPoint.fromJson parses and defaults code', () {
      final p = HistoryPoint.fromJson({'t': 1, 'ms': 12.5, 'ok': true});
      expect(p.t, 1);
      expect(p.ms, 12.5);
      expect(p.ok, isTrue);
      expect(p.code, isNull);

      final withCode =
          HistoryPoint.fromJson({'t': 1, 'ms': 1, 'ok': false, 'code': 500});
      expect(withCode.ok, isFalse);
      expect(withCode.code, 500);
    });

    test('HistoryIncident.isResolved follows status', () {
      final open = HistoryIncident.fromJson({
        'id': 'i1',
        'startedAt': 1,
        'status': 'open',
      });
      expect(open.isResolved, isFalse);

      final resolved = HistoryIncident.fromJson({
        'id': 'i2',
        'startedAt': 1,
        'resolvedAt': 2,
        'durationSeconds': 60,
        'status': 'resolved',
      });
      expect(resolved.isResolved, isTrue);
      expect(resolved.durationSeconds, 60);
    });

    test('HistoryIncident defaults cause and status', () {
      final i = HistoryIncident.fromJson({'id': 'i1', 'startedAt': 1});
      expect(i.cause, 'Unknown error');
      expect(i.status, 'open');
    });

    test('MonitorHistory.fromJson parses lists and defaults', () {
      final h = MonitorHistory.fromJson({
        'range': '7d',
        'granularity': 'day',
        'buckets': [
          {'t': 1, 'up': 1, 'down': 0, 'avgMs': 1.0, 'uptimeRatio': 1.0}
        ],
        'points': [
          {'t': 1, 'ms': 1.0, 'ok': true}
        ],
        'incidents': [
          {'id': 'i1', 'startedAt': 1, 'status': 'resolved'}
        ],
        'summary': {'uptime': 99.9},
      });

      expect(h.range, '7d');
      expect(h.granularity, 'day');
      expect(h.buckets, hasLength(1));
      expect(h.points, hasLength(1));
      expect(h.incidents, hasLength(1));
      expect(h.summary['uptime'], 99.9);
    });

    test('MonitorHistory defaults on an empty map', () {
      final h = MonitorHistory.fromJson({});
      expect(h.range, '24h');
      expect(h.granularity, 'hour');
      expect(h.buckets, isEmpty);
      expect(h.points, isEmpty);
      expect(h.incidents, isEmpty);
      expect(h.summary, isEmpty);
    });
  });
}
