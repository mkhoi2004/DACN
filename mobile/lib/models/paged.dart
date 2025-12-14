class Paged<T> {
  final List<T> items;
  final int total;
  final int page;
  final int limit;

  Paged({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
  });

  factory Paged.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromItem,
  ) {
    final raw = (json['items'] as List?) ?? [];
    return Paged<T>(
      items: raw.map((e) => fromItem(Map<String, dynamic>.from(e))).toList(),
      total: (json['total'] ?? 0) as int,
      page: (json['page'] ?? 1) as int,
      limit: (json['limit'] ?? raw.length) as int,
    );
  }
}
