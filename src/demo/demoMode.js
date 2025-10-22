const ADMIN_USER = {

  username: 'admin',

  role: 'admin',

  name: 'Quản trị viên',

  permissions: {},

}



function createResponse(payload) {

  return new Response(JSON.stringify(payload), {

    status: 200,

    headers: { 'Content-Type': 'application/json' },

  })

}



function buildBootstrapStore() {

  const baseDate = new Date('2024-09-01T08:00:00.000Z')

  const companies = [

    { mst: '0101234567', name: 'Công ty Ánh Dương' },

    { mst: '0207654321', name: 'Công ty Bình Minh' },

    { mst: '0304567890', name: 'Công ty Delta' },

    { mst: '0401122334', name: 'Công ty Sao Mai' },

  ]

  const teams = [

    { team: 'Nhập 1', staff: 'Lan' },

    { team: 'Nhập 2', staff: 'Minh' },

    { team: 'Kiểm hóa', staff: 'Phúc' },

    { team: 'Hỗ trợ', staff: 'Hoa' },

    { team: 'Thuế', staff: 'Tùng' },

    { team: 'Tư vấn', staff: 'Trang' },

  ]

  const licenseSets = [

    ['ZB02'],

    ['ZB03'],

    ['ZB02', 'ZB03'],

    ['ZC01'],

  ]

  const declarations = []

  for (let index = 0; index < 24; index += 1) {

    const entryDate = new Date(baseDate.getTime())

    entryDate.setDate(baseDate.getDate() + index)

    const { mst, name: company } = companies[index % companies.length]

    const { team, staff } = teams[index % teams.length]

    const licenseCodes = licenseSets[index % licenseSets.length]

    const hasCO = index % 2 === 0

    declarations.push({

      date: entryDate.toISOString().slice(0, 10),

      raw_date: entryDate.toLocaleDateString('vi-VN'),

      so_tk: `10${String(index + 1).padStart(9, '0')}`,

      so_tk_full: `10${String(index + 1).padStart(9, '0')}`,

      loai_hinh: ['E11', 'E15', 'B13', 'A11'][index % 4],

      team,

      nhan_vien: staff,

      staff,

      num_items: 5 + (index % 6),

      muc_hang: 5 + (index % 6),

      mst,

      cong_ty: company,

      customer: company,

      agency: index % 3 === 0 ? 'Excel' : 'ECUS',

      dai_ly: index % 3 === 0 ? 'Excel' : 'ECUS',

      licenses: licenseCodes.length,

      so_luong_gp: licenseCodes.length,

      licenseCodes,

      has_co: hasCO,

      co: hasCO ? 'Có' : 'Không',

      co_line_count: hasCO ? 1 + (index % 3) : 0,

      isExport: index % 5 === 0,

      updatedAt: new Date(entryDate.getTime() + 3 * 60 * 60 * 1000).toISOString(),

      kpi: Math.round((3.5 + (index % 4) * 0.8) * 10) / 10,

    })

  }



  const roster = {

    version: 2,

    teams: [

      {

        id: 'nhap-khau',

        name: 'Nhập khẩu',

        members: teams.map(({ staff }, idx) => ({ id: `nv-${idx}`, name: staff })),

      },

    ],

  }



  const bootstrapStore = {

    decl_rows_v1: JSON.stringify(declarations),

    mst_rows_v2: '[]',

    mst_history_v1: '[]',

    kpi_rules_v2: JSON.stringify({ version: 1, points: { base: 1, export: 1.2 } }),

    kpi_adjustments_v1: '[]',

    team_roster_v1: JSON.stringify(roster),

    audit_logs_v1: '[]',

    import_logs_v1: '[]',

    hq_agencies_v1: '[]',

    hq_history_v1: '[]',

    ecus_sync_config_v1: JSON.stringify({

      enabled: false,

      schedule: '0 3 * * *',

      schedulePreset: 'daily',

      rangeDays: 1,

    }),

    decl_alert_config_v1: JSON.stringify({ enabled: true, thresholdDays: 2, autoResolveReviewed: true, channel: 'audit' }),

    decl_alert_state_v1: JSON.stringify({ entries: {}, lastEvaluatedAt: null }),

    kpi_users_v1: JSON.stringify([{ username: 'admin', role: 'admin', name: 'Quản trị viên', permissions: {} }]),

    db_backup_config_v1: JSON.stringify({ cron: '0 3 * * *', retentionCopies: 14 }),

    co_tax_code_config_v1: JSON.stringify({

      version: 1,

      whitelist: [],

      blacklist: ['B01', 'B03', 'B30', 'B02'],

      updatedAt: null,

      updatedBy: null,

    }),

    co_discrepancy_config_v1: JSON.stringify({

      enabled: false,

      cron: '30 4 * * *',

      rangeDays: 3,

      threshold: 10,

      sampleLimit: 500,

    }),

    duplicate_policy_config_v1: JSON.stringify({

      autoNotifyAfterDays: 7,

      notifyCooldownHours: 24,

      evaluationWindowDays: 14,

      autoLockEnabled: true,

      autoLockAfterGroups: 12,

      minGroupSizeForLock: 2,

      autoUnlockAfterDays: 3,

    }),

    duplicate_policy_state_v1: JSON.stringify({ lastEvaluatedAt: null, notifiedGroups: {}, lockedSources: {} }),

    co_discrepancy_state_v1: JSON.stringify({ lastRunAt: null, status: 'idle' }),

    ai_provider_config_v1: JSON.stringify({

      provider: 'azure',

      temperature: 0.2,

      maxTokens: 800,

      timeoutMs: 20000,

      caching: { enabled: true, ttlMinutes: 30, maxEntries: 50 },

    }),

    ai_usage_cache_v1: JSON.stringify({ entries: [], updatedAt: null }),

  }



  return bootstrapStore

}



