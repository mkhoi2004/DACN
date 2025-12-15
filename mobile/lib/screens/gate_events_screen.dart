import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/monitoring_service.dart';
import '../services/ws_service.dart';
import '../models/gate_event.dart';

class GateEventsScreen extends StatefulWidget {
  const GateEventsScreen({super.key});

  @override
  State<GateEventsScreen> createState() => _GateEventsScreenState();
}

class _GateEventsScreenState extends State<GateEventsScreen> {
  late final MonitoringService service;
  final WsService ws = WsService();

  bool loading = true;
  bool loadingMore = false;
  int page = 1;
  final int limit = 10;
  int total = 0;
  final List<GateEvent> items = [];

  @override
  void initState() {
    super.initState();
    service = MonitoringService(ApiService());

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _connectRealtime();
      _load();
    });
  }

  void _connectRealtime() {
    ws.connect(
      onMessage: (msg) {
        final type = msg['type']?.toString();

        if (type == 'GATE_EVENT_CREATED') {
          final payload = msg['payload'];
          if (payload is Map) {
            final ev = GateEvent.fromJson(Map<String, dynamic>.from(payload));
            if (!mounted) return;
            setState(() {
              items.insert(0, ev);
              total += 1;
            });
          }
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
      final res = await service.getGateEvents(
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
      if (!mounted) return;
      setState(() {
        loading = false;
        loadingMore = false;
      });
    }
  }

  String _formatCreatedAt(String? raw) {
    final s = (raw ?? '').trim();
    if (s.isEmpty) return '';
    final dt = DateTime.tryParse(s);
    if (dt == null) return s;
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
    final canLoadMore = items.length < total;

    return Scaffold(
      appBar: AppBar(title: const Text('Gate Events')),
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

                  final e = items[i];
                  return Card(
                    child: ListTile(
                      leading: const Icon(Icons.meeting_room_outlined),
                      title: Text(
                        e.eventType ?? '—',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        'freeSlots: ${e.freeSlots ?? '-'} | '
                        'gate: ${e.gateAngle ?? '-'} | '
                        'state: ${e.state ?? '-'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        softWrap: false,
                      ),
                      trailing: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 110),
                        child: Text(
                          _formatCreatedAt(e.createdAt),
                          style: const TextStyle(fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
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
