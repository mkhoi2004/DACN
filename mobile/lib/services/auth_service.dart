import '../models/user.dart';
import 'api_service.dart';

class AuthResult {
  final String token;
  final User? user;
  AuthResult({required this.token, this.user});
}

class AuthService {
  final ApiService api;
  AuthService(this.api);

  /// ✅ ĐÚNG backend của bạn:
  /// POST /api/auth/login
  /// body: { username, password }
  Future<AuthResult> login({
    required String username,
    required String password,
  }) async {
    final payload = await api.post(
      '/api/auth/login',
      body: {'username': username, 'password': password},
    );

    if (payload is! Map<String, dynamic>) {
      throw ApiException('Response không hợp lệ từ server');
    }

    final token = (payload['token'] ?? '').toString();
    if (token.isEmpty) {
      throw ApiException('Không nhận được token từ server');
    }

    final userJson = payload['user'];
    final user = userJson is Map<String, dynamic>
        ? User.fromJson(userJson)
        : null;

    return AuthResult(token: token, user: user);
  }

  /// ✅ GET /api/auth/me (có Bearer token)
  Future<User?> fetchMe(String token) async {
    final payload = await api.get('/api/auth/me', token: token);
    if (payload is Map<String, dynamic>) {
      final u = payload['user'];
      if (u is Map<String, dynamic>) return User.fromJson(u);
    }
    return null;
  }
}
