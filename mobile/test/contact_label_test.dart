import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/alert_contact.dart';
import 'package:mobile/ui/settings/settings_screen.dart';

AlertContact c({String name = '', String channel = 'email', String destination = 'a@b.com'}) =>
    AlertContact(id: 'x', channel: channel, name: name, destination: destination);

void main() {
  group('what a contact is called on screen', () {
    test('its name, when it has one', () {
      expect(contactLabel(c(name: 'Android (me@example.com)')), 'Android (me@example.com)');
    });

    test('a push contact never falls back to its destination', () {
      // That destination is the FCM device token — 200 characters of base64
      // that tells a reader nothing and is a device credential besides.
      final token = 'd6CYzYLfMEblrAX8Aitatv:APA91bGLHOTgmY4DDC1bpk2EIpMTekTz4U0V7UAcKOy6';
      final label = contactLabel(c(channel: 'fcm', destination: token));
      expect(label, 'This device');
      expect(label.contains(token), isFalse);
    });

    test('other channels do fall back — an address is meaningful', () {
      expect(contactLabel(c(channel: 'email', destination: 'ops@x.com')), 'ops@x.com');
    });

    test('whitespace is not a name', () {
      expect(contactLabel(c(name: '   ', channel: 'fcm')), 'This device');
    });
  });
}
