// =============================================================
//  Yuri Casino Bot - Full Integrated Version (단일 index.js)
// =============================================================
require('dotenv').config();
const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// =============================================================
//  DB 초기화
// =============================================================
const DB_FILE = './db.json';
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: {},          // 유저 데이터
    market: {           // 마약/주식 시세
      drugPrice: 100000,
      stocks: {}
    },
    news: []            // 경제 뉴스
  }, null, 2));
}

function getDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function ensureUser(db, uid) {
  if (!db.users[uid]) {
    db.users[uid] = {
      money: 10000000,
      drugs: 0,
      stocks: {}   // { 종목명: 수량 }
    };
  }
  return db.users[uid];
}

function isAdmin(member) {
  try {
    return member.permissions && member.permissions.has("Administrator");
  } catch {
    return false;
  }
}

// =============================================================
//  공통 유틸
// =============================================================
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 카드
function cardImageUrl(rank, suit) {
  return `https://deckofcardsapi.com/static/img/${rank === '10' ? '0' : rank}${suit}.png`;
}
function drawPlayingCard() {
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const suits = ['S','H','D','C'];
  const r = ranks[Math.floor(Math.random()*ranks.length)];
  const s = suits[Math.floor(Math.random()*suits.length)];
  return { rank: r, suit: s, img: cardImageUrl(r,s) };
}
function suitEmoji(suit) {
  if (suit === 'S') return '♠️';
  if (suit === 'H') return '♥️';
  if (suit === 'D') return '♦️';
  if (suit === 'C') return '♣️';
  return suit;
}
function baccaratCardValueFromRank(rank){
  if(rank === 'A') return 1;
  if(['10','J','Q','K'].includes(rank)) return 0;
  return parseInt(rank);
}
function dragonTigerCardValue(rank){
  if(rank === 'A') return 1;
  if(rank === 'J') return 11;
  if(rank === 'Q') return 12;
  if(rank === 'K') return 13;
  return parseInt(rank);
}

// =============================================================
//  뽑기 확률
// =============================================================
const prizeItems = [
  { name:"역선권",           chance:12 },
  { name:"편지",             chance:0.5 },
  { name:"1000만원",         chance:3 },
  { name:"신청곡 라이브",     chance:2 },
  { name:"유리/두만 애교",    chance:0.1 },
  { name:"일본어 대본 연기 (믹싱본)", chance:2 }
];

// =============================================================
//  슬롯 / 룰렛
// =============================================================
const slotEmojis = ['🍒','🍋','🍊','🍉','⭐','💎'];
const rouletteRed = [
  1,3,5,7,9,12,14,16,18,
  19,21,23,25,27,30,32,34,36
];

// =============================================================
//  주식 + 뉴스 시스템
// =============================================================
const STOCK_NAMES = [
  "유리방산",
  "유리제약",
  "유리전기공사",
  "유리교통공사",
  "유리야구단",
  "유리전자"
];

const GOOD_NEWS = [
  "혁신 기술 발표로 투자자 신뢰 급증!",
  "정부 대형 프로젝트 독점 수주!",
  "해외 시장 대규모 진출 발표!",
  "차세대 AI 특허 승인 소식!",
  "전 세계적인 관심이 집중되고 있습니다!"
];

const BAD_NEWS = [
  "기술 결함 논란으로 품질 문제가 제기되었습니다.",
  "대규모 제품 리콜 사태가 발생했습니다.",
  "해외 투자 철회 소식이 전해졌습니다.",
  "시장 점유율 급감으로 위기론이 대두되고 있습니다.",
  "안전성 논란이 확대되고 있습니다."
];

function addNews(db, text) {
  db.news.unshift(text);
  if (db.news.length > 20) db.news = db.news.slice(0,20);
}

// 주식 시세 초기화
(function initMarket(){
  const db = getDB();
  if (!db.market) db.market = { drugPrice: 100000, stocks:{} };
  if (!db.market.drugPrice) db.market.drugPrice = 100000;
  if (!db.market.stocks) db.market.stocks = {};

  STOCK_NAMES.forEach(name=>{
    if (!db.market.stocks[name]) {
      db.market.stocks[name] = Math.floor(Math.random()*400) + 200; // 200~600
    }
  });

  saveDB(db);
})();

