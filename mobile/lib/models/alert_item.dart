class AlertItem {
  final int id;
  final String alertType;
  final String message;
  final bool isHandled;
  final String createdAt;

  AlertItem({
    required this.id,
    required this.alertType,
    required this.message,
    required this.isHandled,
    required this.createdAt,
  });

  factory AlertItem.fromJson(Map<String, dynamic> j) => AlertItem(
    id: (j['id'] ?? 0) as int,
    alertType: (j['alert_type'] ?? '') as String,
    message: (j['message'] ?? '') as String,
    isHandled: (j['is_handled'] ?? false) as bool,
    createdAt: (j['created_at'] ?? '') as String,
  );
}
