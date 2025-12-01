// =============================================================
//  Discord Casino Bot - NET PROFIT FIXED VERSION
// =============================================================
require('dotenv').config();
const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder 
} = require('discord.js');

// 클라이언트
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});


// =============================================================
//  데이터베이스 안정화 버전
// =============================================================
const DB_FILE = './db.json';
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: {},
    shop: {}
  }, null, 2));
}

function getDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function ensureUser(uid) {
  const db = getDB();
  if (!db.users[uid]) {
    db.users[uid] = { money: 10000000, items: {} };
    saveDB(db);
  }
  return db.users[uid];
}

function getMoney(uid) {
  const db = getDB();
  if (!db.users[uid]) {
    // 혹시 모를 경우 자동 생성
    db.users[uid] = { money: 10000000, items: {} };
    saveDB(db);
  }
  return db.users[uid].money;
}

function addMoney(uid, delta) {
  const db = getDB();
  if (!db.users[uid]) {
    db.users[uid] = { money: 10000000, items: {} };
  }
  db.users[uid].money += delta;
  saveDB(db);
}

function setMoney(uid, amt) {
  const db = getDB();
  if (!db.users[uid]) {
    db.users[uid] = { money: 10000000, items: {} };
  }
  db.users[uid].money = amt;
  saveDB(db);
}

function isAdmin(member) {
  try {
    return member.permissions.has("Administrator");
  } catch {
    return false;
  }
}


// =============================================================
//  카드 유틸 함수
// =============================================================
function cardImageUrl(rank, suit) {
  return `https://deckofcardsapi.com/static/img/${rank === '10' ? '0' : rank}${suit}.png`;
}

function drawPlayingCard() {
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const suits = ['S','H','D','C'];
  const r = ranks[Math.floor(Math.random()*ranks.length)];
  const s = suits[Math.floor(Math.random()*suits.length)];
  return { 
    code:`${r}${s}`, 
    rank:r, 
    suit:s, 
    img:cardImageUrl(r,s) 
  };
}

function suitEmoji(suit){
  if(suit==='S') return '♠️';
  if(suit==='H') return '♥️';
  if(suit==='D') return '♦️';
  if(suit==='C') return '♣️';
  return suit;
}

function baccaratCardValueFromRank(rank){
  if(rank==='A') return 1;
  if(['10','J','Q','K'].includes(rank)) return 0;
  return parseInt(rank);
}

function dragonTigerCardValue(rank){
  if(rank==='A') return 1;
  if(rank==='J') return 11;
  if(rank==='Q') return 12;
  if(rank==='K') return 13;
  return parseInt(rank);
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }


// =============================================================
//  게임별 데이터
// =============================================================
const prizeItems = [
  { name:"역선권", chance:10 },
  { name:"편지", chance:0.5 },
  { name:"1000만원", chance:2 },
  { name:"신청곡 라이브", chance:5 },
  { name:"유리/두만 애교", chance:0.1 },
  { name:"일본어 대본 연기 (믹싱본)", chance:3 }
];

const slotEmojis = ['🍒','🍋','🍊','🍉','⭐','💎'];

const rouletteRed = [
  1,3,5,7,9,12,14,16,18,
  19,21,23,25,27,30,32,34,36
];


// =============================================================
//  READY
// =============================================================
client.once('ready',()=>console.log(`${client.user.tag} ready`));


