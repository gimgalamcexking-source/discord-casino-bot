// =============================================================
// Discord Casino + Economy + Realistic Stock Market (Stable)
// Node.js + discord.js v14
// =============================================================
require('dotenv').config();
const fs = require('fs');
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// -------------------- Client --------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// -------------------- DB --------------------
const DB_FILE = './db.json';

function readJSONSafe(path, fallback) {
  try {
    if (!fs.existsSync(path)) return fallback;
    const raw = fs.readFileSync(path, 'utf8');
    if (!raw || !raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSONSafe(path, obj) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}

function getDB() {
  return readJSONSafe(DB_FILE, {
    users: {},
    shop: {},
    market: {},
    news: [],
    version: 1
  });
}

function saveDB(db) {
  writeJSONSafe(DB_FILE, db);
}

// DB schema init (매 실행마다 안전 보정)
function initDB() {
  const db = getDB();

  if (!db.users || typeof db.users !== 'object') db.users = {};
  if (!db.shop || typeof db.shop !== 'object') db.shop = {};
  if (!db.market || typeof db.market !== 'object') db.market = {};
  if (!Array.isArray(db.news)) db.news = [];

  // market schema
  if (!db.market.stocks || typeof db.market.stocks !== 'object') db.market.stocks = {};
  if (!db.market.lastStockTick) db.market.lastStockTick = 0;

  saveDB(db);
}

function ensureUser(uid) {
  const db = getDB();
  if (!db.users[uid]) {
    db.users[uid] = {
      money: 10000000,
      items: {},
      portfolio: {},  // 주식 보유
      drug: { inventory: 0 } // (확장용)
    };
    saveDB(db);
  } else {
    // 누락 필드 보정
    if (typeof db.users[uid].money !== 'number') db.users[uid].money = 10000000;
    if (!db.users[uid].items || typeof db.users[uid].items !== 'object') db.users[uid].items = {};
    if (!db.users[uid].portfolio || typeof db.users[uid].portfolio !== 'object') db.users[uid].portfolio = {};
    if (!db.users[uid].drug || typeof db.users[uid].drug !== 'object') db.users[uid].drug = { inventory: 0 };
    if (typeof db.users[uid].drug.inventory !== 'number') db.users[uid].drug.inventory = 0;
    saveDB(db);
  }
  return db.users[uid];
}

function getMoney(uid) {
  const db = getDB();
  ensureUser(uid);
  return db.users[uid].money;
}

function addMoney(uid, delta) {
  const db = getDB();
  ensureUser(uid);
  db.users[uid].money = Math.floor((db.users[uid].money || 0) + delta);
  if (db.users[uid].money < 0) db.users[uid].money = 0;
  saveDB(db);
}

function setMoney(uid, amt) {
  const db = getDB();
  ensureUser(uid);
  db.users[uid].money = Math.max(0, Math.floor(amt));
  saveDB(db);
}

function isAdmin(member) {
  try {
    return member.permissions.has('Administrator');
  } catch {
    return false;
  }
}

// -------------------- Utilities --------------------
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function suitEmoji(suit) {
  if (suit === 'S') return '♠️';
  if (suit === 'H') return '♥️';
  if (suit === 'D') return '♦️';
  if (suit === 'C') return '♣️';
  return suit;
}

function cardImageUrl(rank, suit) {
  return `https://deckofcardsapi.com/static/img/${rank === '10' ? '0' : rank}${suit}.png`;
}

function drawPlayingCard() {
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const suits = ['S','H','D','C'];
  const r = ranks[Math.floor(Math.random() * ranks.length)];
  const s = suits[Math.floor(Math.random() * suits.length)];
  return { code: `${r}${s}`, rank: r, suit: s, img: cardImageUrl(r, s) };
}

function baccaratCardValueFromRank(rank) {
  if (rank === 'A') return 1;
  if (['10','J','Q','K'].includes(rank)) return 0;
  return parseInt(rank, 10);
}

function dragonTigerCardValue(rank) {
  if (rank === 'A') return 1;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  return parseInt(rank, 10);
}

// -------------------- Draw (뽑기) --------------------
const prizeItems = [
  { name: '역선권', chance: 12 },
  { name: '편지', chance: 0.5 },
  { name: '1000만원', chance: 3 },
  { name: '신청곡 라이브', chance: 2 },
  { name: '유리/두만 애교', chance: 0.1 },
  { name: '일본어 대본 연기 (믹싱본)', chance: 2 }
];

// -------------------- Slots / Roulette --------------------
const slotEmojis = ['🍒','🍋','🍊','🍉','⭐','💎'];
const rouletteRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

// =============================================================
// ✅ Realistic Stock Market
// =============================================================

// 종목 정의
const STOCKS = [
  { key: 'yuri_defense',   name: '유리방산',     min: 50,  max: 20000, base: 300 },
  { key: 'yuri_pharma',    name: '유리제약',     min: 50,  max: 20000, base: 420 },
  { key: 'yuri_elecwork',  name: '유리전기공사', min: 50,  max: 20000, base: 510 },
  { key: 'yuri_transport', name: '유리교통공사', min: 50,  max: 20000, base: 260 },
  { key: 'yuri_baseball',  name: '유리야구단',   min: 50,  max: 20000, base: 190 },
  { key: 'yuri_electro',   name: '유리전자',     min: 50,  max: 20000, base: 360 }
];

// 주가 초기화
function initStocks() {
  const db = getDB();
  if (!db.market) db.market = {};
  if (!db.market.stocks) db.market.stocks = {};

  let changed = false;

  for (const s of STOCKS) {
    if (!db.market.stocks[s.key] || typeof db.market.stocks[s.key].price !== 'number') {
      db.market.stocks[s.key] = {
        name: s.name,
        price: s.base,
        prev: s.base,
        trend: 0 // -1 ~ +1 정도의 미세 추세
      };
      changed = true;
    } else {
      // name 누락 보정
      if (db.market.stocks[s.key].name !== s.name) {
        db.market.stocks[s.key].name = s.name;
        changed = true;
      }
      if (typeof db.market.stocks[s.key].prev !== 'number') {
        db.market.stocks[s.key].prev = db.market.stocks[s.key].price;
        changed = true;
      }
      if (typeof db.market.stocks[s.key].trend !== 'number') {
        db.market.stocks[s.key].trend = 0;
        changed = true;
      }
    }
  }

  if (!Array.isArray(db.news)) { db.news = []; changed = true; }
  if (!db.market.lastStockTick) { db.market.lastStockTick = Date.now(); changed = true; }

  if (changed) saveDB(db);
}

// 뉴스 추가 (최대 30개 유지)
function addNews(text) {
  const db = getDB();
  if (!Array.isArray(db.news)) db.news = [];
  db.news.unshift(text);
  if (db.news.length > 30) db.news.splice(30);
  saveDB(db);
}

// 변동률 clamp
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// 현실적 변동 모델
// - 기본 변동: -2.0% ~ +2.0% 범위
// - 종목별 추세(trend)가 조금씩 누적되어 며칠간 흐름 가능
// - mean-reversion(되돌림)로 너무 오르면 내려오고, 너무 내리면 반등 확률 증가
// - 가끔 이벤트(급등/급락) 1~2% 확률
function tickStocks() {
  const db = getDB();
  if (!db.market || !db.market.stocks) return;

  const now = Date.now();
  db.market.lastStockTick = now;

  // 이벤트 확률(전체 시장 이벤트)
  const eventRoll = Math.random();
  const hasEvent = eventRoll < 0.018; // 1.8% 확률로 "이벤트 1개" 발생
  let event = null;

  if (hasEvent) {
    const target = STOCKS[Math.floor(Math.random() * STOCKS.length)];
    const up = Math.random() < 0.5;

    // 이벤트 강도: 8%~18% (현실적인 게임 밸런스)
    const magnitude = (8 + Math.random() * 10) / 100;

    // “테러/사고” 같은 문구는 원하면 바꿔줄 수 있어. (지금은 중립 뉴스)
    const upTexts = [
      `${target.name} 실적 서프라이즈 발표로 강세 📈`,
      `${target.name} 대형 계약 수주 소식! 급등 📈`,
      `${target.name} 호재성 뉴스로 투자심리 개선 📈`
    ];
    const downTexts = [
      `${target.name} 악재성 이슈로 급락 📉`,
      `${target.name} 규제/리콜 우려 확산… 하락 📉`,
      `${target.name} 기대치 하회 소식으로 매도세 📉`
    ];

    event = {
      key: target.key,
      dir: up ? +1 : -1,
      magnitude,
      text: up ? upTexts[Math.floor(Math.random()*upTexts.length)]
               : downTexts[Math.floor(Math.random()*downTexts.length)]
    };

    addNews(`📰 [주식 뉴스] ${event.text} (변동: ${event.dir > 0 ? '+' : '-'}${Math.round(event.magnitude*100)}%)`);
  }

  for (const s of STOCKS) {
    const info = db.market.stocks[s.key];
    if (!info) continue;

    const price = info.price;
    info.prev = price;

    // 추세는 조금씩 랜덤워크 (너무 커지지 않게)
    // trend는 -0.6 ~ +0.6 범위 유지
    info.trend = clamp(info.trend + (Math.random() - 0.5) * 0.06, -0.6, 0.6);

    // mean reversion: base 대비 너무 높으면 내려오고, 너무 낮으면 올라오게
    // 기준은 종목 base로 잡음
    const base = s.base;
    const deviation = (price - base) / base; // -1 ~ +∞
    const reversion = clamp(-deviation * 0.10, -0.03, 0.03); // 되돌림은 최대 +-3%

    // 기본 랜덤 변동 -2%~+2%
    const noise = (Math.random() - 0.5) * 0.04;

    // trend 영향 (최대 +-1.2%)
    const trendEffect = info.trend * 0.02;

    // 합산 변동률
    let changeRate = noise + trendEffect + reversion;

    // 이벤트 적용(해당 종목이면 추가)
    if (event && event.key === s.key) {
      changeRate += event.dir * event.magnitude;
    }

    // 최종 변동률 제한 (한 틱 최대 +15%, 최소 -12%)
    changeRate = clamp(changeRate, -0.12, 0.15);

    // 주가 갱신(덧셈 기반)
    let next = Math.floor(price + price * changeRate);

    // 가격 하한/상한 캡
    next = clamp(next, s.min, s.max);

    // “너무 안 오르기만/떨어지기만” 방지: 5틱 연속 하락 같은 걸 저장할 수도 있는데
    // 지금 모델은 mean-reversion으로 자연 반등이 자주 나옴.

    info.price = next;
  }

  saveDB(db);
}

// 시세 문자열
function formatStockBoard(db) {
  const lines = [];
  STOCKS.forEach((s, idx) => {
    const info = db.market.stocks[s.key];
    const p = info?.price ?? 0;
    const prev = info?.prev ?? p;
    const diff = p - prev;
    const arrow = diff > 0 ? '📈' : diff < 0 ? '📉' : '➖';
    const diffTxt = diff === 0 ? '' : ` (${diff > 0 ? '+' : ''}${diff.toLocaleString()}원)`;
    lines.push(`${idx+1}. ${s.name} — **${p.toLocaleString()}원** ${arrow}${diffTxt}`);
  });
  return lines.join('\n');
}

// 유저 포트폴리오 가치 계산
function getPortfolioValue(uid, db) {
  const u = db.users[uid];
  if (!u) return 0;
  const pf = u.portfolio || {};
  let total = 0;
  for (const s of STOCKS) {
    const qty = pf[s.key] || 0;
    if (qty <= 0) continue;
    const price = db.market.stocks[s.key]?.price ?? 0;
    total += qty * price;
  }
  return total;
}

// =============================================================
// Keep-Alive HTTP server (Zeabur Sleep 방지)
// =============================================================
const app = express();
app.get('/', (req, res) => res.status(200).send('Bot is Alive'));
app.listen(process.env.PORT || 3000, () => {
  console.log('HTTP Keep-Alive Server on', process.env.PORT || 3000);
});

// =============================================================
// Ready
// =============================================================
client.once('ready', () => {
  console.log(`${client.user.tag} ready`);

  // init
  initDB();
  initStocks();

  // 즉시 1회 틱(선택)
  // tickStocks();

  // 3분마다 주가 변동
  setInterval(() => {
    try {
      tickStocks();
      // console.log('[Stock] tick ok');
    } catch (e) {
      console.error('[Stock] tick error:', e);
    }
  }, 1000 * 60 * 3);
});

// =============================================================
// Interaction handler
// =============================================================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const uid = interaction.user.id;
  ensureUser(uid);

  const cmd = interaction.commandName;

  // ---------- 공통: 안전한 defer ----------
  async function safeDefer(ephemeral = false) {
    try {
      if (interaction.deferred || interaction.replied) return;
      await interaction.deferReply({ ephemeral });
    } catch {}
  }

  async function safeReply(payload) {
    try {
      if (interaction.replied || interaction.deferred) return interaction.editReply(payload);
      return interaction.reply(payload);
    } catch (e) {
      // Unknown interaction 등 방어
      try { return interaction.followUp({ ...payload, ephemeral: true }); } catch {}
    }
  }

  // =============================================================
  // 돈
  // =============================================================
  if (cmd === '돈') {
    return safeReply({
      content: `💰 ${interaction.user.username}님의 현재 잔액: **${getMoney(uid).toLocaleString()}원**`,
      ephemeral: true
    });
  }

  // =============================================================
  // 주식: 시세
  // =============================================================
  if (cmd === '주식시세' || cmd === '주식') {
    const db = getDB();
    initStocks();
    const embed = new EmbedBuilder()
      .setTitle('📈 유리 증권 시세')
      .setDescription(formatStockBoard(db))
      .setColor('#22c55e')
      .setFooter({ text: `3분마다 자동 변동` })
      .setTimestamp();

    return safeReply({ embeds: [embed] });
  }

  // =============================================================
  // 주식: 내 주식
  // =============================================================
  if (cmd === '내주식') {
    const db = getDB();
    initStocks();
    const u = db.users[uid];
    const pf = u.portfolio || {};

    const lines = [];
    let any = false;

    for (const s of STOCKS) {
      const qty = pf[s.key] || 0;
      if (qty > 0) {
        any = true;
        const price = db.market.stocks[s.key]?.price ?? 0;
        const val = qty * price;
        lines.push(`- ${s.name}: **${qty.toLocaleString()}주** (평가액 **${val.toLocaleString()}원**)`);
      }
    }

    const stockValue = getPortfolioValue(uid, db);
    const cash = u.money || 0;
    const total = cash + stockValue;

    const embed = new EmbedBuilder()
      .setTitle('📊 내 주식 포트폴리오')
      .setDescription(any ? lines.join('\n') : '보유한 주식이 없습니다.')
      .addFields(
        { name: '현금', value: `${cash.toLocaleString()}원`, inline: true },
        { name: '주식 평가액', value: `${stockValue.toLocaleString()}원`, inline: true },
        { name: '총자산', value: `${total.toLocaleString()}원`, inline: false }
      )
      .setColor('#60a5fa')
      .setTimestamp();

    return safeReply({ embeds: [embed], ephemeral: true });
  }

  // =============================================================
  // 주식: 구매
  // options: 종목(string), 수량(int)
  // 종목은 "1~6" 또는 이름으로 받는다고 가정
  // =============================================================
  if (cmd === '주식구매') {
    const db = getDB();
    initStocks();

    const raw = (interaction.options.getString('종목') || '').trim();
    const qty = interaction.options.getInteger('수량');

    if (!qty || qty <= 0) return safeReply({ content: '❌ 수량은 1 이상이어야 합니다.', ephemeral: true });

    // 종목 파싱
    let stock = null;
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 1 && num <= STOCKS.length) {
      stock = STOCKS[num - 1];
    } else {
      stock = STOCKS.find(s => s.name === raw);
    }

    if (!stock) {
      return safeReply({ content: '❌ 종목이 올바르지 않습니다. (1~6 또는 정확한 종목명)', ephemeral: true });
    }

    const price = db.market.stocks[stock.key]?.price ?? 0;
    const cost = price * qty;

    if (db.users[uid].money < cost) {
      return safeReply({ content: `❌ 잔액 부족! 필요: ${cost.toLocaleString()}원`, ephemeral: true });
    }

    db.users[uid].money -= cost;
    db.users[uid].portfolio[stock.key] = (db.users[uid].portfolio[stock.key] || 0) + qty;
    saveDB(db);

    const embed = new EmbedBuilder()
      .setTitle('🛒 주식 구매 완료')
      .setDescription(`${stock.name} **${qty.toLocaleString()}주** 구매`)
      .addFields(
        { name: '단가', value: `${price.toLocaleString()}원`, inline: true },
        { name: '총액', value: `${cost.toLocaleString()}원`, inline: true },
        { name: '잔액', value: `${db.users[uid].money.toLocaleString()}원`, inline: true }
      )
      .setColor('#22c55e')
      .setTimestamp();

    return safeReply({ embeds: [embed], ephemeral: true });
  }

  // =============================================================
  // 주식: 판매
  // options: 종목(string), 수량(int)
  // =============================================================
  if (cmd === '주식판매') {
    const db = getDB();
    initStocks();

    const raw = (interaction.options.getString('종목') || '').trim();
    const qty = interaction.options.getInteger('수량');

    if (!qty || qty <= 0) return safeReply({ content: '❌ 수량은 1 이상이어야 합니다.', ephemeral: true });

    // 종목 파싱
    let stock = null;
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 1 && num <= STOCKS.length) {
      stock = STOCKS[num - 1];
    } else {
      stock = STOCKS.find(s => s.name === raw);
    }

    if (!stock) {
      return safeReply({ content: '❌ 종목이 올바르지 않습니다. (1~6 또는 정확한 종목명)', ephemeral: true });
    }

    const owned = db.users[uid].portfolio[stock.key] || 0;
    if (owned < qty) {
      return safeReply({ content: `❌ 보유 수량 부족! 현재: ${owned.toLocaleString()}주`, ephemeral: true });
    }

    const price = db.market.stocks[stock.key]?.price ?? 0;
    const income = price * qty;

    db.users[uid].portfolio[stock.key] = owned - qty;
    if (db.users[uid].portfolio[stock.key] <= 0) delete db.users[uid].portfolio[stock.key];

    db.users[uid].money += income;
    saveDB(db);

    const embed = new EmbedBuilder()
      .setTitle('💸 주식 판매 완료')
      .setDescription(`${stock.name} **${qty.toLocaleString()}주** 판매`)
      .addFields(
        { name: '단가', value: `${price.toLocaleString()}원`, inline: true },
        { name: '총액', value: `${income.toLocaleString()}원`, inline: true },
        { name: '잔액', value: `${db.users[uid].money.toLocaleString()}원`, inline: true }
      )
      .setColor('#f59e0b')
      .setTimestamp();

    return safeReply({ embeds: [embed], ephemeral: true });
  }

  // =============================================================
  // 뉴스
  // =============================================================
  if (cmd === '뉴스') {
    const db = getDB();
    if (!Array.isArray(db.news) || db.news.length === 0) {
      return safeReply({ content: '📰 아직 뉴스가 없습니다.', ephemeral: true });
    }

    const top = db.news.slice(0, 10).map((n, i) => `${i+1}. ${n}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('📰 경제 뉴스 (최근 10개)')
      .setDescription(top)
      .setColor('#a78bfa')
      .setTimestamp();

    return safeReply({ embeds: [embed], ephemeral: true });
  }

  // =============================================================
  // 경제 랭킹 (총자산 = 현금 + 주식평가액)
  // =============================================================
  if (cmd === '경제랭킹' || cmd === '랭킹') {
    const db = getDB();
    initStocks();

    const entries = Object.keys(db.users).map(id => {
      const cash = db.users[id].money || 0;
      const stockVal = getPortfolioValue(id, db);
      return { id, total: cash + stockVal };
    });

    entries.sort((a, b) => b.total - a.total);

    const top = entries.slice(0, 10);
    const lines = top.map((e, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏅';
      return `${medal} ${idx+1}. <@${e.id}> — **${e.total.toLocaleString()}원**`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 경제 랭킹 TOP 10')
      .setDescription(lines || '랭킹 데이터가 없습니다.')
      .setColor('#facc15')
      .setTimestamp();

    return safeReply({ embeds: [embed] });
  }

  // =============================================================
  // 송금 (대상 유저, 금액)
  // =============================================================
  if (cmd === '송금') {
    const target = interaction.options.getUser('대상');
    const amt = interaction.options.getInteger('금액');

    if (!target) return safeReply({ content: '❌ 대상이 올바르지 않습니다.', ephemeral: true });
    if (!amt || amt <= 0) return safeReply({ content: '❌ 금액은 1 이상이어야 합니다.', ephemeral: true });
    if (target.id === uid) return safeReply({ content: '❌ 자기 자신에게 송금할 수 없습니다.', ephemeral: true });

    if (getMoney(uid) < amt) return safeReply({ content: '❌ 잔액이 부족합니다.', ephemeral: true });

    ensureUser(target.id);
    addMoney(uid, -amt);
    addMoney(target.id, +amt);

    const embed = new EmbedBuilder()
      .setTitle('💸 송금 완료')
      .setDescription(`<@${uid}> → <@${target.id}>`)
      .addFields(
        { name: '금액', value: `${amt.toLocaleString()}원`, inline: true },
        { name: '내 잔액', value: `${getMoney(uid).toLocaleString()}원`, inline: true }
      )
      .setColor('#34d399')
      .setTimestamp();

    return safeReply({ embeds: [embed], ephemeral: true });
  }

  // =============================================================
  // 🐉 용호
  // =============================================================
  if (cmd === '용호') {
    await safeDefer(false);

    const bet = interaction.options.getInteger('베팅');
    const choiceRaw = (interaction.options.getString('선택') || '').toLowerCase();

    if (!bet || bet <= 0) return interaction.editReply('❌ 베팅 금액이 올바르지 않습니다.');
    if (getMoney(uid) < bet) return interaction.editReply('❌ 잔액 부족');

    const map = {
      'dragon':'dragon','d':'dragon','용':'dragon','드래곤':'dragon',
      'tiger':'tiger','t':'tiger','호':'tiger','타이거':'tiger',
      'tie':'tie','타이':'tie','무':'tie'
    };
    const choice = map[choiceRaw];
    if (!choice) return interaction.editReply('❌ 선택 오류');

    addMoney(uid, -bet);

    const dCard = drawPlayingCard();
    const tCard = drawPlayingCard();
    const dVal = dragonTigerCardValue(dCard.rank);
    const tVal = dragonTigerCardValue(tCard.rank);

    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🐉 용호 시작!').setDescription('마감입니다. 카드 공개 중...').setColor('#22c55e')] });

    await sleep(800);
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('Dragon 카드').setDescription(`${dCard.rank}${suitEmoji(dCard.suit)} → **${dVal}**`).setImage(dCard.img).setColor('#22c55e')] });
    await sleep(800);
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('Tiger 카드').setDescription(`${tCard.rank}${suitEmoji(tCard.suit)} → **${tVal}**`).setImage(tCard.img).setColor('#ef4444')] });

    let result = '';
    let payout = 0;

    if (dVal === tVal) {
      result = 'tie';
      payout = 0; // 타이 무승부 처리
    } else {
      result = dVal > tVal ? 'dragon' : 'tiger';
      if (choice === result) payout = bet * 2; // 배당: 원금 포함 2배로 하고 싶으면
      // 지금 구조는 bet 먼저 차감했으니 "수익"이 아니라 "지급"으로 보면 됨.
      // 현실적으로: 맞추면 bet*2 지급, 틀리면 0 지급
    }

    addMoney(uid, payout);

    const embed = new EmbedBuilder()
      .setTitle('🐉 용호 결과')
      .addFields(
        { name: 'Dragon', value: `${dCard.rank}${suitEmoji(dCard.suit)} → **${dVal}**`, inline: true },
        { name: 'Tiger', value: `${tCard.rank}${suitEmoji(tCard.suit)} → **${tVal}**`, inline: true },
        { name: '결과', value: result.toUpperCase(), inline: false },
        { name: '지급', value: `${payout.toLocaleString()}원`, inline: true },
        { name: '잔액', value: `${getMoney(uid).toLocaleString()}원`, inline: true }
      )
      .setColor(result === 'dragon' ? '#22c55e' : result === 'tiger' ? '#ef4444' : '#facc15')
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // =============================================================
  // 🎴 바카라
  // =============================================================
  if (cmd === '바카라') {
    await safeDefer(false);

    const bet = interaction.options.getInteger('베팅');
    const choiceRaw = (interaction.options.getString('선택') || '').toLowerCase();

    if (!bet || bet <= 0) return interaction.editReply('❌ 베팅 금액이 올바르지 않습니다.');
    if (getMoney(uid) < bet) return interaction.editReply('❌ 잔액 부족');

    const map = {
      'player':'player','플레이어':'player','p':'player',
      'banker':'banker','뱅커':'banker','b':'banker',
      'tie':'tie','타이':'tie','t':'tie'
    };
    const choice = map[choiceRaw];
    if (!choice) return interaction.editReply('❌ 선택 오류');

    addMoney(uid, -bet);

    let pCards = [drawPlayingCard(), drawPlayingCard()];
    let bCards = [drawPlayingCard(), drawPlayingCard()];

    let pTotal = (baccaratCardValueFromRank(pCards[0].rank) + baccaratCardValueFromRank(pCards[1].rank)) % 10;
    let bTotal = (baccaratCardValueFromRank(bCards[0].rank) + baccaratCardValueFromRank(bCards[1].rank)) % 10;

    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🎴 바카라 시작!').setDescription('마감입니다. 카드 공개 중...').setColor('#2dd4bf')] });

    const seq = [
      { title: '플레이어 첫 카드', card: pCards[0], color: '#2dd4bf' },
      { title: '뱅커 첫 카드', card: bCards[0], color: '#ef4444' },
      { title: '플레이어 두 번째 카드', card: pCards[1], color: '#2dd4bf' },
      { title: '뱅커 두 번째 카드', card: bCards[1], color: '#ef4444' }
    ];

    for (const step of seq) {
      await sleep(800);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(step.title).setImage(step.card.img).setColor(step.color)] });
    }

    // 3번째 카드 규칙
    let p3 = null, b3 = null, p3v = null;

    // Natural (8/9) 체크
    if (!(pTotal >= 8 || bTotal >= 8)) {
      // Player draw
      if (pTotal <= 5) {
        p3 = drawPlayingCard();
        p3v = baccaratCardValueFromRank(p3.rank);
        pCards.push(p3);
        pTotal = (pTotal + p3v) % 10;

        await sleep(700);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('플레이어 3번째 카드').setImage(p3.img).setColor('#2dd4bf')] });
      }

      // Banker draw
      if (!p3) {
        if (bTotal <= 5) {
          b3 = drawPlayingCard();
          bCards.push(b3);
          bTotal = (bTotal + baccaratCardValueFromRank(b3.rank)) % 10;

          await sleep(700);
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('뱅커 3번째 카드').setImage(b3.img).setColor('#ef4444')] });
        }
      } else {
        // Banker rule based on player's third card
        if (
          (bTotal <= 2) ||
          (bTotal === 3 && p3v !== 8) ||
          (bTotal === 4 && [2,3,4,5,6,7].includes(p3v)) ||
          (bTotal === 5 && [4,5,6,7].includes(p3v)) ||
          (bTotal === 6 && [6,7].includes(p3v))
        ) {
          b3 = drawPlayingCard();
          bCards.push(b3);
          bTotal = (bTotal + baccaratCardValueFromRank(b3.rank)) % 10;

          await sleep(700);
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('뱅커 3번째 카드').setImage(b3.img).setColor('#ef4444')] });
        }
      }
    }

    let result = 'tie';
    if (pTotal > bTotal) result = 'player';
    else if (bTotal > pTotal) result = 'banker';

    // 배당(원금 포함 지급)
    // - Player: 2x
    // - Banker: 1.95x (5% 수수료 반영)
    // - Tie: 9x (8:1 + 원금)
    let payout = 0;
    if (result === 'tie') {
      payout = (choice === 'tie') ? bet * 9 : 0;
    } else if (choice === result) {
      if (result === 'player') payout = bet * 2;
      if (result === 'banker') payout = Math.floor(bet * 1.95);
    }

    addMoney(uid, payout);

    const embed = new EmbedBuilder()
      .setTitle('🎴 바카라 최종 결과')
      .addFields(
        { name: '플레이어', value: `${pCards.map(c => `${c.rank}${suitEmoji(c.suit)}`).join(', ')} → **${pTotal}**`, inline: true },
        { name: '뱅커', value: `${bCards.map(c => `${c.rank}${suitEmoji(c.suit)}`).join(', ')} → **${bTotal}**`, inline: true },
        { name: '결과', value: result.toUpperCase(), inline: false },
        { name: '지급', value: `${payout.toLocaleString()}원`, inline: true },
        { name: '잔액', value: `${getMoney(uid).toLocaleString()}원`, inline: true }
      )
      .setColor('#2dd4bf')
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // =============================================================
  // 🎁 뽑기
  // =============================================================
  if (cmd === '뽑기') {
    const cost = 5000000;
    if (getMoney(uid) < cost) {
      return safeReply({ content: '💸 잔액 부족 (500만 원 필요)', ephemeral: true });
    }

    // 즉시 reply 가능 (sleep 없음)
    addMoney(uid, -cost);

    const rand = Math.random() * 100;
    let acc = 0;
    let prize = null;

    for (const item of prizeItems) {
      acc += item.chance;
      if (rand <= acc) { prize = item; break; }
    }
    if (!prize) prize = { name: '꽝', chance: 0 };

    let moneyWon = 0;
    if (prize.name === '1000만원') moneyWon = 10000000;

    if (moneyWon > 0) addMoney(uid, moneyWon);

    const embed = new EmbedBuilder()
      .setTitle('🎁 뽑기 결과')
      .setDescription(`**${prize.name}**`)
      .addFields(
        { name: '지출', value: `-${cost.toLocaleString()}원`, inline: true },
        { name: '획득', value: moneyWon > 0 ? `+${moneyWon.toLocaleString()}원` : prize.name, inline: true },
        { name: '잔액', value: `${getMoney(uid).toLocaleString()}원`, inline: true }
      )
      .setColor('#facc15')
      .setTimestamp();

    return safeReply({ embeds: [embed] });
  }

  // =============================================================
  // 🎰 슬롯
  // =============================================================
  if (cmd === '슬롯') {
    const bet = interaction.options.getInteger('베팅');
    if (!bet || bet <= 0) return safeReply({ content: '❌ 베팅 금액이 올바르지 않습니다.', ephemeral: true });
    if (getMoney(uid) < bet) return safeReply({ content: '❌ 잔액 부족', ephemeral: true });

    addMoney(uid, -bet);

    const reels = [
      slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
      slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
      slotEmojis[Math.floor(Math.random() * slotEmojis.length)]
    ];

    const win = (reels[0] === reels[1] && reels[1] === reels[2]);
    const payout = win ? bet * 6 : 0; // 원금 포함 6배(원하면 조정)
    addMoney(uid, payout);

    const embed = new EmbedBuilder()
      .setTitle('🎰 슬롯 결과')
      .setDescription(reels.join(' '))
      .addFields(
        { name: '베팅', value: `${bet.toLocaleString()}원`, inline: true },
        { name: '지급', value: `${payout.toLocaleString()}원`, inline: true },
        { name: '잔액', value: `${getMoney(uid).toLocaleString()}원`, inline: true }
      )
      .setColor('#f472b6')
      .setTimestamp();

    return safeReply({ embeds: [embed] });
  }

  // =============================================================
  // 🎡 룰렛
  // =============================================================
  if (cmd === '룰렛') {
    const bet = interaction.options.getInteger('베팅');
    let choice = (interaction.options.getString('선택') || '').toLowerCase();

    if (!bet || bet <= 0) return safeReply({ content: '❌ 베팅 금액이 올바르지 않습니다.', ephemeral: true });
    if (getMoney(uid) < bet) return safeReply({ content: '❌ 잔액 부족', ephemeral: true });

    addMoney(uid, -bet);

    const spin = Math.floor(Math.random() * 37); // 0~36
    let payout = 0;

    const isRed = rouletteRed.includes(spin);
    const isBlack = spin !== 0 && !isRed;

    // 배당: 맞추면 원금 포함 2배, 숫자 맞추면 36배(35:1 + 원금)
    if (['red','빨강'].includes(choice)) {
      if (isRed) payout = bet * 2;
    } else if (['black','검정'].includes(choice)) {
      if (isBlack) payout = bet * 2;
    } else if (['odd','홀'].includes(choice)) {
      if (spin !== 0 && spin % 2 === 1) payout = bet * 2;
    } else if (['even','짝'].includes(choice)) {
      if (spin !== 0 && spin % 2 === 0) payout = bet * 2;
    } else if (!isNaN(choice)) {
      const n = parseInt(choice, 10);
      if (n === spin) payout = bet * 36;
    } else {
      // 선택값 오류면 베팅 환불 처리
      addMoney(uid, bet);
      return safeReply({ content: '❌ 선택값이 올바르지 않습니다. (red/black/odd/even/숫자)', ephemeral: true });
    }

    addMoney(uid, payout);

    const colorTxt = spin === 0 ? 'GREEN' : isRed ? 'RED' : 'BLACK';

    const embed = new EmbedBuilder()
      .setTitle('🎡 룰렛 결과')
      .addFields(
        { name: '결과', value: `**${spin} (${colorTxt})**`, inline: true },
        { name: '지급', value: `${payout.toLocaleString()}원`, inline: true },
        { name: '잔액', value: `${getMoney(uid).toLocaleString()}원`, inline: true }
      )
      .setColor('#fbbf24')
      .setTimestamp();

    return safeReply({ embeds: [embed] });
  }

  // =============================================================
  // 🔧 관리자 명령어
  // =============================================================
  if (cmd === '전체회수') {
    if (!isAdmin(interaction.member)) return safeReply({ content: '❌ 권한 없음', ephemeral: true });
    const db = getDB();
    for (const id in db.users) db.users[id].money = 0;
    saveDB(db);
    return safeReply({ content: '✅ 모든 유저의 돈을 회수했습니다.' });
  }

  if (cmd === '전체지급') {
    if (!isAdmin(interaction.member)) return safeReply({ content: '❌ 권한 없음', ephemeral: true });
    const amount = interaction.options.getInteger('금액');
    if (!amount || amount <= 0) return safeReply({ content: '❌ 금액 오류', ephemeral: true });
    const db = getDB();
    for (const id in db.users) db.users[id].money = (db.users[id].money || 0) + amount;
    saveDB(db);
    return safeReply({ content: `✅ 모든 유저에게 ${amount.toLocaleString()}원 지급 완료` });
  }

  if (cmd === '돈회수') {
    if (!isAdmin(interaction.member)) return safeReply({ content: '❌ 권한 없음', ephemeral: true });
    const target = interaction.options.getUser('대상');
    const amt = interaction.options.getInteger('금액');
    if (!target || !amt || amt <= 0) return safeReply({ content: '❌ 입력 오류', ephemeral: true });
    ensureUser(target.id);
    addMoney(target.id, -amt);
    return safeReply({ content: `✅ ${target.username}님의 돈 ${amt.toLocaleString()}원 회수 완료` });
  }

  if (cmd === '돈지급') {
    if (!isAdmin(interaction.member)) return safeReply({ content: '❌ 권한 없음', ephemeral: true });
    const target = interaction.options.getUser('대상');
    const amt = interaction.options.getInteger('금액');
    if (!target || !amt || amt <= 0) return safeReply({ content: '❌ 입력 오류', ephemeral: true });
    ensureUser(target.id);
    addMoney(target.id, amt);
    return safeReply({ content: `✅ ${target.username}님에게 ${amt.toLocaleString()}원 지급 완료` });
  }

  // =============================================================
  // fallback
  // =============================================================
  return safeReply({ content: '❓ 알 수 없는 명령어입니다. deploy-commands.js가 최신인지 확인해줘!', ephemeral: true });
});

// -------------------- Login --------------------
initDB();
initStocks();

client.login(process.env.TOKEN);