// 3분마다 주식 변동
setInterval(()=>{
  const db = getDB();
  const stocks = db.market.stocks;

  STOCK_NAMES.forEach(name=>{
    let price = stocks[name];

    // 기본 변동 (-8% ~ +13%) : 살짝 우상향 느낌
    let base = (Math.random() * 0.21) - 0.08;
    price = Math.max(50, Math.floor(price * (1 + base)));

    // 급등/폭락 이벤트
    const roll = Math.random();

    if (roll < 0.08) { // 폭락
      const pct = Math.floor(Math.random()*30)+20; // 20~50%
      price = Math.max(30, Math.floor(price * (1 - pct/100)));
      const news = `📉 **${name} 대폭 폭락!** (약 -${pct}%) — ${BAD_NEWS[Math.floor(Math.random()*BAD_NEWS.length)]}`;
      addNews(db, news);
    } else if (roll > 0.92) { // 급등
      const pct = Math.floor(Math.random()*30)+20;
      price = Math.floor(price * (1 + pct/100));
      const news = `📈 **${name} 대폭 상승!** (약 +${pct}%) — ${GOOD_NEWS[Math.floor(Math.random()*GOOD_NEWS.length)]}`;
      addNews(db, news);
    }

    stocks[name] = price;
  });

  saveDB(db);
}, 180000); // 3분

// =============================================================
//  마약 시세 (5분마다 변동)
// =============================================================
setInterval(()=>{
  const db = getDB();
  let price = db.market.drugPrice || 100000;

  // -20% ~ +20%
  const delta = (Math.random()*0.4) - 0.2;
  price = Math.max(1000, Math.floor(price * (1 + delta)));

  db.market.drugPrice = price;
  saveDB(db);
}, 300000); // 5분

// =============================================================
//  READY
// =============================================================
client.once('ready', () => {
  console.log(`${client.user.tag} ready`);
});

// =============================================================
//  INTERACTIONS
// =============================================================
client.on('interactionCreate', async (interaction)=>{
  if(!interaction.isChatInputCommand()) return;

  // 우선 deferReply 해서 Unknown interaction 방지
  await interaction.deferReply();

  const uid = interaction.user.id;
  const db = getDB();
  const user = ensureUser(db, uid);
  const cmd = interaction.commandName;

// -------------------------------------------------------------
// 💰 돈
// -------------------------------------------------------------
  if (cmd === '돈') {
    await interaction.editReply({
      content: `💰 ${interaction.user.username}님의 현재 잔액: **${user.money.toLocaleString()}원**`
    });
    saveDB(db);
    return;
  }

// -------------------------------------------------------------
// 📊 랭킹
// -------------------------------------------------------------
  if (cmd === '랭킹') {
    const list = Object.entries(db.users)
      .map(([id, u]) => ({ id, name: id, money: u.money }))
      .sort((a,b)=> b.money - a.money)
      .slice(0,10);

    const desc = list.length
      ? list.map((u,i)=>`${i+1}. <@${u.id}> — **${u.money.toLocaleString()}원**`).join('\n')
      : '아직 유저 데이터가 없습니다.';

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('💰 경제 랭킹 TOP 10')
          .setDescription(desc)
          .setColor('#f97316')
      ]
    });
    return;
  }

// -------------------------------------------------------------
// 💸 송금
// -------------------------------------------------------------
  if (cmd === '송금') {
    const target = interaction.options.getUser('대상');
    const amount = interaction.options.getInteger('금액');

    if (!target) {
      await interaction.editReply('대상 유저를 찾을 수 없습니다.');
      return;
    }
    if (amount <= 0) {
      await interaction.editReply('0원 이하는 보낼 수 없습니다.');
      return;
    }
    if (user.money < amount) {
      await interaction.editReply('잔액이 부족합니다.');
      return;
    }

    const tUser = ensureUser(db, target.id);
    user.money -= amount;
    tUser.money += amount;
    saveDB(db);

    await interaction.editReply(`✅ <@${target.id}>님에게 **${amount.toLocaleString()}원** 송금 완료!\n현재 잔액: **${user.money.toLocaleString()}원**`);
    return;
  }

