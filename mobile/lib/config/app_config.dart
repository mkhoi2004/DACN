class AppConfig {
  /// Backend chạy local (có Arduino USB) nhưng public ra ngoài qua ngrok
  /// Dùng chung cho:
  /// - Web (Vercel)
  /// - Flutter mobile (điện thoại thật)
  ///
  /// ⚠️ BẮT BUỘC dùng HTTPS khi:
  /// - Web deploy trên Vercel (HTTPS)
  /// - Flutter gọi từ mạng ngoài / 4G / WiFi khác
  static const String apiBaseUrl = 'https://awaited-easy-marten.ngrok-free.app';

  /// Timeout cho HTTP request
  static const Duration connectTimeout = Duration(seconds: 12);
  static const Duration receiveTimeout = Duration(seconds: 20);
}
