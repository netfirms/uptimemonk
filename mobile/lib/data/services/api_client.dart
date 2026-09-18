import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import '../../core/constants.dart';
import '../models/history.dart';
import '../models/alert_contact.dart';

class ApiException implements Exception {
  final String message;
  final int statusCode;

  ApiException(this.message, this.statusCode);

  @override
  String toString() => 'ApiException ($statusCode): $message';
}

class ApiClient {
  final String baseUrl;

  ApiClient({this.baseUrl = AppConstants.apiUrl});

  Future<Map<String, String>> _authHeaders() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw ApiException('You must be signed in to perform this action', 401);
    }
    final token = await user.getIdToken();
    return {
      'content-type': 'application/json',
      'authorization': 'Bearer $token',
    };
  }

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode == 204) return null;

    dynamic body;
    try {
      body = jsonDecode(response.body);
    } catch (_) {
      body = {'error': response.body};
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    final errorMessage = (body is Map && body['error'] != null)
        ? body['error'].toString()
        : 'Request failed with status ${response.statusCode}';

    throw ApiException(errorMessage, response.statusCode);
  }

  // --- Bootstrap ---
  Future<String> bootstrap() async {
    final headers = await _authHeaders();
    final res = await http.post(
      Uri.parse('$baseUrl/v1/bootstrap'),
      headers: headers,
      body: jsonEncode({}),
    ).timeout(AppConstants.requestTimeout);

    final data = _handleResponse(res) as Map<String, dynamic>;
    return data['orgId'] as String;
  }

  // --- Monitor Operations ---
  Future<Map<String, dynamic>> createMonitor(Map<String, dynamic> input) async {
    final headers = await _authHeaders();
    final res = await http.post(
      Uri.parse('$baseUrl/v1/monitors'),
      headers: headers,
      body: jsonEncode(input),
    ).timeout(AppConstants.requestTimeout);

    return _handleResponse(res) as Map<String, dynamic>;
  }

  Future<void> updateMonitor(String id, Map<String, dynamic> input) async {
    final headers = await _authHeaders();
    final res = await http.patch(
      Uri.parse('$baseUrl/v1/monitors/$id'),
      headers: headers,
      body: jsonEncode(input),
    ).timeout(AppConstants.requestTimeout);

    _handleResponse(res);
  }

  Future<bool> togglePause(String id) async {
    final headers = await _authHeaders();
    final res = await http.post(
      Uri.parse('$baseUrl/v1/monitors/$id/pause'),
      headers: headers,
    ).timeout(AppConstants.requestTimeout);

    final data = _handleResponse(res) as Map<String, dynamic>;
    return data['enabled'] == true;
  }

  Future<void> deleteMonitor(String id) async {
    final headers = await _authHeaders();
    final res = await http.delete(
      Uri.parse('$baseUrl/v1/monitors/$id'),
      headers: headers,
    ).timeout(AppConstants.requestTimeout);

    _handleResponse(res);
  }

  // --- History & Charts ---
  Future<MonitorHistory> fetchHistory(String id, {String range = '24h'}) async {
    final headers = await _authHeaders();
    final res = await http.get(
      Uri.parse('$baseUrl/v1/monitors/$id/history?range=$range'),
      headers: headers,
    ).timeout(AppConstants.requestTimeout);

    final data = _handleResponse(res) as Map<String, dynamic>;
    return MonitorHistory.fromJson(data);
  }

  // --- Device Registration (FCM) ---
  Future<void> registerDevice({
    required String token,
    required String platform,
    String? name,
  }) async {
    final headers = await _authHeaders();
    final res = await http.post(
      Uri.parse('$baseUrl/v1/devices'),
      headers: headers,
      body: jsonEncode({
        'token': token,
        'platform': platform,
        if (name != null) 'name': name,
      }),
    ).timeout(AppConstants.requestTimeout);

    _handleResponse(res);
  }

  Future<void> unregisterDevice(String token) async {
    final headers = await _authHeaders();
    final res = await http.delete(
      Uri.parse('$baseUrl/v1/devices/$token'),
      headers: headers,
    ).timeout(AppConstants.requestTimeout);

    _handleResponse(res);
  }

  // --- Contacts ---
  Future<List<AlertContact>> fetchContacts() async {
    final headers = await _authHeaders();
    final res = await http.get(
      Uri.parse('$baseUrl/v1/contacts'),
      headers: headers,
    ).timeout(AppConstants.requestTimeout);

    final data = _handleResponse(res) as Map<String, dynamic>;
    final list = data['contacts'] as List<dynamic>? ?? [];
    return list.map((c) => AlertContact.fromJson(c as Map<String, dynamic>)).toList();
  }

  Future<void> testContact(String id) async {
    final headers = await _authHeaders();
    final res = await http.post(
      Uri.parse('$baseUrl/v1/contacts/$id/test'),
      headers: headers,
    ).timeout(AppConstants.requestTimeout);

    _handleResponse(res);
  }
}
