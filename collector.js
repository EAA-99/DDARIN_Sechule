// 예상 못한 오류로 프로그램이 통째로 죽지 않도록 방어
process.on("uncaughtException", (err) => {
  console.error(new Date().toLocaleTimeString("ko-KR"), "- 처리되지 않은 오류:", err && err.message);
});
process.on("unhandledRejection", (err) => {
  console.error(new Date().toLocaleTimeString("ko-KR"), "- 처리되지 않은 비동기 오류:", err && err.message);
});

// ===== 설정 =====
const STREAMER_ID = "gkarnfud2"; // TODO: 테스트 끝나면 "insome0319"로 되돌리기
const INGEST_URL = "https://ddarin-sechule.vercel.app/api/soop-chat";
const INGEST_KEY = "0319"; // Vercel 환경변수 SOOP_CHAT_INGEST_KEY와 반드시 같아야 함
// ================================================

// ===== SOOP 채팅 프로토콜 (https://github.com/Gyeon-ai/- DanPinball 참고, 비공식/역공학) =====
const FS = "\u000c";
const CMD_CONNECT = "\u001b\u0009000100000600\u000c\u000c\u000c16\u000c";

function buildPacket(serviceCommand, body) {
  const header = "\u001b\u0009" + String(serviceCommand).padStart(4, "0") + String(body.length).padStart(6, "0") + "00";
  return header + body;
}

function buildJoinBody(info) {
  let body = "";
  body += FS + info.chatNo;
  body += FS + info.token;
  body += FS + "0" + FS + FS + "log\u0011";
  body += "\u0006&\u0006set_bps\u0006=\u0006" + info.bps;
  body += "\u0006&\u0006view_bps\u0006=\u0006" + info.bps;
  body += "\u0006&\u0006quality\u0006=\u0006ori";
  body += "\u0006&\u0006geo_cc\u0006=\u0006" + info.geoCc;
  body += "\u0006&\u0006geo_rc\u0006=\u0006" + info.geoRc;
  body += "\u0006&\u0006acpt_lang\u0006=\u0006" + info.acceptLanguage;
  body += "\u0006&\u0006svc_lang\u0006=\u0006" + info.serviceLanguage;
  body += "\u0006&\u0006subscribe\u0006=\u00060";
  body += "\u0006&\u0006lowlatency\u0006=\u00061";
  body += "\u0012pwd\u0011\u0012";
  body += "auth_info\u0011NULL\u0012";
  body += "pver\u00112\u0012";
  body += "access_system\u0011html5\u0012";
  body += FS;
  return body;
}
// ================================================

function log(...args) {
  console.log(new Date().toLocaleTimeString("ko-KR"), "-", ...args);
}

async function getChatInfo() {
  const params = new URLSearchParams({
    bid: STREAMER_ID,
    type: "live",
    pwd: "",
    player_type: "html5",
    stream_type: "common",
    mode: "landing",
    from_api: "0",
  });

  const url = `https://live.sooplive.co.kr/afreeca/player_live_api.php?bjid=${encodeURIComponent(STREAMER_ID)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await r.json();
  const channel = (data && data.CHANNEL) || {};
  const host = channel.CHDOMAIN || channel.CHIP || "";
  const port = Number(channel.CHPT || 0) + 1;

  if (!host || !channel.CHATNO || !channel.FTK) {
    throw new Error("방송 중이 아니거나 채팅 정보를 가져오지 못했습니다.");
  }

  return {
    host,
    port,
    bjid: channel.BJID || STREAMER_ID,
    chatNo: channel.CHATNO,
    token: channel.FTK,
    bps: channel.BPS || "",
    geoCc: channel.geo_cc || "",
    geoRc: channel.geo_rc || "",
    acceptLanguage: channel.acpt_lang || "",
    serviceLanguage: channel.svc_lang || "",
  };
}

async function sendSongRequest(text, sender) {
  try {
    await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: INGEST_KEY,
        message: text,
        time: new Date().toISOString(),
        type: "songRequest",
        sender,
      }),
    });
    log("신청곡 전송 완료:", sender, "-", text);
  } catch (err) {
    log("신청곡 전송 실패:", err.message);
  }
}

function handlePacket(ws, info, packet) {
  if (packet.length < 14) return;
  const serviceCommand = parseInt(packet.substring(2, 6), 10);
  const bodyStart = packet.length > 15 ? 15 : 14;
  const body = packet.length > bodyStart ? packet.slice(bodyStart) : "";
  const parts = body.split(FS);

  if (serviceCommand === 1) {
    ws.send(buildPacket(2, buildJoinBody(info)));
    return;
  }

  if (serviceCommand === 2) {
    log("채팅방 입장 완료. 신청곡(!신청 제목 - 가수) 수집을 시작합니다.");
    return;
  }

  if (serviceCommand === 5 && parts.length >= 6) {
    const message = parts[0];
    const nickname = parts[5];
    if (!message || !message.startsWith("!")) return;
    log("채팅 감지:", nickname, "-", message);
    sendSongRequest(message, nickname);
    return;
  }

  if (serviceCommand === 88) {
    log("방송이 종료됐습니다.");
    ws.close();
  }
}

async function connect() {
  log(`${STREAMER_ID} 방송 채팅 정보를 가져오는 중...`);
  const info = await getChatInfo();
  const wsUrl = `wss://${info.host.toLowerCase()}:${info.port}/Websocket/${info.bjid}`;
  log("웹소켓 접속 시도:", wsUrl);

  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  let opened = false;
  const connectTimeout = setTimeout(() => {
    if (!opened) {
      log("10초 동안 응답이 없어 접속 시도를 중단합니다 (방화벽/네트워크에서 포트가 막혀있을 수 있음). 10초 후 재시도합니다.");
      ws.close();
    }
  }, 10000);

  ws.addEventListener("open", () => {
    opened = true;
    clearTimeout(connectTimeout);
    log("웹소켓 연결됨");
    ws.send(CMD_CONNECT);
  });
  ws.addEventListener("message", (e) => {
    const text = typeof e.data === "string" ? e.data : new TextDecoder("utf-8").decode(new Uint8Array(e.data));
    handlePacket(ws, info, text);
  });
  ws.addEventListener("close", (e) => {
    clearTimeout(connectTimeout);
    log("웹소켓 닫힘 (code:", e.code, ") 10초 후 재접속합니다.");
    setTimeout(() => connect().catch((err) => log("재접속 실패:", err.message)), 10000);
  });
  ws.addEventListener("error", () => {
    log("웹소켓 오류 발생");
  });
}

log("===== DDARIN 신청곡 수집기 =====");
log("이 창을 닫으면 수집이 멈춥니다. 방송 중에는 계속 켜두세요.");
connect().catch((err) => {
  log("연결 실패:", err.message, "- 10초 후 재시도합니다.");
  setTimeout(() => connect().catch((e) => log("재접속 실패:", e.message)), 10000);
});