function buildDataHealthSummary(totalDeclarations) {

  const now = new Date('2024-09-12T08:00:00.000Z')

  return {

    ok: true,

    summary: {

      totals: {

        declarations: totalDeclarations,

        duplicateGroups: 1,

        duplicateRows: 2,

        duplicatesAwaiting: 1,

        duplicatesPendingReview: 1,

        duplicatesLocked: 0,

        alertsOutstanding: 2,

      },

      duplicates: {

        groups: [

          {

            key: 'grp-10000000001',

            prefix: '10000000001',

            total: 2,

            branch: 'Chi nhánh Hà Nội',

            keep: {

              so_tk: '10000000001',

              so_tk_full: '10000000001',

              updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),

            },

            duplicates: [

              {

                so_tk: '10000000001',

                so_tk_full: '10000000001',

                staff: 'Lan',

                team: 'Nhập 1',

                updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),

              },

              {

                so_tk: '10000000001',

                so_tk_full: '10000000001',

                staff: 'Minh',

                team: 'Nhập 2',

                updatedAt: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(),

              },

            ],

          },

        ],

        policy: {

          lockedSources: [],

          lastEvaluatedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),

        },

        sourceBreakdown: [

          { source: 'ECUS5VNACCS', awaitingActionGroups: 1, pendingReviewGroups: 1, locked: false },

          { source: 'Import Excel', awaitingActionGroups: 0, pendingReviewGroups: 0, locked: false },

        ],

      },

      alerts: {

        recent: [

          {

            key: 'alert-1',

            so_tk: '10000000005',

            date: '2024-09-05',

            mst: '0101234567',

            company: 'Công ty Ánh Dương',

            missing: ['Thiếu CO', 'Thiếu giấy phép'],

            staff: 'Lan',

            team: 'Nhập 1',

            lastAlertAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),

          },

          {

            key: 'alert-2',

            so_tk: '10000000009',

            date: '2024-09-09',

            mst: '0207654321',

            company: 'Công ty Bình Minh',

            missing: ['Chưa gán nhân viên'],

            staff: '—',

            team: '—',

            lastAlertAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),

          },

        ],

        lastEvaluatedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),

        totalTracked: 5,

      },

      sqlServer: {

        timeoutEvents: [

          {

            at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),

            durationMs: 45000,

            query: 'Đồng bộ ECUS buổi sáng',

            status: 'timeout',

          },

        ],

      },

      sync: {

        lastRunAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),

        lastStatus: 'Thành công (mô phỏng)',

      },

      notifications: [

        {

          id: 'evt-1',

          type: 'duplicate',

          message: 'Nhóm trùng mới cần rà soát',

          createdAt: now.toISOString(),

        },

      ],

    },

  }

}