// =============================================================
//  Slash 명령어 처리
// =============================================================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const uid = interaction.user.id;
  ensureUser(uid);

  const cmd = interaction.commandName;


  // --------------------------- 돈 확인 ---------------------------
  if (cmd === '돈') {
    return interaction.reply({
      content: `💰 현재 잔액: **${getMoney(uid).toLocaleString()}원**`,
      ephemeral: true
    });
  }


  // =============================================================
  //  🐉 용호 (이기면 +베팅, 지면 -베팅, 무승부 0)
  // =============================================================
  if(cmd === '용호'){
    const bet = interaction.options.getInteger('베팅');
    const choiceRaw = interaction.options.getString('선택').toLowerCase();

    if (bet <= 0) return interaction.reply({ content:'베팅 금액이 올바르지 않습니다.', ephemeral:true });
    if (getMoney(uid) < bet)
      return interaction.reply({ content:'잔액 부족', ephemeral:true });

    const map = {
      'dragon':'dragon','d':'dragon','용':'dragon','드래곤':'dragon',
      'tiger':'tiger','t':'tiger','호':'tiger','타이거':'tiger',
      'tie':'tie','타이':'tie','무':'tie'
    };

    const choice = map[choiceRaw];
    if(!choice) return interaction.reply({ content:'선택 오류', ephemeral:true });

    const dCard = drawPlayingCard();
    const tCard = drawPlayingCard();
    const dVal = dragonTigerCardValue(dCard.rank);
    const tVal = dragonTigerCardValue(tCard.rank);

    await interaction.reply({
      embeds:[ new EmbedBuilder()
        .setTitle('🐉 용호 - 마감 완료')
        .setDescription('카드 공개 중...')
        .setColor('#22c55e') ]
    });

    await sleep(700);
    await interaction.editReply({
      embeds:[ new EmbedBuilder()
        .setTitle('Dragon 카드')
        .setDescription(`${dCard.rank}${suitEmoji(dCard.suit)} → ${dVal}`)
        .setImage(dCard.img)
        .setColor('#22c55e') ]
    });

    await sleep(700);
    await interaction.editReply({
      embeds:[ new EmbedBuilder()
        .setTitle('Tiger 카드')
        .setDescription(`${tCard.rank}${suitEmoji(tCard.suit)} → ${tVal}`)
        .setImage(tCard.img)
        .setColor('#ef4444') ]
    });

    let result = '';
    let netChange = 0;

    if(dVal === tVal){
      result = 'tie';
      netChange = 0;          // 무승부 → 손익 0
    } else {
      result = dVal > tVal ? 'dragon' : 'tiger';
      if(choice === result){
        netChange = +bet;     // 승 → +베팅금
      } else {
        netChange = -bet;     // 패 → -베팅금
      }
    }

    addMoney(uid, netChange);

    await sleep(500);
    return interaction.editReply({
      embeds:[ new EmbedBuilder()
        .setTitle('🐉 용호 결과')
        .addFields(
          { name:'Dragon', value:`${dVal}`, inline:true },
          { name:'Tiger', value:`${tVal}`, inline:true },
          { name:'결과', value:result.toUpperCase(), inline:false },
          { name:'변동', value:`${netChange>=0?'+':''}${netChange.toLocaleString()}원`, inline:true },
          { name:'잔액', value:`${getMoney(uid).toLocaleString()}원`, inline:true }
        )
        .setColor(result==='dragon'?'#22c55e':result==='tiger'?'#ef4444':'#facc15')
        .setTimestamp()
      ]
    });
  }


  // =============================================================
  //  🎴 바카라 (카지노 룰에 가깝게)
  //  - Player 승: +베팅
  //  - Banker 승: +0.95배
  //  - Tie 승(Tie에 베팅): +8배 (8:1)
  //  - Tie인데 Player/Banker에 베팅: 0 (푸시)
  //  - 그 외 패배: -베팅
  // =============================================================
  if(cmd === '바카라'){
    const bet = interaction.options.getInteger('베팅');
    const choiceRaw = interaction.options.getString('선택').toLowerCase();

    if (bet <= 0) return interaction.reply({ content:'베팅 금액이 올바르지 않습니다.', ephemeral:true });
    if(getMoney(uid) < bet)
      return interaction.reply({ content:'잔액 부족', ephemeral:true });

    const map = {
      'player':'player','플레이어':'player','p':'player',
      'banker':'banker','뱅커':'banker','b':'banker',
      'tie':'tie','타이':'tie','t':'tie'
    };
    const choice = map[choiceRaw];
    if(!choice) return interaction.reply({ content:'선택 오류', ephemeral:true });

    // 초기 카드
    let pCards = [drawPlayingCard(), drawPlayingCard()];
    let bCards = [drawPlayingCard(), drawPlayingCard()];

    let pTotal = (baccaratCardValueFromRank(pCards[0].rank) + baccaratCardValueFromRank(pCards[1].rank)) % 10;
    let bTotal = (baccaratCardValueFromRank(bCards[0].rank) + baccaratCardValueFromRank(bCards[1].rank)) % 10;

    await interaction.reply({
      embeds:[ new EmbedBuilder()
        .setTitle('🎴 바카라 시작!')
        .setDescription('카드 공개 중...')
        .setColor('#2dd4bf') ]
    });

    // 카드 공개 순서
    const seq = [
      { title:'플레이어 첫 카드', card:pCards[0], color:'#2dd4bf' },
      { title:'뱅커 첫 카드', card:bCards[0], color:'#ef4444' },
      { title:'플레이어 두 번째 카드', card:pCards[1], color:'#2dd4bf' },
      { title:'뱅커 두 번째 카드', card:bCards[1], color:'#ef4444' }
    ];

    for(const step of seq){
      await sleep(800);
      await interaction.editReply({
        embeds:[ new EmbedBuilder()
          .setTitle(step.title)
          .setImage(step.card.img)
          .setColor(step.color) ]
      });
    }

    // 3번째 카드 규칙
    let p3=null, b3=null, p3v=null;

    if(!(pTotal >= 8 || bTotal >= 8)){

      // 플레이어 3카드
      if(pTotal <= 5){
        p3 = drawPlayingCard();
        pCards.push(p3);
        p3v = baccaratCardValueFromRank(p3.rank);
        pTotal = (pTotal + p3v) % 10;
        await sleep(700);
        await interaction.editReply({
          embeds:[ new EmbedBuilder()
            .setTitle('플레이어 3번째 카드')
            .setImage(p3.img)
            .setColor('#2dd4bf') ]
        });
      }

      // 뱅커 3카드 규칙
      if(!p3){
        if(bTotal <= 5){
          b3 = drawPlayingCard();
          bCards.push(b3);
          bTotal = (bTotal + baccaratCardValueFromRank(b3.rank)) % 10;
          await sleep(700);
          await interaction.editReply({
            embeds:[ new EmbedBuilder()
              .setTitle('뱅커 3번째 카드')
              .setImage(b3.img)
              .setColor('#ef4444') ]
          });
        }
      } else {
        if((bTotal <= 2) ||
           (bTotal === 3 && p3v !== 8) ||
           (bTotal === 4 && [2,3,4,5,6,7].includes(p3v)) ||
           (bTotal === 5 && [4,5,6,7].includes(p3v)) ||
           (bTotal === 6 && [6,7].includes(p3v))) {
             b3 = drawPlayingCard();
             bCards.push(b3);
             bTotal = (bTotal + baccaratCardValueFromRank(b3.rank)) % 10;
             await sleep(700);
             await interaction.editReply({
               embeds:[ new EmbedBuilder()
                 .setTitle('뱅커 3번째 카드')
                 .setImage(b3.img)
                 .setColor('#ef4444') ]
             });
        }
      }
    }

    // 승패 판정
    let result = '';
    if(pTotal > bTotal) result = 'player';
    else if(bTotal > pTotal) result = 'banker';
    else result = 'tie';

    let netChange = 0;

    if(result === 'tie'){
      if(choice === 'tie'){
        // Tie 에 베팅해서 맞춤 → 8:1 수익
        netChange = bet * 8;
      } else {
        // Player/Banker에 베팅했는데 Tie → 푸시 (0)
        netChange = 0;
      }
    } else {
      // Player or Banker 승
      if(choice === result){
        if(result === 'player') netChange = bet;                       // +1배
        if(result === 'banker') netChange = Math.floor(bet * 0.95);   // +0.95배
      } else {
        netChange = -bet; // 틀리면 -베팅
      }
    }

    addMoney(uid, netChange);

    await sleep(500);
    return interaction.editReply({
      embeds:[ new EmbedBuilder()
        .setTitle('🎴 바카라 최종 결과')
        .addFields(
          { name:'플레이어', value:`${pCards.map(c=>`${c.rank}${suitEmoji(c.suit)}`).join(', ')} → **${pTotal}**`, inline:true },
          { name:'뱅커', value:`${bCards.map(c=>`${c.rank}${suitEmoji(c.suit)}`).join(', ')} → **${bTotal}**`, inline:true },
          { name:'결과', value:result.toUpperCase(), inline:false },
          { name:'변동', value:`${netChange>=0?'+':''}${netChange.toLocaleString()}원`, inline:true },
          { name:'잔액', value:`${getMoney(uid).toLocaleString()}원`, inline:true }
        )
        .setColor('#2dd4bf')
        .setTimestamp()
      ]
    });
  }



  // =============================================================
  //  🎁 뽑기 (500만 베팅, 1000만 당첨 시 +500만 순이익)
  // =============================================================
  if(cmd === '뽑기'){
    const bet = 5000000;
    if(getMoney(uid) < bet)
      return interaction.reply({ content:'잔액 부족 (500만 원 필요)', ephemeral:true });

    let netChange = -bet;

    const r = Math.random()*100;
    let acc = 0;
    let prize = null;

    for(const item of prizeItems){
      acc += item.chance;
      if(r <= acc){
        prize = item;
        break;
      }
    }

    if(!prize) prize = { name:"꽝", chance:0 };

    let moneyWon = 0;
    if(prize.name === "1000만원"){
      moneyWon = 10000000;
      netChange += moneyWon;
    }

    addMoney(uid, netChange);

    const embed = new EmbedBuilder()
      .setTitle('🎁 뽑기 결과')
      .setDescription(prize.name)
      .addFields(
        { name:'변동', value:`${netChange>=0?'+':''}${netChange.toLocaleString()}원`, inline:true },
        { name:'실제 획득', value: moneyWon > 0 ? `${moneyWon.toLocaleString()}원` : prize.name, inline:true },
        { name:'잔액', value: `${getMoney(uid).toLocaleString()}원`, inline:true }
      )
      .setColor('#facc15');

    return interaction.reply({ embeds:[embed] });
  }



  // =============================================================
  //  🎰 슬롯 (베팅 -1, 3개 일치 시 +5 → 순이익 +4배)
  // =============================================================
  if(cmd === '슬롯'){
    const bet = interaction.options.getInteger('베팅');
    if (bet <= 0) return interaction.reply({ content:'베팅 금액이 올바르지 않습니다.', ephemeral:true });

    if(getMoney(uid) < bet)
      return interaction.reply({ content:'잔액 부족', ephemeral:true });

    const r = [
      slotEmojis[Math.floor(Math.random()*slotEmojis.length)],
      slotEmojis[Math.floor(Math.random()*slotEmojis.length)],
      slotEmojis[Math.floor(Math.random()*slotEmojis.length)]
    ];

    let netChange = -bet;
    let gain = 0;

    if(r[0]===r[1] && r[1]===r[2]){
      gain = bet * 5;      // 총 지급금
      netChange += gain;   // 순이익 +4배
    }

    addMoney(uid, netChange);

    return interaction.reply({
      embeds:[ new EmbedBuilder()
        .setTitle('🎰 슬롯 결과')
        .setDescription(r.join(' '))
        .addFields(
          { name:'변동', value:`${netChange>=0?'+':''}${netChange.toLocaleString()}원`, inline:true },
          { name:'총 지급', value: gain>0 ? `${gain.toLocaleString()}원` : '없음', inline:true },
          { name:'잔액', value:`${getMoney(uid).toLocaleString()}원`, inline:true }
        )
        .setColor('#f472b6')
        .setTimestamp()
      ]
    });
  }



  // =============================================================
  //  🎡 룰렛
  //  - red/black/odd/even 맞추면 +베팅, 틀리면 -베팅
  //  - 숫자(0~36) 맞추면 +35배 (35:1)
  // =============================================================
  if(cmd === '룰렛'){
    const bet = interaction.options.getInteger('베팅');
    let choice = interaction.options.getString('선택').toLowerCase();

    if (bet <= 0) return interaction.reply({ content:'베팅 금액이 올바르지 않습니다.', ephemeral:true });
    if(getMoney(uid) < bet)
      return interaction.reply({ content:'잔액 부족', ephemeral:true });

    const spin = Math.floor(Math.random()*37);

    let resultText = '';
    let netChange = 0;

    const isRed = rouletteRed.includes(spin);
    const isBlack = (spin !== 0 && !isRed); // 0은 초록이라고 치고 배당 없음

    if(choice === 'red' || choice === '빨강'){
      resultText = isRed ? 'red' : (isBlack ? 'black' : '0');
      if(isRed) netChange = +bet;
      else netChange = -bet;
    }
    else if(choice === 'black' || choice === '검정'){
      resultText = isRed ? 'red' : (isBlack ? 'black' : '0');
      if(isBlack) netChange = +bet;
      else netChange = -bet;
    }
    else if(choice === '홀' || choice === 'odd'){
      resultText = spin % 2 === 1 ? '홀' : '짝';
      if(spin !== 0 && spin % 2 === 1) netChange = +bet;
      else netChange = -bet;
    }
    else if(choice === '짝' || choice === 'even'){
      resultText = spin % 2 === 0 ? '짝' : '홀';
      // 0도 짝수 취급 안 하고 그냥 패배 처리
      if(spin !== 0 && spin % 2 === 0) netChange = +bet;
      else netChange = -bet;
    }
    else if(!isNaN(choice)){
      const num = parseInt(choice);
      if(num < 0 || num > 36){
        return interaction.reply({ content:'숫자는 0~36 사이여야 합니다.', ephemeral:true });
      }
      resultText = spin.toString();
      if(num === spin){
        netChange = bet * 35;  // 순이익 35:1
      } else {
        netChange = -bet;
      }
    } else {
      return interaction.reply({ content:'선택값이 올바르지 않습니다. (red/black/odd/even 또는 숫자)', ephemeral:true });
    }

    addMoney(uid, netChange);

    return interaction.reply({
      embeds:[ new EmbedBuilder()
        .setTitle('🎡 룰렛 결과')
        .addFields(
          { name:'결과 숫자', value:spin.toString(), inline:true },
          { name:'변동', value:`${netChange>=0?'+':''}${netChange.toLocaleString()}원`, inline:true },
          { name:'잔액', value:`${getMoney(uid).toLocaleString()}원`, inline:true }
        )
        .setColor('#fbbf24')
      ]
    });
  }



  // =============================================================
  //  🔧 관리자 명령어
  // =============================================================
  if(cmd === '전체회수'){
    if(!isAdmin(interaction.member))
      return interaction.reply({ content:'권한 없음', ephemeral:true });

    const db = getDB();
    for(const id in db.users){
      db.users[id].money = 0;
    }
    saveDB(db);

    return interaction.reply('✅ 모든 유저 잔액 0원으로 초기화됨.');
  }

  if(cmd === '전체지급'){
    if(!isAdmin(interaction.member))
      return interaction.reply({ content:'권한 없음', ephemeral:true });

    const amt = interaction.options.getInteger('금액');

    const db = getDB();
    for(const id in db.users){
      if (!db.users[id]) db.users[id] = { money: 10000000, items: {} };
      db.users[id].money += amt;
    }
    saveDB(db);

    return interaction.reply(`✅ 모든 유저에게 ${amt.toLocaleString()}원 지급 완료`);
  }

  if(cmd === '돈회수'){
    if(!isAdmin(interaction.member))
      return interaction.reply({ content:'권한 없음', ephemeral:true });

    const target = interaction.options.getUser('대상');
    const amt = interaction.options.getInteger('금액');

    addMoney(target.id, -amt);

    return interaction.reply(`✅ ${target.username}님에게서 ${amt.toLocaleString()}원 회수 완료`);
  }

  if(cmd === '돈지급'){
    if(!isAdmin(interaction.member))
      return interaction.reply({ content:'권한 없음', ephemeral:true });

    const target = interaction.options.getUser('대상');
    const amt = interaction.options.getInteger('금액');

    addMoney(target.id, amt);

    return interaction.reply(`✅ ${target.username}님에게 ${amt.toLocaleString()}원 지급 완료`);
  }

});


// =============================================================
client.login(process.env.TOKEN);
// =============================================================
