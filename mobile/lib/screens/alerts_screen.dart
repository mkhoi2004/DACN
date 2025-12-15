import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/monitoring_service.dart';
import '../services/ws_service.dart';
import '../models/alert_item.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  late final MonitoringService service;
  final WsService ws = WsService();

  bool loading = true;
  bool loadingMore = false;
  int page = 1;
  final int limit = 10;
  int total = 0;
  final List<AlertItem> items = [];

  @override
  void initState() {
    super.initState();
    service = MonitoringService(ApiService());

    // Đảm bảo context đã sẵn sàng rồi mới connect realtime
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _connectRealtime();
      _load();
    });
  }

  void _connectRealtime() {
    ws.connect(
      onMessage: (msg) {
        final type = msg['type']?.toString();

        // Alert mới
        if (type == 'ALERT_CREATED') {
          final payload = msg['payload'];
          if (payload is Map) {
            final a = AlertItem.fromJson(Map<String, dynamic>.from(payload));
            if (!mounted) return;
            setState(() {
              items.insert(0, a);
              total += 1;
            });
          }
        }

        // Alert update
        if (type == 'ALERT_UPDATED') {
          final payload = msg['payload'];
          if (payload is Map) {
            final updated = AlertItem.fromJson(
              Map<String, dynamic>.from(payload),
            );
            final idx = items.indexWhere((e) => e.id == updated.id);
            if (!mounted) return;
            if (idx >= 0) {
              setState(() => items[idx] = updated);
            } else {
              // nếu web/backend update 1 alert mà app chưa load trang đó -> add lên đầu để đồng bộ
              setState(() {
                items.insert(0, updated);
                total += 1;
              });
            }
          }
        }

        // Reset từ Arduino / backend
        if (type == 'ALERTS_RESET') {
          if (!mounted) return;
          page = 1;
          _load();
        }
      },
    );
  }

  Future<void> _load({bool more = false}) async {
    final token = context.read<AuthProvider>().token;
    if (token.isEmpty) return;

    if (!mounted) return;
    setState(() {
      if (more) {
        loadingMore = true;
      } else {
        loading = true;
      }
    });

    try {
      final res = await service.getAlerts(
        token: token,
        page: page,
        limit: limit,
      );

      if (!mounted) return;
      setState(() {
        total = res.total;
        if (more) {
          items.addAll(res.items);
        } else {
          items
            ..clear()
            ..addAll(res.items);
        }
      });
    } finally {
      // ✅ FIX: không dùng return trong finally
      if (mounted) {
        setState(() {
          loading = false;
          loadingMore = false;
        });
      }
    }
  }

  String _formatCreatedAt(String? raw) {
    final s = (raw ?? '').trim();
    if (s.isEmpty) return '';
    final dt = DateTime.tryParse(s);
    if (dt == null) return s; // nếu backend trả format lạ thì giữ nguyên
    final local = dt.toLocal();
    String two(int v) => v.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)}/${local.year} '
        '${two(local.hour)}:${two(local.minute)}:${two(local.second)}';
  }

  @override
  void dispose() {
    ws.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final token = context.read<AuthProvider>().token;
    final canLoadMore = items.length < total;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Alerts'),
        actions: [
          // 🔴 NÚT RESET (tắt còi) – giống web: LUÔN HIỂN THỊ
          IconButton(
            tooltip: 'Tắt còi / Reset cảnh báo (CMD_RESET)',
            icon: const Icon(Icons.volume_off),
            onPressed: () async {
              // ✅ FIX: chốt messenger trước khi await để khỏi warning "context across async gaps"
              final messenger = ScaffoldMessenger.of(context);

              try {
                await service.resetAlertsFromUi(token: token);
                if (!mounted) return;
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text('Đã gửi lệnh reset tới Arduino'),
                  ),
                );
              } catch (e) {
                if (!mounted) return;
                messenger.showSnackBar(
                  SnackBar(content: Text('Reset lỗi: $e')),
                );
              }
            },
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                page = 1;
                await _load();
              },
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: items.length + 1,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  if (i == items.length) {
                    if (!canLoadMore) return const SizedBox(height: 40);
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: ElevatedButton(
                        onPressed: loadingMore
                            ? null
                            : () async {
                                page += 1;
                                await _load(more: true);
                              },
                        child: loadingMore
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text('Tải thêm (${items.length}/$total)'),
                      ),
                    );
                  }

                  final a = items[i];
                  return Card(
                    child: ListTile(
                      leading: Icon(
                        a.isHandled
                            ? Icons.check_circle_outline
                            : Icons.warning_amber_outlined,
                        color: a.isHandled ? Colors.green : Colors.redAccent,
                      ),
                      title: Text(
                        a.alertType,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        a.message,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        softWrap: true,
                      ),
                      trailing: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 120),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _formatCreatedAt(a.createdAt),
                              style: const TextStyle(fontSize: 12),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 6),
                            if (!a.isHandled)
                              TextButton(
                                onPressed: () async {
                                  // ✅ FIX: chốt messenger trước khi await
                                  final messenger = ScaffoldMessenger.of(
                                    context,
                                  );

                                  try {
                                    await service.handleAlert(
                                      token: token,
                                      id: a.id,
                                    );
                                    page = 1;
                                    await _load();
                                  } catch (e) {
                                    if (!mounted) return;
                                    messenger.showSnackBar(
                                      SnackBar(content: Text('Handle lỗi: $e')),
                                    );
                                  }
                                },
                                child: const Text('Đã xử lý'),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