// -------------------------------------------------------------
// 🐉 용호
// -------------------------------------------------------------
  if (cmd === '용호') {
    const bet = interaction.options.getInteger('베팅');
    const choiceRaw = interaction.options.getString('선택').toLowerCase();

    if (bet <= 0) {
      await interaction.editReply('베팅 금액은 1원 이상이어야 합니다.');
      return;
    }
    if (user.money < bet) {
      await interaction.editReply('잔액 부족');
      return;
    }

    const map = {
      'dragon':'dragon','d':'dragon','용':'dragon','드래곤':'dragon',
      'tiger':'tiger','t':'tiger','호':'tiger','타이거':'tiger',
      'tie':'tie','타이':'tie','무':'tie'
    };
    const choice = map[choiceRaw];
    if (!choice) {
      await interaction.editReply('선택값이 올바르지 않습니다. (dragon / tiger / tie)');
      return;
    }

    const dCard = drawPlayingCard();
    const tCard = drawPlayingCard();
    const dVal = dragonTigerCardValue(dCard.rank);
    const tVal = dragonTigerCardValue(tCard.rank);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🐉 용호 - 마감 완료')
          .setDescription('카드 공개 중...')
          .setColor('#22c55e')
      ]
    });

    await sleep(700);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Dragon 카드')
          .setDescription(`${dCard.rank}${suitEmoji(dCard.suit)} → ${dVal}`)
          .setImage(dCard.img)
          .setColor('#22c55e')
      ]
    });

    await sleep(700);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Tiger 카드')
          .setDescription(`${tCard.rank}${suitEmoji(tCard.suit)} → ${tVal}`)
          .setImage(tCard.img)
          .setColor('#ef4444')
      ]
    });

    let result;
    if (dVal === tVal) result = 'tie';
    else result = dVal > tVal ? 'dragon' : 'tiger';

    let delta = 0;
    if (result === 'tie') {
      if (choice === 'tie') delta = bet * 8; // 8배
      else delta = 0; // 비선택자는 무승부
    } else {
      if (choice === result) delta = bet; // 1배 수익
      else delta = -bet;
    }

    user.money += delta;
    saveDB(db);

    const diffStr = `${delta >= 0 ? '+' : ''}${delta.toLocaleString()}원`;

    await sleep(500);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🐉 용호 결과')
          .addFields(
            { name:'Dragon', value:`${dCard.rank}${suitEmoji(dCard.suit)} → **${dVal}**`, inline:true },
            { name:'Tiger',  value:`${tCard.rank}${suitEmoji(tCard.suit)} → **${tVal}**`, inline:true },
            { name:'결과',   value: result.toUpperCase(), inline:false },
            { name:'베팅',   value: `${bet.toLocaleString()}원`, inline:true },
            { name:'변동',   value: diffStr, inline:true },
            { name:'잔액',   value: `${user.money.toLocaleString()}원`, inline:true }
          )
          .setColor(result==='dragon' ? '#22c55e' : result==='tiger' ? '#ef4444' : '#facc15')
          .setTimestamp()
      ]
    });
    return;
  }

