import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/app_config.dart';

class WsService {
  WebSocketChannel? _channel;

  void connect({
    required void Function(Map<String, dynamic>) onMessage,
    void Function(Object error)? onError,
    void Function()? onDone,
  }) {
    // AppConfig.apiBaseUrl: http(s)://... => ws(s)://...
    final wsUrl = AppConfig.apiBaseUrl
        .replaceFirst('https://', 'wss://')
        .replaceFirst('http://', 'ws://');

    final uri = Uri.parse(wsUrl);

    _channel = WebSocketChannel.connect(uri);

    _channel!.stream.listen(
      (data) {
        try {
          final json = jsonDecode(data);
          if (json is Map<String, dynamic>) onMessage(json);
        } catch (_) {}
      },
      onError: onError,
      onDone: onDone,
    );
  }

  void dispose() {
    _channel?.sink.close();
    _channel = null;
  }
}
