import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/primary_button.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscure = true;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();

    try {
      await auth.login(_username.text.trim(), _password.text);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const DashboardScreen()),
      );
    } catch (_) {
      if (!mounted) return;
      final msg = auth.error ?? 'Đăng nhập thất bại';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: LayoutBuilder(
        builder: (context, c) {
          final isWide = c.maxWidth >= 900;

          return Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  // was: .withOpacity(.12)
                  Theme.of(context).colorScheme.primary.withValues(alpha: .12),
                  Theme.of(context).colorScheme.surface,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: isWide ? 980 : 520),
                child: Card(
                  elevation: 2,
                  margin: const EdgeInsets.all(16),
                  child: Padding(
                    padding: EdgeInsets.all(isWide ? 28 : 20),
                    child: Row(
                      children: [
                        if (isWide) const Expanded(child: _LeftBrandPanel()),
                        Expanded(
                          child: Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: isWide ? 22 : 0,
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  'Đăng nhập',
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineMedium
                                      ?.copyWith(fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Nhập tên tài khoản và mật khẩu để tiếp tục.',
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                                const SizedBox(height: 22),
                                Form(
                                  key: _formKey,
                                  child: Column(
                                    children: [
                                      TextFormField(
                                        controller: _username,
                                        decoration: const InputDecoration(
                                          labelText: 'Tên tài khoản',
                                          hintText: 'Nhập username',
                                          prefixIcon: Icon(
                                            Icons.person_outline,
                                          ),
                                          border: OutlineInputBorder(),
                                        ),
                                        validator: (v) {
                                          if ((v ?? '').trim().isEmpty) {
                                            return 'Vui lòng nhập tên tài khoản';
                                          }
                                          return null;
                                        },
                                      ),
                                      const SizedBox(height: 14),
                                      TextFormField(
                                        controller: _password,
                                        obscureText: _obscure,
                                        decoration: InputDecoration(
                                          labelText: 'Mật khẩu',
                                          prefixIcon: const Icon(
                                            Icons.lock_outline,
                                          ),
                                          border: const OutlineInputBorder(),
                                          suffixIcon: IconButton(
                                            onPressed: () => setState(
                                              () => _obscure = !_obscure,
                                            ),
                                            icon: Icon(
                                              _obscure
                                                  ? Icons.visibility
                                                  : Icons.visibility_off,
                                            ),
                                          ),
                                        ),
                                        validator: (v) {
                                          if ((v ?? '').isEmpty) {
                                            return 'Vui lòng nhập mật khẩu';
                                          }
                                          if ((v ?? '').length < 8) {
                                            return 'Mật khẩu tối thiểu 8 ký tự';
                                          }
                                          return null;
                                        },
                                      ),
                                      const SizedBox(height: 18),
                                      PrimaryButton(
                                        text: 'Đăng nhập',
                                        icon: Icons.login,
                                        loading: auth.loading,
                                        onPressed: auth.loading
                                            ? null
                                            : _submit,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LeftBrandPanel extends StatelessWidget {
  const _LeftBrandPanel();

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        // was: cs.primaryContainer.withOpacity(.35)
        color: cs.primaryContainer.withValues(alpha: .35),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.directions_car_filled, color: cs.primary, size: 34),
              const SizedBox(width: 10),
              Text(
                'Smart Parking',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Hệ thống bãi xe thông minh\n'
            '• Theo dõi chỗ trống\n'
            '• Ghi nhận sự kiện cổng\n'
            '• Cảnh báo & nhật ký',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: const [
              _Tag(text: 'IoT USB'),
              _Tag(text: 'Node.js API'),
              _Tag(text: 'PostgreSQL'),
              _Tag(text: 'JWT Auth'),
            ],
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String text;
  const _Tag({required this.text});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        // was: cs.primary.withOpacity(.35)
        border: Border.all(color: cs.primary.withValues(alpha: .35)),
        color: cs.surface,
      ),
      child: Text(text, style: Theme.of(context).textTheme.bodySmall),
    );
  }
}
