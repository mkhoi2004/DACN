import '../models/paged.dart';
import '../models/gate_event.dart';
import '../models/alert_item.dart';
import '../models/slot_snapshot.dart';
import 'api_service.dart';

class MonitoringService {
  final ApiService api;
  MonitoringService(this.api);

  Future<Paged<GateEvent>> getGateEvents({
    required String token,
    int page = 1,
    int limit = 10,
  }) async {
    final json = await api.get(
      '/api/gate-events?page=$page&limit=$limit',
      token: token,
    );
    return Paged.fromJson(json, (e) => GateEvent.fromJson(e));
  }

  Future<Paged<AlertItem>> getAlerts({
    required String token,
    int page = 1,
    int limit = 10,
  }) async {
    final json = await api.get(
      '/api/alerts?page=$page&limit=$limit',
      token: token,
    );
    return Paged.fromJson(json, (e) => AlertItem.fromJson(e));
  }

  Future<Paged<Snapshot>> getSnapshots({
    required String token,
    int page = 1,
    int limit = 10,
  }) async {
    final json = await api.get(
      '/api/slot-snapshots?page=$page&limit=$limit',
      token: token,
    );
    return Paged.fromJson(json, (e) => Snapshot.fromJson(e));
  }

  Future<void> handleAlert({required String token, required int id}) async {
    await api.patch('/api/alerts/$id/handle', token: token, body: {});
  }

  /// ✅ Giống web: POST /api/alerts/reset-from-ui
  Future<void> resetAlertsFromUi({required String token}) async {
    await api.post('/api/alerts/reset-from-ui', token: token, body: {});
  }
}
