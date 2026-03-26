import { useCallback, useMemo, useState } from "react";

import { computeKPI } from "@/lib/rules.js";

export default function useRulesTestWorkspace({ data = [], rule = null }) {
  const testList = useMemo(() => {
    return data.map((row, index) => {
      const soTkRaw = row?.so_tk ?? row?.soToKhai ?? row?.soTK ?? row?.so_to_khai ?? "";
      const soTk = soTkRaw ? String(soTkRaw).trim() : "";
      const date = row?.date || row?.ngay || "";
      const company = row?.cong_ty || row?.company || row?.customer || "";
      const mst = row?.mst || "";
      const loai = row?.loai_hinh || row?.loaiHinh || "";

      const label =
        [date, soTk, mst, company, loai].filter(Boolean).join(" | ") || `Tờ khai ${index + 1}`;

      return {
        key: `${index}-${soTk}-${date}`,
        soTk,
        label,
        labelLower: label.toLowerCase(),
        soTkLower: soTk.toLowerCase(),
        row,
      };
    });
  }, [data]);

  const [testSearch, setTestSearch] = useState("");
  const [pickedKey, setPickedKey] = useState("");

  const filteredTestList = useMemo(() => {
    const keyword = testSearch.trim().toLowerCase();
    const base = keyword
      ? testList.filter(
          (item) => item.soTkLower.includes(keyword) || item.labelLower.includes(keyword)
        )
      : testList;

    return base.slice(0, 400);
  }, [testList, testSearch]);

  const firstMatch = useMemo(() => {
    const keyword = testSearch.trim().toLowerCase();
    if (!keyword) return null;

    return testList.find((item) => item.soTkLower.includes(keyword)) || null;
  }, [testList, testSearch]);

  const handleSearchSubmit = useCallback(
    (event) => {
      event.preventDefault();

      if (firstMatch) {
        setPickedKey(firstMatch.key);
      } else if (testSearch.trim()) {
        alert("Không tìm thấy tờ khai khớp với số đã nhập.");
      }
    },
    [firstMatch, testSearch]
  );

  const pickedEntry = useMemo(
    () => testList.find((item) => item.key === pickedKey) || null,
    [testList, pickedKey]
  );

  const pickedRow = pickedEntry?.row || null;
  const kpiPicked = pickedRow ? computeKPI(pickedRow, rule) : 0;

  const [manualType, setManualType] = useState("A11");
  const [manualItems, setManualItems] = useState(10);
  const [manualLicenses, setManualLicenses] = useState("ZB02,ZB03");
  const [manualAgency, setManualAgency] = useState("G&B");
  const [manualHasCO, setManualHasCO] = useState(true);
  const [manualCoLines, setManualCoLines] = useState(0);

  const manualRow = useMemo(() => {
    const codes = manualLicenses
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);

    const coLines = Number(manualCoLines || 0);
    const hasCOFlag = manualHasCO || coLines > 0;

    return {
      loaiHinh: manualType,
      num_items: Number(manualItems || 0),
      licenseCodes: codes,
      agency: manualAgency,
      has_co: hasCOFlag,
      co: hasCOFlag ? "Có" : "",
      co_line_count: coLines,
    };
  }, [manualAgency, manualCoLines, manualHasCO, manualItems, manualLicenses, manualType]);

  const kpiManual = computeKPI(manualRow, rule);

  return {
    filteredTestList,
    handleSearchSubmit,
    kpiManual,
    kpiPicked,
    manualAgency,
    manualCoLines,
    manualHasCO,
    manualItems,
    manualLicenses,
    manualRow,
    manualType,
    pickedEntry,
    pickedKey,
    pickedRow,
    setManualAgency,
    setManualCoLines,
    setManualHasCO,
    setManualItems,
    setManualLicenses,
    setManualType,
    setPickedKey,
    setTestSearch,
    testList,
    testSearch,
  };
}
