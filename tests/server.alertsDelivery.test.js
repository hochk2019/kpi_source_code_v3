/* eslint-env node */

/* @vitest-environment node */

import { describe, it, expect, beforeEach, vi } from 'vitest';



const sendMailMock = vi.fn();

const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));



vi.mock('nodemailer', () => ({

  default: { createTransport: createTransportMock },

  createTransport: createTransportMock,

}), { virtual: true });



let resolveSeverity;

let buildPlainText;

let normalizeTeamsText;

let getEmailConfig;

let getTeamsConfig;

let sendEmail;

let sendTeams;

let __internal;



async function loadModule() {

  const mod = await import('@kpi/backend-shared/runtime');

  resolveSeverity = mod.resolveSeverity;

  buildPlainText = mod.buildPlainText;

  normalizeTeamsText = mod.normalizeTeamsText;

  getEmailConfig = mod.getEmailConfig;

  getTeamsConfig = mod.getTeamsConfig;

  sendEmail = mod.sendEmail;

  sendTeams = mod.sendTeams;

  __internal = mod.__internal;

}



beforeEach(async () => {

  vi.resetModules();

  sendMailMock.mockReset();

  createTransportMock.mockReset();

  createTransportMock.mockImplementation(() => ({ sendMail: sendMailMock }));

  await loadModule();

});



describe('resolveSeverity', () => {

  it('chuẩn hóa giá trị severity về nhóm chuẩn', () => {

    expect(resolveSeverity('CRITICAL')).toBe('error');

    expect(resolveSeverity('warn')).toBe('warning');

    expect(resolveSeverity('ok')).toBe('success');

    expect(resolveSeverity('INFO')).toBe('info');

    expect(resolveSeverity('không rõ')).toBe('info');

    expect(resolveSeverity(undefined)).toBe('info');

  });

});



describe('buildPlainText', () => {

  it('kết hợp đầy đủ tiêu đề, tóm tắt và danh sách tờ khai', () => {

    const text = buildPlainText({

      severity: 'warning',

      title: 'Phát hiện tờ khai thiếu thông tin',

      message: 'Có 2 tờ khai chưa được gán nhân viên/phụ trách.',

      summary: {

        outstanding: 2,

        totalTracked: 5,

        lastEvaluatedAt: '2025-03-01T10:00:00Z',

      },

      alerts: [

        {

          so_tk: '1020304050',

          company: 'Công Ty ABC',

          mst: '0100123456',

          missing: ['nhân viên', 'tổ đội'],

        },

        {

          so_tk: '9080706050',

          company: 'Công Ty XYZ',

          missing: ['nhân viên'],

          team: 'Team Xuất khẩu',

          staff: 'Nguyễn Hà',

        },

      ],

      meta: {

        reason: 'auto',

        actor: 'system',

      },

    });



    expect(text).toContain('[WARNING] Phát hiện tờ khai thiếu thông tin');

    expect(text).toContain('Có 2 tờ khai chưa được gán nhân viên/phụ trách.');

    expect(text).toContain('Tồn đọng: 2');

    expect(text).toContain('- 1020304050 - Công Ty ABC thiếu nhân viên, tổ đội');

    expect(text).toContain('Phân công: Team Xuất khẩu / Nguyễn Hà');

    expect(text).toContain('- reason: auto');

  });

});



describe('normalizeTeamsText', () => {

  it('chuẩn hóa bullet và escape ký tự đặc biệt cho Teams Markdown', () => {

    const normalized = normalizeTeamsText(`Dòng mở đầu\n• Gạch đầu dòng & đặc biệt <>&\n· Bullet phụ`);

    expect(normalized).toContain('- Gạch đầu dòng &amp; đặc biệt &lt;&gt;&amp;');

    expect(normalized).toContain('- Bullet phụ');

  });

});



describe('getEmailConfig', () => {

  it('ưu tiên cấu hình ECUS_ALERT và chuẩn hóa danh sách người nhận', () => {

    const config = getEmailConfig({

      ECUS_ALERT_EMAIL_HOST: 'smtp.example.com',

      ECUS_ALERT_EMAIL_PORT: '465',

      ECUS_ALERT_EMAIL_SECURE: 'true',

      ECUS_ALERT_EMAIL_USER: 'alert',

      ECUS_ALERT_EMAIL_PASS: 'secret',

      ECUS_ALERT_EMAIL_FROM: 'ecus-alert@example.com',

      ECUS_ALERT_EMAIL_TO: 'ops@example.com, lead@example.com',

      ECUS_ALERT_EMAIL_CC: 'manager@example.com; qa@example.com',

      ECUS_ALERT_EMAIL_BCC: 'ceo@example.com',

      ECUS_ALERT_EMAIL_REPLY_TO: 'noreply@example.com',

      ECUS_ALERT_EMAIL_SUBJECT_PREFIX: '[ECUS] ',

    });



    expect(config).not.toBeNull();

    expect(config.source).toBe('ECUS_ALERT');

    expect(config.transport).toMatchObject({

      host: 'smtp.example.com',

      port: 465,

      secure: true,

      auth: { user: 'alert', pass: 'secret' },

    });

    expect(config.defaults.to).toEqual(['ops@example.com', 'lead@example.com']);

    expect(config.defaults.cc).toEqual(['manager@example.com', 'qa@example.com']);

    expect(config.defaults.bcc).toEqual(['ceo@example.com']);

    expect(config.defaults.replyTo).toBe('noreply@example.com');

    expect(config.defaults.subjectPrefix).toBe('[ECUS]');

  });



  it('fallback sang KPI_ALERT khi thiếu ECUS_ALERT', () => {

    const config = getEmailConfig({

      KPI_ALERT_EMAIL_HOST: 'smtp.kpi.local',

      KPI_ALERT_EMAIL_FROM: 'kpi-alert@example.com',

      KPI_ALERT_EMAIL_TO: 'ops@example.com',

    });

    expect(config).not.toBeNull();

    expect(config.source).toBe('KPI_ALERT');

    expect(config.transport.host).toBe('smtp.kpi.local');

  });



  it('trả về null khi thiếu host/from/to', () => {

    expect(getEmailConfig({})).toBeNull();

    expect(

      getEmailConfig({

        ECUS_ALERT_EMAIL_HOST: 'smtp.example.com',

        ECUS_ALERT_EMAIL_FROM: 'alert@example.com',

      }),

    ).toBeNull();

  });

});



