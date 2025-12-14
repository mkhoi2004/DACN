import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class ApiException implements Exception {
  final int? statusCode;
  final String message;
  ApiException(this.message, {this.statusCode});

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiService {
  Uri _uri(String path, [Map<String, String>? query]) {
    final fixedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse(
      '${AppConfig.apiBaseUrl}$fixedPath',
    ).replace(queryParameters: query);
  }

  Map<String, String> _headers({String? token}) => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
  };

  dynamic _decode(http.Response res) {
    final text = res.body;
    if (text.isEmpty) return null;
    try {
      return jsonDecode(text);
    } catch (_) {
      return text;
    }
  }

  String _extractError(dynamic payload) {
    if (payload == null) return 'Unknown error';
    if (payload is String) return payload;
    if (payload is Map) {
      return (payload['error'] ??
              payload['message'] ??
              payload['msg'] ??
              payload['detail'] ??
              'Request failed')
          .toString();
    }
    return payload.toString();
  }

  Future<dynamic> get(
    String path, {
    String? token,
    Map<String, String>? query,
  }) async {
    final res = await http
        .get(_uri(path, query), headers: _headers(token: token))
        .timeout(AppConfig.receiveTimeout);

    final payload = _decode(res);
    if (res.statusCode >= 400) {
      throw ApiException(_extractError(payload), statusCode: res.statusCode);
    }
    return payload;
  }

  Future<dynamic> post(
    String path, {
    String? token,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    final res = await http
        .post(
          _uri(path, query),
          headers: _headers(token: token),
          body: jsonEncode(body ?? const {}),
        )
        .timeout(AppConfig.receiveTimeout);

    final payload = _decode(res);
    if (res.statusCode >= 400) {
      throw ApiException(_extractError(payload), statusCode: res.statusCode);
    }
    return payload;
  }

  Future<dynamic> patch(
    String path, {
    String? token,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    final res = await http
        .patch(
          _uri(path, query),
          headers: _headers(token: token),
          body: jsonEncode(body ?? const {}),
        )
        .timeout(AppConfig.receiveTimeout);

    final payload = _decode(res);
    if (res.statusCode >= 400) {
      throw ApiException(_extractError(payload), statusCode: res.statusCode);
    }
    return payload;
  }

  Future<dynamic> put(
    String path, {
    String? token,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    final res = await http
        .put(
          _uri(path, query),
          headers: _headers(token: token),
          body: jsonEncode(body ?? const {}),
        )
        .timeout(AppConfig.receiveTimeout);

    final payload = _decode(res);
    if (res.statusCode >= 400) {
      throw ApiException(_extractError(payload), statusCode: res.statusCode);
    }
    return payload;
  }

  Future<dynamic> delete(
    String path, {
    String? token,
    Map<String, String>? query,
  }) async {
    final res = await http
        .delete(_uri(path, query), headers: _headers(token: token))
        .timeout(AppConfig.receiveTimeout);

    final payload = _decode(res);
    if (res.statusCode >= 400) {
      throw ApiException(_extractError(payload), statusCode: res.statusCode);
    }
    return payload;
  }
}