// -------------------------------------------------------------
// 🎴 바카라
// -------------------------------------------------------------
  if (cmd === '바카라') {
    const bet = interaction.options.getInteger('베팅');
    const choiceRaw = interaction.options.getString('선택').toLowerCase();

    if (bet <= 0) {
      await interaction.editReply('베팅 금액은 1원 이상이어야 합니다.');
      return;
    }
    if (user.money < bet) {
      await interaction.editReply('잔액 부족');
      return;
    }

    const map = {
      'player':'player','플레이어':'player','p':'player',
      'banker':'banker','뱅커':'banker','b':'banker',
      'tie':'tie','타이':'tie','t':'tie'
    };
    const choice = map[choiceRaw];
    if (!choice) {
      await interaction.editReply('선택값이 올바르지 않습니다. (player / banker / tie)');
      return;
    }

    let pCards = [drawPlayingCard(), drawPlayingCard()];
    let bCards = [drawPlayingCard(), drawPlayingCard()];

    let pTotal = (baccaratCardValueFromRank(pCards[0].rank) + baccaratCardValueFromRank(pCards[1].rank)) % 10;
    let bTotal = (baccaratCardValueFromRank(bCards[0].rank) + baccaratCardValueFromRank(bCards[1].rank)) % 10;

    await interaction.editReply({
      embeds:[
        new EmbedBuilder()
          .setTitle('🎴 바카라 시작!')
          .setDescription('카드 공개 중...')
          .setColor('#2dd4bf')
      ]
    });

    const seq = [
      { title:'플레이어 첫 카드', card:pCards[0], color:'#2dd4bf' },
      { title:'뱅커 첫 카드',     card:bCards[0], color:'#f87171' },
      { title:'플레이어 두 번째 카드', card:pCards[1], color:'#2dd4bf' },
      { title:'뱅커 두 번째 카드',     card:bCards[1], color:'#f87171' }
    ];

    for (const step of seq) {
      await sleep(800);
      await interaction.editReply({
        embeds:[
          new EmbedBuilder()
            .setTitle(step.title)
            .setImage(step.card.img)
            .setColor(step.color)
        ]
      });
    }

    // 써드 카드 룰
    let p3 = null, b3 = null, p3v = null;
    if (!(pTotal >= 8 || bTotal >= 8)) {
      // 플레이어 3카드
      if (pTotal <= 5) {
        p3 = drawPlayingCard();
        pCards.push(p3);
        p3v = baccaratCardValueFromRank(p3.rank);
        pTotal = (pTotal + p3v) % 10;
        await sleep(700);
        await interaction.editReply({
          embeds:[
            new EmbedBuilder()
              .setTitle('플레이어 3번째 카드')
              .setImage(p3.img)
              .setColor('#2dd4bf')
          ]
        });
      }
      // 뱅커 3카드
      if (!p3) {
        if (bTotal <= 5) {
          b3 = drawPlayingCard();
          bCards.push(b3);
          bTotal = (bTotal + baccaratCardValueFromRank(b3.rank)) % 10;
          await sleep(700);
          await interaction.editReply({
            embeds:[
              new EmbedBuilder()
                .setTitle('뱅커 3번째 카드')
                .setImage(b3.img)
                .setColor('#f87171')
            ]
          });
        }
      } else {
        if ((bTotal <= 2) ||
            (bTotal === 3 && p3v !== 8) ||
            (bTotal === 4 && [2,3,4,5,6,7].includes(p3v)) ||
            (bTotal === 5 && [4,5,6,7].includes(p3v)) ||
            (bTotal === 6 && [6,7].includes(p3v))) {
          b3 = drawPlayingCard();
          bCards.push(b3);
          bTotal = (bTotal + baccaratCardValueFromRank(b3.rank)) % 10;
          await sleep(700);
          await interaction.editReply({
            embeds:[
              new EmbedBuilder()
                .setTitle('뱅커 3번째 카드')
                .setImage(b3.img)
                .setColor('#f87171')
            ]
          });
        }
      }
    }

    let result;
    if (pTotal > bTotal) result = 'player';
    else if (bTotal > pTotal) result = 'banker';
    else result = 'tie';

    let delta = 0;
    if (result === 'tie') {
      if (choice === 'tie') delta = bet * 8;   // 타이에 베팅 성공: 8배
      else delta = 0;                          // 나머지는 무승부 (환불)
    } else if (result === 'player') {
      if (choice === 'player') delta = bet;    // 1배 수익
      else delta = -bet;
    } else if (result === 'banker') {
      if (choice === 'banker') delta = Math.floor(bet * 0.95); // 0.95배
      else delta = -bet;
    }

    user.money += delta;
    saveDB(db);

    const diffStr = `${delta >= 0 ? '+' : ''}${delta.toLocaleString()}원`;

    await sleep(500);
    await interaction.editReply({
      embeds:[
        new EmbedBuilder()
          .setTitle('🎴 바카라 최종 결과')
          .addFields(
            { name:'플레이어', value:`${pCards.map(c=>`${c.rank}${suitEmoji(c.suit)}`).join(', ')} → **${pTotal}**`, inline:true },
            { name:'뱅커',   value:`${bCards.map(c=>`${c.rank}${suitEmoji(c.suit)}`).join(', ')} → **${bTotal}**`, inline:true },
            { name:'결과',   value: result.toUpperCase(), inline:false },
            { name:'베팅',   value: `${bet.toLocaleString()}원`, inline:true },
            { name:'변동',   value: diffStr, inline:true },
            { name:'잔액',   value: `${user.money.toLocaleString()}원`, inline:true }
          )
          .setColor('#2dd4bf')
          .setTimestamp()
      ]
    });
    return;
  }