export async function enableDemoMode() {

  if (typeof window === 'undefined' || window.__kpiDemoMode) {

    return

  }

  window.__kpiDemoMode = true

  try {

    window.localStorage?.setItem('kpi_session_token', 'demo-token')

  } catch (err) {

    console.warn('Không thể lưu token demo vào localStorage', err)

  }



  const bootstrapStore = buildBootstrapStore()

  const dataHealthSummary = buildDataHealthSummary(JSON.parse(bootstrapStore.decl_rows_v1).length)

  const duplicatePolicy = {

    ok: true,

    config: JSON.parse(bootstrapStore.duplicate_policy_config_v1),

    state: {

      lastEvaluatedAt: dataHealthSummary.summary.duplicates.policy.lastEvaluatedAt,

      lockedSources: [],

    },

    summary: {

      sourceBreakdown: dataHealthSummary.summary.duplicates.sourceBreakdown,

      statusCounts: { awaitingAction: 1, pendingReview: 1, locked: 0 },

    },

  }

  const trainingResources = {

    resources: [

      {

        id: 'guide-1',

        title: 'Quy trình rà soát tờ khai trùng',

        category: 'duplicate',

        progress: 80,

        updatedAt: '2024-09-08T04:00:00.000Z',

      },

      {

        id: 'guide-2',

        title: 'Sử dụng dashboard KPI mới',

        category: 'kpi',

        progress: 55,

        updatedAt: '2024-09-06T06:00:00.000Z',

      },

    ],

  }

  const feedbackSummary = {

    summary: {

      total: 8,

      latestAt: '2024-09-11T09:00:00.000Z',

      averageRating: 4.6,

    },

  }

  const notificationHistory = {

    events: [

      {

        id: 'evt-1',

        type: 'duplicate',

        message: 'Có 1 nhóm trùng 11 số mới',

        createdAt: '2024-09-12T07:45:00.000Z',

      },

      {

        id: 'evt-2',

        type: 'alert',

        message: 'Tờ khai 10000000005 thiếu CO',

        createdAt: '2024-09-12T07:30:00.000Z',

      },

    ],

  }



  const responses = {

    login: { user: ADMIN_USER, token: 'demo-token' },

    session: { user: ADMIN_USER, token: 'demo-token' },

    accounts: { accounts: [ADMIN_USER] },

    bootstrap: { data: bootstrapStore },

    duplicatePolicy,

    dataHealth: dataHealthSummary,

    training: trainingResources,

    feedbackSummary,

    feedbackSubmit: { ok: true },

    aiConfig: JSON.parse(bootstrapStore.ai_provider_config_v1),

    aiCache: JSON.parse(bootstrapStore.ai_usage_cache_v1),

    aiHistory: { history: [] },

    aiChat: { messages: [{ role: 'assistant', content: 'Xin chào, tôi có thể giúp gì?' }] },

    aiProviderTest: {

      ok: true,

      provider: { id: 'demo-ai', label: 'Demo AI', type: 'google-ai-studio' },

      message: 'OK demo',

      usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 },

    },

    storageOk: { ok: true },

    notifications: notificationHistory,

  }



  const originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null



  window.fetch = async (input, init = {}) => {

    const url = typeof input === 'string' ? input : input?.url || ''

    const method = (init?.method || 'GET').toUpperCase()

    try {

      if (url.includes('/api/auth/login')) return createResponse(responses.login)

      if (url.includes('/api/auth/session')) return createResponse(responses.session)

      if (url.includes('/api/auth/accounts')) return createResponse(responses.accounts)

      if (url.includes('/api/bootstrap')) return createResponse(responses.bootstrap)

      if (url.includes('/api/duplicate-policy')) return createResponse(responses.duplicatePolicy)

      if (url.includes('/api/data-health/summary')) return createResponse(responses.dataHealth)

      if (url.includes('/api/training-resources')) return createResponse(responses.training)

      if (url.includes('/api/feedback/summary')) return createResponse(responses.feedbackSummary)

      if (url.includes('/api/feedback') && method === 'POST') return createResponse(responses.feedbackSubmit)

      if (url.includes('/api/ai/config')) return createResponse(responses.aiConfig)

      if (url.includes('/api/ai/cache')) return createResponse(responses.aiCache)

      if (url.includes('/api/ai/history')) return createResponse(responses.aiHistory)

      if (url.includes('/api/ai/chat')) return createResponse(responses.aiChat)

      if (url.includes('/api/ai/providers/test')) return createResponse(responses.aiProviderTest)

      if (url.includes('/api/storage/')) return createResponse(responses.storageOk)

      if (url.includes('/api/notifications')) return createResponse(responses.notifications)

    } catch (error) {

      console.warn('Demo mode intercept fetch error', error)

      if (originalFetch) {

        return originalFetch(input, init)

      }

    }

    if (originalFetch) {

      return originalFetch(input, init)

    }

    return createResponse({ ok: true })

  }



  class DemoEventSource {

    constructor(url) {

      this.url = url

      this.readyState = 1

      this.onopen = null

      this.onmessage = null

      this.onerror = null

      setTimeout(() => {

        if (typeof this.onopen === 'function') {

          this.onopen({})

        }

        if (typeof this.onmessage === 'function') {

          this.onmessage({ data: JSON.stringify(responses.notifications.events[0]) })

        }

      }, 500)

    }



    addEventListener(type, listener) {

      if (type === 'message' && typeof listener === 'function') {

        setTimeout(() => listener({ data: JSON.stringify(responses.notifications.events[1]) }), 1500)

      }

    }



    close() {

      this.readyState = 2

    }

  }



  window.EventSource = DemoEventSource

}

