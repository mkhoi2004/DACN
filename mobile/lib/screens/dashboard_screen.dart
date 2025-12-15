import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/monitoring_service.dart';
import '../services/ws_service.dart';

import '../models/alert_item.dart';
import '../models/gate_event.dart';
import '../models/slot_snapshot.dart'; // ✅ Snapshot nằm trong đây

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  late final TabController tab;
  late final MonitoringService service;
  final WsService ws = WsService();

  bool resetLoading = false;
  String resetMsg = '';
  String resetErr = '';

  final List<AlertItem> alerts = [];
  final List<GateEvent> gateEvents = [];
  final List<Snapshot> snapshots = [];

  int alertsTotal = 0;
  int gateTotal = 0;
  int snapTotal = 0;

  bool alarmActive = false;
  int freeSlots = 0;

  @override
  void initState() {
    super.initState();
    tab = TabController(length: 4, vsync: this);
    service = MonitoringService(ApiService());

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _loadAll();
      if (!mounted) return;
      _connectRealtime();
    });
  }

  Future<void> _loadAll() async {
    // ✅ đọc token 1 lần trước async để tránh warning use_build_context_synchronously
    final token = context.read<AuthProvider>().token;
    if (token.isEmpty) return;

    final a = await service.getAlerts(token: token, page: 1, limit: 50);
    alerts
      ..clear()
      ..addAll(a.items);
    alertsTotal = a.total;
    alarmActive = alerts.any((x) => !x.isHandled);

    final g = await service.getGateEvents(token: token, page: 1, limit: 50);
    gateEvents
      ..clear()
      ..addAll(g.items);
    gateTotal = g.total;

    final s = await service.getSnapshots(token: token, page: 1, limit: 50);
    snapshots
      ..clear()
      ..addAll(s.items);
    snapTotal = s.total;

    // ✅ FIX: if phải có block {}
    if (snapshots.isNotEmpty) {
      freeSlots = snapshots.first.freeSlots ?? freeSlots;
    }

    if (mounted) setState(() {});
  }

  void _connectRealtime() {
    ws.connect(
      onMessage: (msg) {
        if (!mounted) return; // ✅ tránh setState sau dispose

        final type = msg['type'];

        if (type == 'GATE_EVENT_CREATED') {
          final p = Map<String, dynamic>.from(msg['payload']);
          final item = GateEvent.fromJson(p);
          setState(() {
            gateEvents.insert(0, item);
            gateTotal += 1;
          });
        }

        if (type == 'SNAPSHOT_CREATED') {
          final p = Map<String, dynamic>.from(msg['payload']);
          final item = Snapshot.fromJson(p);
          setState(() {
            snapshots.insert(0, item);
            snapTotal += 1;
            freeSlots = item.freeSlots ?? freeSlots;
          });
        }

        if (type == 'ALERT_CREATED') {
          final p = Map<String, dynamic>.from(msg['payload']);
          final item = AlertItem.fromJson(p);
          setState(() {
            alerts.insert(0, item);
            alertsTotal += 1;
            if (!item.isHandled) alarmActive = true;
          });
        }

        if (type == 'ALERT_UPDATED') {
          final p = Map<String, dynamic>.from(msg['payload']);
          final updated = AlertItem.fromJson(p);
          setState(() {
            final idx = alerts.indexWhere((x) => x.id == updated.id);
            if (idx != -1) alerts[idx] = updated;
            alarmActive = alerts.any((x) => !x.isHandled);
          });
        }

        if (type == 'ALERTS_RESET') {
          setState(() {
            for (var i = 0; i < alerts.length; i++) {
              final a = alerts[i];
              alerts[i] = AlertItem(
                id: a.id,
                alertType: a.alertType,
                message: a.message,
                isHandled: true,
                createdAt: a.createdAt,
              );
            }
            alarmActive = false;
          });
        }
      },
    );
  }

  Future<void> _resetFromUi() async {
    final token = context.read<AuthProvider>().token;
    if (token.isEmpty) return;

    // ✅ setState chỉ khi mounted
    if (mounted) {
      setState(() {
        resetErr = '';
        resetMsg = '';
        resetLoading = true;
      });
    }

    try {
      await service.resetAlertsFromUi(token: token);

      if (mounted) {
        setState(() {
          resetMsg =
              'Đã gửi lệnh reset tới Arduino. Chờ vài giây để cảnh báo cập nhật realtime.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => resetErr = e.toString());
      }
    } finally {
      // ✅ FIX: KHÔNG return trong finally
      if (mounted) {
        setState(() => resetLoading = false);
      }
    }
  }

  @override
  void dispose() {
    ws.dispose();
    tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Smart Parking – User'),
        bottom: TabBar(
          controller: tab,
          tabs: const [
            Tab(text: 'Tổng quan'),
            Tab(text: 'Alerts'),
            Tab(text: 'Gate events'),
            Tab(text: 'Snapshots'),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 180),
              child: FilledButton.icon(
                onPressed: resetLoading ? null : _resetFromUi,
                icon: const Icon(Icons.volume_off),
                label: Text(
                  resetLoading ? 'Đang gửi reset...' : 'Đã xử lý cảnh báo',
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: alarmActive ? Colors.red : Colors.grey,
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Reload',
            icon: const Icon(Icons.refresh),
            onPressed: _loadAll,
          ),
          IconButton(
            tooltip: 'Đăng xuất',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Đăng xuất'),
                  content: const Text('Bạn có chắc muốn đăng xuất?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(false),
                      child: const Text('Hủy'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(true),
                      child: const Text('Đăng xuất'),
                    ),
                  ],
                ),
              );

              // ✅ FIX lint: dùng context sau await -> check context.mounted
              if (!context.mounted) return;

              if (confirm == true) {
                await context.read<AuthProvider>().logout();
              }
            },
          ),
        ],
      ),
      body: TabBarView(
        controller: tab,
        children: [
          _OverviewTab(
            alarmActive: alarmActive,
            freeSlots: freeSlots,
            alerts: alertsTotal,
            snapshots: snapTotal,
            gateEvents: gateTotal,
            resetMsg: resetMsg,
            resetErr: resetErr,
            userText: user == null
                ? '—'
                : 'Xin chào, ${user.username} – role ${user.role}',
          ),
          _AlertsTab(
            alerts: alerts,
            onHandle: (id) async {
              final token = context.read<AuthProvider>().token;
              if (token.isEmpty) return;
              await service.handleAlert(token: token, id: id);
            },
          ),
          _GateTab(items: gateEvents),
          _SnapTab(items: snapshots),
        ],
      ),
    );
  }
}

