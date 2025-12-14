import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService authService;
  AuthProvider(this.authService);

  bool _loading = false;
  bool get loading => _loading;

  String _token = '';
  String get token => _token;

  User? _user;
  User? get user => _user;

  String? _error;
  String? get error => _error;

  bool get isLoggedIn => _token.isNotEmpty;

  Future<void> init() async {
    final sp = await SharedPreferences.getInstance();
    _token = sp.getString('token') ?? '';

    final rawUser = sp.getString('user');
    if (rawUser != null && rawUser.isNotEmpty) {
      try {
        _user = User.fromJson(jsonDecode(rawUser) as Map<String, dynamic>);
      } catch (_) {}
    }

    // Nếu có token mà chưa có user => gọi /api/auth/me
    if (_token.isNotEmpty && _user == null) {
      try {
        _user = await authService.fetchMe(_token);
        await _persist();
      } catch (_) {}
    }

    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    _setLoading(true);
    _error = null;

    try {
      final res = await authService.login(
        username: username,
        password: password,
      );
      _token = res.token;
      _user = res.user;

      // nếu response login chưa trả user đủ -> fetch /me
      if (_user == null) {
        try {
          final me = await authService.fetchMe(_token);
          if (me != null) _user = me;
        } catch (_) {}
      }

      await _persist();
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  Future<void> logout() async {
    _token = '';
    _user = null;
    _error = null;
    final sp = await SharedPreferences.getInstance();
    await sp.remove('token');
    await sp.remove('user');
    notifyListeners();
  }

  Future<void> _persist() async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString('token', _token);
    if (_user != null) {
      await sp.setString('user', jsonEncode(_user!.toJson()));
    }
    notifyListeners();
  }

  void _setLoading(bool v) {
    _loading = v;
    notifyListeners();
  }
}
