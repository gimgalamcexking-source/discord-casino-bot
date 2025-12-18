// deploy-commands.js (discord.js v14)
// 슬래시 커맨드 등록 스크립트
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ .env에 TOKEN / CLIENT_ID / GUILD_ID가 필요합니다.');
  process.exit(1);
}

const commands = [
  // ======================
  // 기본
  // ======================
  new SlashCommandBuilder()
    .setName('돈')
    .setDescription('현재 잔액을 확인합니다'),

  // ======================
  // 카지노
  // ======================
  new SlashCommandBuilder()
    .setName('바카라')
    .setDescription('바카라 게임')
    .addIntegerOption(o =>
      o.setName('베팅').setDescription('베팅 금액').setRequired(true).setMinValue(1)
    )
    .addStringOption(o =>
      o.setName('선택')
        .setDescription('player / banker / tie')
        .setRequired(true)
        .addChoices(
          { name: '플레이어(player)', value: 'player' },
          { name: '뱅커(banker)', value: 'banker' },
          { name: '타이(tie)', value: 'tie' }
        )
    ),

  new SlashCommandBuilder()
    .setName('용호')
    .setDescription('용호(Dragon Tiger) 게임')
    .addIntegerOption(o =>
      o.setName('베팅').setDescription('베팅 금액').setRequired(true).setMinValue(1)
    )
    .addStringOption(o =>
      o.setName('선택')
        .setDescription('dragon / tiger / tie')
        .setRequired(true)
        .addChoices(
          { name: '드래곤(dragon)', value: 'dragon' },
          { name: '타이거(tiger)', value: 'tiger' },
          { name: '타이(tie)', value: 'tie' }
        )
    ),

  new SlashCommandBuilder()
    .setName('룰렛')
    .setDescription('룰렛 게임')
    .addIntegerOption(o =>
      o.setName('베팅').setDescription('베팅 금액').setRequired(true).setMinValue(1)
    )
    .addStringOption(o =>
      o.setName('선택')
        .setDescription('red/black/odd/even 또는 0~36 숫자')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('슬롯')
    .setDescription('슬롯 게임')
    .addIntegerOption(o =>
      o.setName('베팅').setDescription('베팅 금액').setRequired(true).setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName('뽑기')
    .setDescription('500만원으로 뽑기를 합니다'),

  // ======================
  // 주식
  // ======================
  new SlashCommandBuilder()
    .setName('주식')
    .setDescription('주식 시세를 확인합니다'),

  new SlashCommandBuilder()
    .setName('주식시세')
    .setDescription('주식 시세를 확인합니다'),

  new SlashCommandBuilder()
    .setName('내주식')
    .setDescription('내 주식 포트폴리오를 확인합니다'),

  new SlashCommandBuilder()
    .setName('주식구매')
    .setDescription('주식을 구매합니다')
    .addStringOption(o =>
      o.setName('종목')
        .setDescription('1~6 또는 종목명(예: 유리방산)')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('수량')
        .setDescription('구매할 주 수')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000000)
    ),

  new SlashCommandBuilder()
    .setName('주식판매')
    .setDescription('주식을 판매합니다')
    .addStringOption(o =>
      o.setName('종목')
        .setDescription('1~6 또는 종목명(예: 유리방산)')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('수량')
        .setDescription('판매할 주 수')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000000)
    ),

  // ======================
  // 뉴스 / 랭킹 / 송금
  // ======================
  new SlashCommandBuilder()
    .setName('뉴스')
    .setDescription('최근 경제 뉴스를 확인합니다'),

  new SlashCommandBuilder()
    .setName('랭킹')
    .setDescription('경제 랭킹 TOP 10을 확인합니다'),

  new SlashCommandBuilder()
    .setName('경제랭킹')
    .setDescription('경제 랭킹 TOP 10을 확인합니다'),

  new SlashCommandBuilder()
    .setName('송금')
    .setDescription('다른 유저에게 돈을 송금합니다')
    .addUserOption(o =>
      o.setName('대상').setDescription('송금 받을 유저').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('금액').setDescription('송금 금액').setRequired(true).setMinValue(1)
    ),

  // ======================
  // 관리자
  // ======================
  new SlashCommandBuilder()
    .setName('전체회수')
    .setDescription('[관리자] 모든 유저 돈을 0원으로 초기화')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('전체지급')
    .setDescription('[관리자] 모든 유저에게 돈 지급')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o =>
      o.setName('금액').setDescription('지급 금액').setRequired(true).setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName('돈회수')
    .setDescription('[관리자] 특정 유저 돈 회수')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName('대상').setDescription('회수 대상').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('금액').setDescription('회수 금액').setRequired(true).setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName('돈지급')
    .setDescription('[관리자] 특정 유저 돈 지급')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName('대상').setDescription('지급 대상').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('금액').setDescription('지급 금액').setRequired(true).setMinValue(1)
    ),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('⏳ 슬래시 명령어 등록 중...');

    // 길드(테스트) 등록: 바로 반영됨
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    // 전역 등록(반영까지 오래 걸림) 원하면 위 줄 대신 아래를 사용:
    // await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

    console.log('✅ 슬래시 명령어 등록 완료!');
  } catch (err) {
    console.error('❌ 등록 실패:', err);
  }
})();