/* ---------------- TABS ---------------- */

class _OverviewTab extends StatelessWidget {
  final bool alarmActive;
  final int freeSlots;
  final int alerts;
  final int snapshots;
  final int gateEvents;
  final String resetMsg;
  final String resetErr;
  final String userText;

  const _OverviewTab({
    required this.alarmActive,
    required this.freeSlots,
    required this.alerts,
    required this.snapshots,
    required this.gateEvents,
    required this.resetMsg,
    required this.resetErr,
    required this.userText,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(userText),
        const SizedBox(height: 12),
        Card(
          color: alarmActive
              ? Theme.of(context).colorScheme.errorContainer
              : Theme.of(context).colorScheme.secondaryContainer,
          child: ListTile(
            leading: Icon(alarmActive ? Icons.warning : Icons.check_circle),
            title: Text(
              alarmActive
                  ? '🚨 Đang có cảnh báo (còi có thể kêu)'
                  : '✅ Hệ thống bình thường',
            ),
            subtitle: Text('Free slots realtime: $freeSlots'),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _KpiCard(title: 'Alerts', value: '$alerts'),
            _KpiCard(title: 'Gate', value: '$gateEvents'),
            _KpiCard(title: 'Snapshots', value: '$snapshots'),
          ],
        ),
        const SizedBox(height: 12),
        if (resetMsg.isNotEmpty)
          Text(resetMsg, style: const TextStyle(color: Colors.green)),
        if (resetErr.isNotEmpty)
          Text(resetErr, style: const TextStyle(color: Colors.red)),
      ],
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String title;
  final String value;
  const _KpiCard({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(
                value,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AlertsTab extends StatelessWidget {
  final List<AlertItem> alerts;
  final Future<void> Function(int id) onHandle;

  const _AlertsTab({required this.alerts, required this.onHandle});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: alerts.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final a = alerts[i];
        return Card(
          child: ListTile(
            leading: Icon(
              a.isHandled ? Icons.check_circle : Icons.warning,
              color: a.isHandled ? Colors.green : Colors.red,
            ),
            title: Text(
              '${a.alertType}  •  #${a.id}',
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
              constraints: const BoxConstraints(maxWidth: 140),
              child: a.isHandled
                  ? const Text('Đã xử lý')
                  : TextButton(
                      onPressed: () => onHandle(a.id),
                      child: const Text('Đánh dấu đã xử lý'),
                    ),
            ),
          ),
        );
      },
    );
  }
}

class _GateTab extends StatelessWidget {
  final List<GateEvent> items;
  const _GateTab({required this.items});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final g = items[i];
        return Card(
          child: ListTile(
            leading: const Icon(Icons.meeting_room),
            title: Text(
              '${g.eventType}  •  #${g.id}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              'freeSlots=${g.freeSlots ?? '-'}  gate=${g.gateAngle ?? '-'}  state=${g.state ?? '-'}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              softWrap: false,
            ),
          ),
        );
      },
    );
  }
}

class _SnapTab extends StatelessWidget {
  final List<Snapshot> items;
  const _SnapTab({required this.items});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final s = items[i];
        return Card(
          child: ListTile(
            leading: const Icon(Icons.timeline),
            title: Text(
              'Snapshot • #${s.id}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              'slot1=${s.slot1Occupied ? 1 : 0}  slot2=${s.slot2Occupied ? 1 : 0}  freeSlots=${s.freeSlots ?? '-'}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              softWrap: false,
            ),
          ),
        );
      },
    );
  }
}