// -------------------------------------------------------------
// 🎰 슬롯
// -------------------------------------------------------------
  if (cmd === '슬롯') {
    const bet = interaction.options.getInteger('베팅');

    if (bet <= 0) {
      await interaction.editReply('베팅 금액은 1원 이상이어야 합니다.');
      return;
    }
    if (user.money < bet) {
      await interaction.editReply('잔액 부족');
      return;
    }

    const r = [
      slotEmojis[Math.floor(Math.random()*slotEmojis.length)],
      slotEmojis[Math.floor(Math.random()*slotEmojis.length)],
      slotEmojis[Math.floor(Math.random()*slotEmojis.length)]
    ];

    let gain = 0; // 총 지급액
    let delta = 0; // 순이익
    if (r[0] === r[1] && r[1] === r[2]) {
      gain = bet * 5;
      delta = gain - bet;
    } else {
      gain = 0;
      delta = -bet;
    }

    user.money += delta;
    saveDB(db);

    await interaction.editReply({
      embeds:[
        new EmbedBuilder()
          .setTitle('🎰 슬롯 결과')
          .setDescription(r.join(' '))
          .addFields(
            { name:'베팅', value:`${bet.toLocaleString()}원`, inline:true },
            { name:'획득', value: gain>0 ? `${gain.toLocaleString()}원` : '꽝', inline:true },
            { name:'잔액', value:`${user.money.toLocaleString()}원`, inline:true }
          )
          .setColor('#f472b6')
          .setTimestamp()
      ]
    });
    return;
  }

// -------------------------------------------------------------
// 🎡 룰렛
// -------------------------------------------------------------
  if (cmd === '룰렛') {
    const bet = interaction.options.getInteger('베팅');
    let choice = interaction.options.getString('선택').toLowerCase();

    if (bet <= 0) {
      await interaction.editReply('베팅 금액은 1원 이상이어야 합니다.');
      return;
    }
    if (user.money < bet) {
      await interaction.editReply('잔액 부족');
      return;
    }

    const spin = Math.floor(Math.random()*37); // 0~36
    let delta = -bet; // 기본은 패배
    let gainText = '꽝';

    if (choice === 'red' || choice === '빨강') {
      const isRed = rouletteRed.includes(spin);
      if (spin !== 0 && isRed) {
        delta = bet;
        gainText = `${(bet*2).toLocaleString()}원`;
      }
    } else if (choice === 'black' || choice === '검정') {
      const isRed = rouletteRed.includes(spin);
      if (spin !== 0 && !isRed) {
        delta = bet;
        gainText = `${(bet*2).toLocaleString()}원`;
      }
    } else if (choice === 'odd' || choice === '홀') {
      if (spin !== 0 && spin % 2 === 1) {
        delta = bet;
        gainText = `${(bet*2).toLocaleString()}원`;
      }
    } else if (choice === 'even' || choice === '짝') {
      if (spin !== 0 && spin % 2 === 0) {
        delta = bet;
        gainText = `${(bet*2).toLocaleString()}원`;
      }
    } else if (!isNaN(choice)) {
      const num = parseInt(choice);
      if (num === spin) {
        delta = bet * 35;
        gainText = `${(bet*36).toLocaleString()}원`;
      }
    } else {
      await interaction.editReply('선택값이 올바르지 않습니다. (red/black/odd/even/숫자)');
      return;
    }

    user.money += delta;
    saveDB(db);

    const diffStr = `${delta >= 0 ? '+' : ''}${delta.toLocaleString()}원`;

    await interaction.editReply({
      embeds:[
        new EmbedBuilder()
          .setTitle('🎡 룰렛 결과')
          .addFields(
            { name:'결과 숫자', value: spin.toString(), inline:true },
            { name:'베팅', value:`${bet.toLocaleString()}원`, inline:true },
            { name:'획득', value: gainText, inline:true },
            { name:'변동', value: diffStr, inline:true },
            { name:'잔액', value:`${user.money.toLocaleString()}원`, inline:true }
          )
          .setColor('#fbbf24')
      ]
    });
    return;
  }

