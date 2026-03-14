import { beforeEach, describe, expect, it } from 'vitest';

import { seedSampleDeclarations } from '../packages/domain/src/sampleDeclarations.js';

import { mapRow } from '@/lib/importer.js';

import {

  DECL_KEY,

  HQ_KEY,

  MST_KEY,

  saveDeclRows,

  getDeclRows,

  upsertHQAgencies,

  upsertMSTRows,

  getMSTMap,

  getHQAgencies,

} from '@/lib/store.js';

import { clearStorageCache, setItem as setSharedItem } from '@/lib/storageClient.js';



function resetSharedStorage() {

  clearStorageCache();

  setSharedItem(DECL_KEY, JSON.stringify([]));

  setSharedItem(HQ_KEY, JSON.stringify([]));

  setSharedItem(MST_KEY, JSON.stringify([]));

}



describe('Tích hợp dữ liệu Đại lý HQ & import', () => {

  beforeEach(() => {

    resetSharedStorage();

  });



  it('đồng bộ lại dữ liệu tờ khai khi cập nhật bảng Đại lý HQ', () => {

    const samples = seedSampleDeclarations({ actor: 'integration-test', count: 8 });

    saveDeclRows(samples, { overwrite: true, actor: 'integration-test' });



    const target = samples.find((row) => row?.mst);

    expect(target).toBeTruthy();



    const updatedCount = upsertHQAgencies(

      [

        {

          mst: target.mst,

          company: 'CÔNG TY VÀNG ÁNH DƯƠNG',

          agent: 'DL GOLD',

        },

      ],

      { actor: 'admin' }

    );



    expect(updatedCount).toBe(1);



    const agencyRows = getHQAgencies();

    expect(agencyRows).toHaveLength(1);



    const stored = getDeclRows();

    const enriched = stored.find((row) => row.mst === target.mst);

    expect(enriched).toBeTruthy();

    expect(enriched).toMatchObject({

      cong_ty: 'CÔNG TY VÀNG ÁNH DƯƠNG',

      agency: 'DL, GOLD',

      dai_ly: 'DL, GOLD',

    });

  });



  it('import JSON tự động gán nhân viên và đại lý dựa trên bảng MST/HQ', () => {

    upsertMSTRows(

      [

        {

          mst: '0101234567',

          company: 'Công ty Cũ',

          person_import: 'Hạnh',

          person_export: 'Tuấn',

          team: 'Team 2',

          effective_from: '2024-01-01',

        },

      ],

      { actor: 'admin' }

    );



    const agencyMap = new Map([

      [

        '0101234567',

        {

          company: 'CÔNG TY GOLDEN',

          agent: 'FCL',

        },

      ],

    ]);



    const mapped = mapRow(

      {

        'Số tờ khai': '1024000000000',

        'Ngày': '05/09/2024',

        MST: '0101234567',

        'Loại hình': 'A11',

        'Mã giấy phép': 'ZN02',

        'Số giấy phép': '001',

        'Mã giấy phép 1': 'GP01',

        'Số giấy phép 1': '002',

        'Mã giấy phép 2': 'GP02',

        'Số giấy phép 2': '003',

      },

      { autoAssignStaff: true, agencyMap, licenseExcludes: ['ZN02'] }

    );



    expect(mapped).toMatchObject({

      mst: '0101234567',

      nhan_vien: 'Hạnh',

      team: 'Team 2',

      agency: 'FCL',

      dai_ly: 'FCL',

      cong_ty: 'CÔNG TY GOLDEN',

      licenses: 2,

      so_luong_gp: 2,

    });

    expect(mapped.licenseCodes).toEqual(['GP01', 'GP02']);

    expect(mapped.licenseSourceCodes).toEqual(['ZN02', 'GP01', 'GP02']);

  });



  it('saveDeclRows tự gắn công ty và đại lý theo bảng Đại lý HQ hiện hành', () => {

    upsertHQAgencies(

      [

        { mst: '0105556667', company: 'CÔNG TY THẾ GIỚI', agent: 'AIR' },

      ],

      { actor: 'admin' }

    );



    saveDeclRows(

      [

        {

          so_tk: '1024000000001',

          nhanh: '01',

          mst: '0105556667',

          cong_ty: '',

          agency: '',

        },

      ],

      { overwrite: true, actor: 'import-json' }

    );



    const stored = getDeclRows();

    expect(stored).toHaveLength(1);

    expect(stored[0]).toMatchObject({

      mst: '0105556667',

      cong_ty: 'CÔNG TY THẾ GIỚI',

      customer: 'CÔNG TY THẾ GIỚI',

      agency: 'AIR',

      dai_ly: 'AIR',

    });

  });



  it('Đại lý HQ mới sẽ đồng bộ lại tên công ty trong bảng MST', () => {

    upsertMSTRows(

      [

        {

          mst: '0107778889',

          company: 'Tên cũ',

          person_import: 'Lan',

          person_export: 'Huy',

          team: 'Team 1',

          effective_from: '2024-01-01',

        },

      ],

      { actor: 'seed' }

    );



    upsertHQAgencies(

      [

        {

          mst: '0107778889',

          company: 'CÔNG TY SAO MAI',

          agent: 'FCL',

        },

      ],

      { actor: 'admin' }

    );



    const mstRows = getMSTMap();

    expect(mstRows).toEqual([

      {

        mst: '0107778889',

        company: 'CÔNG TY SAO MAI',

        person_import: 'Lan',

        person_export: 'Huy',

        team: 'Team 1',

        effective_from: '2024-01-01',

        effective_to: '',

        status: 'Đã gán nhân viên',

      },

    ]);

  });

});