describe('getTeamsConfig', () => {

  it('đọc cấu hình webhook và danh sách mentions', () => {

    const config = getTeamsConfig({

      ECUS_ALERT_TEAMS_WEBHOOK: 'https://teams.example.com/webhook',

      ECUS_ALERT_TEAMS_MENTIONS: 'ops-team,lead-team',

      ECUS_ALERT_TEAMS_CHANNEL: 'Cảnh báo ECUS',

    });

    expect(config).toEqual({

      webhook: 'https://teams.example.com/webhook',

      mentions: ['ops-team', 'lead-team'],

      channel: 'Cảnh báo ECUS',

      source: 'ECUS_ALERT',

    });

  });



  it('fallback sang KPI_ALERT', () => {

    const config = getTeamsConfig({

      KPI_ALERT_TEAMS_WEBHOOK: 'https://teams.example.com/kpi',

    });

    expect(config).not.toBeNull();

    expect(config.source).toBe('KPI_ALERT');

  });



  it('trả về null nếu không có webhook', () => {

    expect(getTeamsConfig({})).toBeNull();

  });

});



describe('sendEmail', () => {

  const sampleEvent = {

    severity: 'error',

    title: 'Tồn đọng cảnh báo ECUS',

    message: 'Có 3 tờ khai thiếu thông tin cần xử lý.',

    summary: { outstanding: 3, totalTracked: 10, lastEvaluatedAt: '2025-03-02T01:00:00Z' },

    alerts: [

      { so_tk: '111', company: 'Công Ty A', missing: ['nhân viên'] },

      { so_tk: '222', company: 'Công Ty B', missing: ['tổ đội'] },

    ],

    link: 'https://kpi.local/alerts',

  };



  it('gửi email với subject/text/html đầy đủ', async () => {

    sendMailMock.mockResolvedValue({ messageId: 'mocked' });



    const env = {

      ECUS_ALERT_EMAIL_HOST: 'smtp.example.com',

      ECUS_ALERT_EMAIL_FROM: 'alert@example.com',

      ECUS_ALERT_EMAIL_TO: 'ops@example.com, lead@example.com',

      ECUS_ALERT_EMAIL_CC: 'manager@example.com',

      ECUS_ALERT_EMAIL_BCC: 'ceo@example.com',

    };



    const result = await sendEmail(sampleEvent, env);



    expect(result.ok).toBe(true);

    expect(createTransportMock).toHaveBeenCalledWith({ host: 'smtp.example.com', port: 587, secure: false });

    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const payload = sendMailMock.mock.calls[0][0];

    expect(payload.to).toBe('ops@example.com, lead@example.com');

    expect(payload.cc).toBe('manager@example.com');

    expect(payload.bcc).toBe('ceo@example.com');

    expect(payload.subject).toContain('[ERROR]');

    expect(payload.text).toContain('Có 3 tờ khai thiếu thông tin cần xử lý.');

    expect(payload.html).toContain('<p>');

  });



  it('trả về missing-config khi thiếu thông tin email', async () => {

    const result = await sendEmail(sampleEvent, {});

    expect(result).toEqual({ ok: false, reason: 'missing-config' });

    expect(createTransportMock).not.toHaveBeenCalled();

  });

});



describe('sendTeams', () => {

  const sampleEvent = {

    severity: 'warning',

    title: 'Cảnh báo tồn đọng ECUS',

    message: 'Còn 2 tờ khai chưa được phân công.',

    summary: { outstanding: 2, totalTracked: 6, lastEvaluatedAt: '2025-03-02T02:00:00Z' },

    alerts: [

      { so_tk: '333', company: 'Công Ty C', missing: ['nhân viên'] },

    ],

    link: 'https://kpi.local/alerts',

  };



  it('gửi payload MessageCard hợp lệ tới webhook Teams', async () => {

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const env = {

      ECUS_ALERT_TEAMS_WEBHOOK: 'https://teams.example.com/webhook',

      ECUS_ALERT_TEAMS_MENTIONS: 'ops-team,lead-team',

    };



    const result = await sendTeams(sampleEvent, env, fetchMock);



    expect(result).toEqual({ ok: true, status: 200 });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe('https://teams.example.com/webhook');

    expect(options.method).toBe('POST');

    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);

    expect(body.themeColor).toBeDefined();

    expect(body.text).toContain('- 333');

    expect(body.text).toContain('@ops-team');

    expect(body.summary).toBe('Cảnh báo tồn đọng ECUS');

    expect(body.potentialAction[0].targets[0].uri).toBe(sampleEvent.link);

  });



  it('trả về missing-config khi thiếu webhook hoặc fetch', async () => {

    const result = await sendTeams(sampleEvent, {}, undefined);

    expect(result).toEqual({ ok: false, reason: 'missing-config' });

  });

});



it('các hàm nội bộ parseRecipients loại bỏ trùng lặp và khoảng trắng', () => {

  const recipients = __internal.parseRecipients(' a@example.com ;b@example.com\nA@example.com ');

  expect(recipients).toEqual(['a@example.com', 'b@example.com']);

});