// -------------------------------------------------------------
// 🎁 뽑기
// -------------------------------------------------------------
  if (cmd === '뽑기') {
    const bet = 5000000;
    if (user.money < bet) {
      await interaction.editReply('💸 잔액 부족 (5,000,000원 필요)');
      return;
    }

    user.money -= bet;

    const r = Math.random()*100;
    let acc = 0;
    let prize = null;
    for (const item of prizeItems) {
      acc += item.chance;
      if (r <= acc) {
        prize = item;
        break;
      }
    }
    if (!prize) prize = { name:'꽝' };

    let gain = 0;
    if (prize.name === '1000만원') {
      gain = 10000000;
      user.money += gain;
    }

    saveDB(db);

    await interaction.editReply({
      embeds:[
        new EmbedBuilder()
          .setTitle('🎁 뽑기 결과')
          .setDescription(prize.name)
          .addFields(
            { name:'지출', value:`-5,000,000원`, inline:true },
            { name:'획득', value: gain>0 ? `${gain.toLocaleString()}원` : prize.name, inline:true },
            { name:'잔액', value:`${user.money.toLocaleString()}원`, inline:true }
          )
          .setColor('#facc15')
      ]
    });
    return;
  }

// -------------------------------------------------------------
// 💊 마약 시스템
// -------------------------------------------------------------
  if (cmd === '시세') {
    const price = db.market.drugPrice || 100000;
    await interaction.editReply({
      embeds:[
        new EmbedBuilder()
          .setTitle('💊 현재 마약 시세')
          .setDescription(`1개당 **${price.toLocaleString()}원**`)
          .setColor('#a855f7')
      ]
    });
    return;
  }

  if (cmd === '마약구매') {
    const qty = interaction.options.getInteger('수량');
    const price = db.market.drugPrice || 100000;
    if (qty <= 0) {
      await interaction.editReply('수량은 1개 이상이어야 합니다.');
      return;
    }
    const cost = price * qty;
    if (user.money < cost) {
      await interaction.editReply('잔액이 부족합니다.');
      return;
    }
    user.money -= cost;
    user.drugs += qty;
    saveDB(db);

    await interaction.editReply(`✅ 마약 **${qty}개** 구매 완료! (지출: ${cost.toLocaleString()}원)\n보유 마약: **${user.drugs}개**, 잔액: **${user.money.toLocaleString()}원**`);
    return;
  }

  if (cmd === '마약판매') {
    const qty = interaction.options.getInteger('수량');
    const price = db.market.drugPrice || 100000;
    if (qty <= 0) {
      await interaction.editReply('수량은 1개 이상이어야 합니다.');
      return;
    }
    if (user.drugs < qty) {
      await interaction.editReply('보유 마약이 부족합니다.');
      return;
    }
    const gain = price * qty;
    user.drugs -= qty;
    user.money += gain;
    saveDB(db);

    await interaction.editReply(`✅ 마약 **${qty}개** 판매 완료! (수익: ${gain.toLocaleString()}원)\n보유 마약: **${user.drugs}개**, 잔액: **${user.money.toLocaleString()}원**`);
    return;
  }

