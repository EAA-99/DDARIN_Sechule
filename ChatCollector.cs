using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace DdarinSongCollector;

record ChatInfo(string Host, int Port, string Bjid, string ChatNo, string Token, string Bps, string GeoCc, string GeoRc, string AcceptLanguage, string ServiceLanguage);

static class ChatCollector
{
    // ===== 설정 =====
    const string StreamerId = "insome0319";
    const string IngestUrl = "https://ddarin-sechule.vercel.app/api/soop-chat";
    const string IngestKey = "0319"; // Vercel 환경변수 SOOP_CHAT_INGEST_KEY와 반드시 같아야 함
    // ================================================

    // ===== SOOP 채팅 프로토콜 (https://github.com/Gyeon-ai/- DanPinball 참고, 비공식/역공학) =====
    const string Fs = "";
    const string CmdConnect = "	00010000060016";

    static string BuildPacket(int serviceCommand, string body)
    {
        string header = "	" + serviceCommand.ToString().PadLeft(4, '0') + body.Length.ToString().PadLeft(6, '0') + "00";
        return header + body;
    }

    static string BuildJoinBody(ChatInfo info)
    {
        var sb = new StringBuilder();
        sb.Append(Fs).Append(info.ChatNo);
        sb.Append(Fs).Append(info.Token);
        sb.Append(Fs).Append("0").Append(Fs).Append(Fs).Append("log\u0011");
        sb.Append("\u0006&\u0006set_bps\u0006=\u0006").Append(info.Bps);
        sb.Append("\u0006&\u0006view_bps\u0006=\u0006").Append(info.Bps);
        sb.Append("\u0006&\u0006quality\u0006=\u0006ori");
        sb.Append("\u0006&\u0006geo_cc\u0006=\u0006").Append(info.GeoCc);
        sb.Append("\u0006&\u0006geo_rc\u0006=\u0006").Append(info.GeoRc);
        sb.Append("\u0006&\u0006acpt_lang\u0006=\u0006").Append(info.AcceptLanguage);
        sb.Append("\u0006&\u0006svc_lang\u0006=\u0006").Append(info.ServiceLanguage);
        sb.Append("\u0006&\u0006subscribe\u0006=\u00060");
        sb.Append("\u0006&\u0006lowlatency\u0006=\u00061");
        sb.Append("\u0012pwd\u0011\u0012");
        sb.Append("auth_info\u0011NULL\u0012");
        sb.Append("pver\u00112\u0012");
        sb.Append("access_system\u0011html5\u0012");
        sb.Append(Fs);
        return sb.ToString();
    }
    // ================================================

    static void Log(params object?[] args)
    {
        var time = DateTime.Now.ToString("tt h:mm:ss", new System.Globalization.CultureInfo("ko-KR"));
        Console.WriteLine(time + " - " + string.Join(" ", args));
    }

    static async Task<ChatInfo> GetChatInfoAsync(HttpClient http)
    {
        var form = new Dictionary<string, string>
        {
            ["bid"] = StreamerId,
            ["type"] = "live",
            ["pwd"] = "",
            ["player_type"] = "html5",
            ["stream_type"] = "common",
            ["mode"] = "landing",
            ["from_api"] = "0",
        };

        var url = $"https://live.sooplive.co.kr/afreeca/player_live_api.php?bjid={Uri.EscapeDataString(StreamerId)}";
        using var res = await http.PostAsync(url, new FormUrlEncodedContent(form));
        var json = await res.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("CHANNEL", out var channel))
        {
            throw new Exception("방송 중이 아니거나 채팅 정보를 가져오지 못했습니다.");
        }

        string GetStr(string name) => channel.TryGetProperty(name, out var v) && v.ValueKind != JsonValueKind.Null ? v.ToString() : "";

        var host = GetStr("CHDOMAIN");
        if (string.IsNullOrEmpty(host)) host = GetStr("CHIP");
        var chpt = GetStr("CHPT");
        var port = (int.TryParse(chpt, out var p) ? p : 0) + 1;
        var chatNo = GetStr("CHATNO");
        var token = GetStr("FTK");

