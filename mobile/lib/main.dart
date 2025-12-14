import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final api = ApiService();
    final authService = AuthService(api);

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AuthProvider(authService)..init(),
        ),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Smart Parking',
        theme: ThemeData(
          useMaterial3: true,
          colorSchemeSeed: const Color(0xFF3B82F6),
          cardTheme: const CardThemeData(margin: EdgeInsets.zero),
        ),
        home: const _Root(),
      ),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.isLoggedIn) return const DashboardScreen();
    return const LoginScreen();
  }
}
