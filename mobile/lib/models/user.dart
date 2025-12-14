class User {
  final String? id;
  final String? username;
  final String? email;
  final String? role;
  final bool? isActive;

  const User({this.id, this.username, this.email, this.role, this.isActive});

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: (json['id'] ?? json['_id'])?.toString(),
      username: json['username']?.toString(),
      email: json['email']?.toString(),
      role: json['role']?.toString(),
      isActive: json['is_active'] is bool ? json['is_active'] as bool : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'email': email,
    'role': role,
    'is_active': isActive,
  };
}
