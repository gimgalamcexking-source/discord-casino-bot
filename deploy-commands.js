// =============================================================
// deploy-commands.js (최신 Discord API 규격 / index.js 완전 호환)
// =============================================================
require('dotenv').config();

const { 
  SlashCommandBuilder, 
  Routes 
} = require('discord.js');

const { REST } = require('@discordjs/rest');

// -------------------------------------------------------------
// 환경 변수
// -------------------------------------------------------------
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// -------------------------------------------------------------
// 명령어 목록 (index.js에 존재하는 모든 명령어 자동 정리)
// -------------------------------------------------------------
const commands = [

  // 💰 잔액 확인
  new SlashCommandBuilder()
    .setName('돈')
    .setDescription('현재 보유 금액을 확인합니다.'),

  // 🐉 용호
  new SlashCommandBuilder()
    .setName('용호')
    .setDescription('용호 게임을 진행합니다.')
    .addIntegerOption(opt =>
      opt.setName('베팅')
        .setDescription('베팅 금액')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('선택')
        .setDescription('dragon / tiger / tie (용 / 호 / 무 가능)')
        .setRequired(true)),

  // 🎴 바카라
  new SlashCommandBuilder()
    .setName('바카라')
    .setDescription('바카라 게임을 진행합니다.')
    .addIntegerOption(opt =>
      opt.setName('베팅')
        .setDescription('베팅 금액')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('선택')
        .setDescription('player / banker / tie')
        .setRequired(true)),

  // 🎁 뽑기
  new SlashCommandBuilder()
    .setName('뽑기')
    .setDescription('뽑기를 진행합니다. (500만 원 소모)'),

  // 🎰 슬롯
  new SlashCommandBuilder()
    .setName('슬롯')
    .setDescription('슬롯머신 게임을 진행합니다.')
    .addIntegerOption(opt =>
      opt.setName('베팅')
        .setDescription('베팅 금액')
        .setRequired(true)),

  // 🎡 룰렛
  new SlashCommandBuilder()
    .setName('룰렛')
    .setDescription('룰렛 게임을 진행합니다.')
    .addIntegerOption(opt =>
      opt.setName('베팅')
        .setDescription('베팅 금액')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('선택')
        .setDescription('red/black/odd/even 또는 숫자(0~36)')
        .setRequired(true)),


  // 🔧 관리자명령 — 전체회수
  new SlashCommandBuilder()
    .setName('전체회수')
    .setDescription('[관리자] 모든 유저의 잔액을 0으로 초기화합니다.'),

  // 🔧 관리자명령 — 전체지급
  new SlashCommandBuilder()
    .setName('전체지급')
    .setDescription('[관리자] 모든 유저에게 금액을 지급합니다.')
    .addIntegerOption(opt =>
      opt.setName('금액')
        .setDescription('지급할 금액')
        .setRequired(true)),

  // 🔧 관리자명령 — 특정유저 돈 회수
  new SlashCommandBuilder()
    .setName('돈회수')
    .setDescription('[관리자] 특정 유저의 돈을 회수합니다.')
    .addUserOption(opt =>
      opt.setName('대상')
        .setDescription('회수 대상 사용자')
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('금액')
        .setDescription('회수할 금액')
        .setRequired(true)),

  // 🔧 관리자명령 — 특정유저 돈 지급
  new SlashCommandBuilder()
    .setName('돈지급')
    .setDescription('[관리자] 특정 유저에게 돈을 지급합니다.')
    .addUserOption(opt =>
      opt.setName('대상')
        .setDescription('지급 대상 사용자')
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('금액')
        .setDescription('지급할 금액')
        .setRequired(true)),
];


// -------------------------------------------------------------
// REST API로 전송
// -------------------------------------------------------------
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🔄 슬래시 명령어 등록 시작...');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log('✅ 슬래시 명령어 등록 완료!');
  } catch (error) {
    console.error('❌ 명령어 등록 오류:', error);
  }
})();
