class GateEvent {
  final int id;
  final String eventType;
  final int? freeSlots;
  final int? gateAngle;
  final String? state;
  final String createdAt;

  GateEvent({
    required this.id,
    required this.eventType,
    required this.freeSlots,
    required this.gateAngle,
    required this.state,
    required this.createdAt,
  });

  factory GateEvent.fromJson(Map<String, dynamic> j) => GateEvent(
    id: (j['id'] ?? 0) as int,
    eventType: (j['event_type'] ?? '') as String,
    freeSlots: j['free_slots'] == null ? null : (j['free_slots'] as int),
    gateAngle: j['gate_angle'] == null ? null : (j['gate_angle'] as int),
    state: j['state'] as String?,
    createdAt: (j['created_at'] ?? '') as String,
  );
}
