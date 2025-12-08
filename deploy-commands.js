const { SlashCommandBuilder } = require('discord.js');
const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [

  // ========================================
  // 💰 경제 / 프로필 / 송금
  // ========================================

  new SlashCommandBuilder()
    .setName('돈')
    .setDescription('현재 보유 금액을 확인합니다.'),

  new SlashCommandBuilder()
    .setName('랭킹')
    .setDescription('경제 랭킹 TOP10을 확인합니다.'),

  new SlashCommandBuilder()
    .setName('송금')
    .setDescription('다른 유저에게 돈을 송금합니다.')
    .addUserOption(o =>
      o.setName('대상')
       .setDescription('송금할 유저')
       .setRequired(true))
    .addIntegerOption(o =>
      o.setName('금액')
       .setDescription('송금할 금액')
       .setRequired(true)),


  // ========================================
  // 🎲 카지노 게임
  // ========================================

  new SlashCommandBuilder()
    .setName('용호')
    .setDescription('🐉 용 vs 🐯 호 ! 승자를 예측해라!')
    .addStringOption(o =>
      o.setName('선택')
       .setDescription('dragon / tiger / tie')
       .setRequired(true))
    .addIntegerOption(o =>
      o.setName('베팅')
       .setDescription('베팅할 금액')
       .setRequired(true)),

  new SlashCommandBuilder()
    .setName('바카라')
    .setDescription('🎴 바카라 게임 플레이')
    .addStringOption(o =>
      o.setName('선택')
       .setDescription('player / banker / tie')
       .setRequired(true))
    .addIntegerOption(o =>
      o.setName('베팅')
       .setDescription('베팅 금액')
       .setRequired(true)),

  new SlashCommandBuilder()
    .setName('슬롯')
    .setDescription('🎰 슬롯머신 실행')
    .addIntegerOption(o =>
      o.setName('베팅')
       .setDescription('베팅 금액')
       .setRequired(true)),

  new SlashCommandBuilder()
    .setName('룰렛')
    .setDescription('🎡 룰렛 게임 (red/black/odd/even/숫자)')
    .addStringOption(o =>
      o.setName('선택')
       .setDescription('배팅 타입(red/black/odd/even/숫자)')
       .setRequired(true))
    .addIntegerOption(o =>
      o.setName('베팅')
       .setDescription('베팅 금액')
       .setRequired(true)),

  new SlashCommandBuilder()
    .setName('뽑기')
    .setDescription('🎁 5,000,000원으로 뽑기 진행'),



  // ========================================
  // 💊 마약 시스템
  // ========================================

  new SlashCommandBuilder()
    .setName('시세')
    .setDescription('현재 마약 시세를 확인합니다.'),

  new SlashCommandBuilder()
    .setName('마약구매')
    .setDescription('마약을 구매합니다.')
    .addIntegerOption(o =>
      o.setName('수량')
       .setDescription('구매할 개수')
       .setRequired(true)),

  new SlashCommandBuilder()
    .setName('마약판매')
    .setDescription('마약을 판매합니다.')
    .addIntegerOption(o =>
      o.setName('수량')
       .setDescription('판매할 개수')
       .setRequired(true)),



  // ========================================
  // 📈 주식 시스템 (6종목)
  // ========================================

  new SlashCommandBuilder()
    .setName('주식')
    .setDescription('전체 주식 시세를 확인합니다.'),

  new SlashCommandBuilder()
    .setName('주식구매')
    .setDescription('주식을 구매합니다.')
    .addStringOption(o =>
      o.setName('종목')
       .setDescription('종목명 또는 번호(1~6) 입력')
       .setRequired(true))
    .addIntegerOption(o =>
      o.setName('수량')
       .setDescription('구매할 수량')
       .setRequired(true)),

  new SlashCommandBuilder()
    .setName('주식판매')
    .setDescription('보유한 주식을 판매합니다.')
    .addStringOption(o =>
      o.setName('종목')
       .setDescription('종목명 또는 번호(1~6) 입력')
       .setRequired(true))
    .addIntegerOption(o =>
      o.setName('수량')
       .setDescription('판매할 수량')
       .setRequired(true)),



  // ========================================
  // 📰 뉴스 시스템
  // ========================================

  new SlashCommandBuilder()
    .setName('뉴스')
    .setDescription('최근 발생한 경제 뉴스(급등/폭락)를 확인합니다.'),



  // ========================================
  // 🔧 관리자 명령어
  // ========================================

  new SlashCommandBuilder()
    .setName('전체회수')
    .setDescription('[관리자] 모든 유저 잔액을 0원으로 초기화'),

  new SlashCommandBuilder()
    .setName('전체지급')
    .setDescription('[관리자] 모든 유저에게 동일 금액 지급')
    .addIntegerOption(o =>
      o.setName('금액')
       .setDescription('지급할 금액')
       .setRequired(true)),

  new SlashCommandBuilder()
    .setName('돈회수')
    .setDescription('[관리자] 특정 유저의 돈을 회수')
    .addUserOption(o =>
      o.setName('대상')
       .setDescription('회수할 유저')
       .setRequired(true))
    .addIntegerOption(o =>
      o.setName('금액')
       .setDescription('회수할 금액')
       .setRequired(true)),

  new SlashCommandBuilder()
    .setName('돈지급')
    .setDescription('[관리자] 특정 유저에게 돈을 지급')
    .addUserOption(o =>
      o.setName('대상')
       .setDescription('지급할 유저')
       .setRequired(true))
    .addIntegerOption(o =>
      o.setName('금액')
       .setDescription('지급할 금액')
       .setRequired(true))

].map(cmd => cmd.toJSON());



// =========================================================
// 🚀 슬래시 명령어 등록 실행
// =========================================================

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🔄 슬래시 명령어 등록 중...');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('✅ 슬래시 명령어 등록 완료!');
  } catch (err) {
    console.error('❌ 등록 실패:', err);
  }
})();