// -------------------------------------------------------------
// 📈 주식 시스템
// -------------------------------------------------------------
  if (cmd === '주식') {
    const lines = STOCK_NAMES.map((name,i)=>`${i+1}. **${name}** — ${db.market.stocks[name].toLocaleString()}원`);
    await interaction.editReply({
      embeds:[
        new EmbedBuilder()
          .setTitle('📈 유리 증권 시세')
          .setDescription(lines.join('\n'))
          .setColor('#22c55e')
      ]
    });
    return;
  }

  function resolveStockName(input) {
    input = input.trim();
    const idx = parseInt(input);
    if (!isNaN(idx) && idx >=1 && idx <= STOCK_NAMES.length) {
      return STOCK_NAMES[idx-1];
    }
    const found = STOCK_NAMES.find(n=> n === input);
    return found || null;
  }

  if (cmd === '주식구매') {
    const raw = interaction.options.getString('종목');
    const qty = interaction.options.getInteger('수량');
    const name = resolveStockName(raw);

    if (!name) {
      await interaction.editReply('존재하지 않는 종목입니다. (1~6 또는 정확한 이름)');
      return;
    }
    if (qty <= 0) {
      await interaction.editReply('수량은 1주 이상이어야 합니다.');
      return;
    }

    const price = db.market.stocks[name];
    const cost = price * qty;
    if (user.money < cost) {
      await interaction.editReply('잔액이 부족합니다.');
      return;
    }

    user.money -= cost;
    if (!user.stocks[name]) user.stocks[name] = 0;
    user.stocks[name] += qty;
    saveDB(db);

    await interaction.editReply(`✅ **${name}** ${qty}주 매수 완료! (지출: ${cost.toLocaleString()}원)\n보유: ${user.stocks[name]}주, 잔액: ${user.money.toLocaleString()}원`);
    return;
  }

  if (cmd === '주식판매') {
    const raw = interaction.options.getString('종목');
    const qty = interaction.options.getInteger('수량');
    const name = resolveStockName(raw);

    if (!name) {
      await interaction.editReply('존재하지 않는 종목입니다. (1~6 또는 정확한 이름)');
      return;
    }
    if (qty <= 0) {
      await interaction.editReply('수량은 1주 이상이어야 합니다.');
      return;
    }
    if (!user.stocks[name] || user.stocks[name] < qty) {
      await interaction.editReply('보유 주식 수량이 부족합니다.');
      return;
    }

    const price = db.market.stocks[name];
    const gain = price * qty;

    user.stocks[name] -= qty;
    user.money += gain;
    saveDB(db);

    await interaction.editReply(`✅ **${name}** ${qty}주 매도 완료! (수익: ${gain.toLocaleString()}원)\n보유: ${user.stocks[name]}주, 잔액: ${user.money.toLocaleString()}원`);
    return;
  }

// -------------------------------------------------------------
// 📰 뉴스
// -------------------------------------------------------------
  if (cmd === '뉴스') {
    const list = db.news.slice(0,10);
    const desc = list.length ? list.map(n=>`- ${n}`).join('\n') : '최근 경제 뉴스가 없습니다.';
    await interaction.editReply({
      embeds:[
        new EmbedBuilder()
          .setTitle('📰 최신 경제 뉴스')
          .setDescription(desc)
          .setColor('#eab308')
      ]
    });
    return;
  }

// -------------------------------------------------------------
// 🔧 관리자 명령어
// -------------------------------------------------------------
  if (cmd === '전체회수') {
    if (!isAdmin(interaction.member)) {
      await interaction.editReply('권한 없음');
      return;
    }
    for (const id in db.users) {
      db.users[id].money = 0;
    }
    saveDB(db);
    await interaction.editReply('✅ 모든 유저의 잔액을 0원으로 초기화했습니다.');
    return;
  }

  if (cmd === '전체지급') {
    if (!isAdmin(interaction.member)) {
      await interaction.editReply('권한 없음');
      return;
    }
    const amount = interaction.options.getInteger('금액');
    for (const id in db.users) {
      db.users[id].money += amount;
    }
    saveDB(db);
    await interaction.editReply(`✅ 모든 유저에게 **${amount.toLocaleString()}원** 지급 완료.`);
    return;
  }

  if (cmd === '돈회수') {
    if (!isAdmin(interaction.member)) {
      await interaction.editReply('권한 없음');
      return;
    }
    const target = interaction.options.getUser('대상');
    const amt = interaction.options.getInteger('금액');
    const tUser = ensureUser(db, target.id);
    tUser.money -= amt;
    saveDB(db);
    await interaction.editReply(`✅ ${target.username}님의 돈 **${amt.toLocaleString()}원** 회수 완료.`);
    return;
  }

  if (cmd === '돈지급') {
    if (!isAdmin(interaction.member)) {
      await interaction.editReply('권한 없음');
      return;
    }
    const target = interaction.options.getUser('대상');
    const amt = interaction.options.getInteger('금액');
    const tUser = ensureUser(db, target.id);
    tUser.money += amt;
    saveDB(db);
    await interaction.editReply(`✅ ${target.username}님에게 **${amt.toLocaleString()}원** 지급 완료.`);
    return;
  }

});

// =============================================================
client.login(process.env.TOKEN);
// =============================================================

