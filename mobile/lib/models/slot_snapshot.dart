class Snapshot {
  final int id;
  final bool slot1Occupied;
  final bool slot2Occupied;
  final int? freeSlots;
  final String createdAt;

  Snapshot({
    required this.id,
    required this.slot1Occupied,
    required this.slot2Occupied,
    required this.freeSlots,
    required this.createdAt,
  });

  factory Snapshot.fromJson(Map<String, dynamic> j) => Snapshot(
    id: (j['id'] ?? 0) as int,
    slot1Occupied: (j['slot1_occupied'] ?? false) as bool,
    slot2Occupied: (j['slot2_occupied'] ?? false) as bool,
    freeSlots: j['free_slots'] == null ? null : (j['free_slots'] as int),
    createdAt: (j['created_at'] ?? '') as String,
  );
}