        if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(chatNo) || string.IsNullOrEmpty(token))
        {
            throw new Exception("방송 중이 아니거나 채팅 정보를 가져오지 못했습니다.");
        }

        var bjid = GetStr("BJID");
        if (string.IsNullOrEmpty(bjid)) bjid = StreamerId;

        return new ChatInfo(host, port, bjid, chatNo, token, GetStr("BPS"), GetStr("geo_cc"), GetStr("geo_rc"), GetStr("acpt_lang"), GetStr("svc_lang"));
    }

    static async Task SendCollectedItemAsync(HttpClient http, string type, string message, string sender)
    {
        try
        {
            var payload = JsonSerializer.Serialize(new
            {
                key = IngestKey,
                message,
                time = DateTime.UtcNow.ToString("o"),
                type,
                sender,
            });
            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var res = await http.PostAsync(IngestUrl, content);
            if (!res.IsSuccessStatusCode)
            {
                Log($"{type} 전송 실패 (status:", (int)res.StatusCode, "):", sender, "-", message);
                return;
            }
            Log($"{type} 전송 완료:", sender, "-", message);
        }
        catch (Exception ex)
        {
            Log($"{type} 전송 실패:", ex.Message);
        }
    }

    static async Task HandlePacketAsync(HttpClient http, ClientWebSocket ws, ChatInfo info, string packet)
    {
        if (packet.Length < 14) return;
        if (!int.TryParse(packet.Substring(2, 4), out var serviceCommand)) return;
        var bodyStart = packet.Length > 15 ? 15 : 14;
        var body = packet.Length > bodyStart ? packet[bodyStart..] : "";
        var parts = body.Split(Fs);

        if (serviceCommand == 1)
        {
            var joinPacket = BuildPacket(2, BuildJoinBody(info));
            var bytes = Encoding.UTF8.GetBytes(joinPacket);
            await ws.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
            return;
        }

        if (serviceCommand == 2)
        {
            Log("채팅방 입장 완료. 신청곡(!제목 또는 !제목-가수) 수집을 시작합니다.");
            return;
        }

        if (serviceCommand == 5 && parts.Length >= 6)
        {
            var message = parts[0];
            var nickname = parts[5];
            if (string.IsNullOrEmpty(message) || !message.StartsWith("!")) return;
            Log("채팅 감지:", nickname, "-", message);
            await SendCollectedItemAsync(http, "songRequest", message, nickname);
            return;
        }

        if (serviceCommand == 18 && parts.Length >= 4)
        {
            var nickname = parts[2];
            if (int.TryParse(parts[3], out var count) && count > 0 && !string.IsNullOrEmpty(nickname))
            {
                Log("별풍선 감지:", nickname, "-", count, "개");
                await SendCollectedItemAsync(http, "star", count.ToString(), nickname);
            }
            return;
        }

        if (serviceCommand == 88)
        {
            Log("방송이 종료됐습니다.");
            await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "ended", CancellationToken.None);
        }
    }

    static async Task ConnectAsync(HttpClient http)
    {
        Log($"{StreamerId} 방송 채팅 정보를 가져오는 중...");
        var info = await GetChatInfoAsync(http);
        var wsUrl = $"wss://{info.Host.ToLowerInvariant()}:{info.Port}/Websocket/{info.Bjid}";
        Log("웹소켓 접속 시도:", wsUrl);

        using var ws = new ClientWebSocket();
        ws.Options.SetRequestHeader("Origin", "https://play.sooplive.com");
        ws.Options.SetRequestHeader("User-Agent", "Mozilla/5.0");
        ws.Options.AddSubProtocol("chat");

        using var connectCts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        try
        {
            await ws.ConnectAsync(new Uri(wsUrl), connectCts.Token);
        }
        catch (OperationCanceledException)
        {
            Log("10초 동안 응답이 없어 접속 시도를 중단합니다. 10초 후 재시도합니다.");
            return;
        }

        Log("웹소켓 연결됨");
        await ws.SendAsync(Encoding.UTF8.GetBytes(CmdConnect), WebSocketMessageType.Text, true, CancellationToken.None);

        var buffer = new byte[8192];
        var messageBuffer = new List<byte>();

        while (ws.State == WebSocketState.Open)
        {
            WebSocketReceiveResult result;
            try
            {
                result = await ws.ReceiveAsync(buffer, CancellationToken.None);
            }
            catch (Exception ex)
            {
                Log("웹소켓 오류 발생:", ex.Message);
                break;
            }

            if (result.MessageType == WebSocketMessageType.Close)
            {
                Log("웹소켓 닫힘 (code:", result.CloseStatus, ")");
                break;
            }

            messageBuffer.AddRange(buffer[..result.Count]);
            if (!result.EndOfMessage) continue;

            var text = Encoding.UTF8.GetString(messageBuffer.ToArray());
            messageBuffer.Clear();
            try
            {
                await HandlePacketAsync(http, ws, info, text);
            }
            catch (Exception ex)
            {
                Log("패킷 처리 중 오류:", ex.Message);
            }
        }

        Log("10초 후 재접속합니다.");
    }

    public static async Task RunAsync()
    {
        Log("===== DDARIN 신청곡 수집기 =====");
        using var httpClient = new HttpClient();

        while (true)
        {
            try
            {
                await ConnectAsync(httpClient);
            }
            catch (Exception ex)
            {
                Log("연결 실패:", ex.Message, "- 10초 후 재시도합니다.");
            }
            await Task.Delay(TimeSpan.FromSeconds(10));
        }
    }
}
