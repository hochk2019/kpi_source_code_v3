import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import CompanyNameCell from "@/components/mst-assignment/table/CompanyNameCell.jsx";
import {
  COMPANY_NAME_WRAP_THRESHOLD,
  shouldWrapCompanyName,
  sanitizeCompanyNameInput,
} from "@/components/mst-assignment/model/companyName.js";

afterEach(() => {
  cleanup();
});

describe("shouldWrapCompanyName", () => {
  it("trả về false cho chuỗi ngắn hơn ngưỡng", () => {
    const sample = "Công ty Ánh Dương";
    expect(sample.length).toBeLessThan(COMPANY_NAME_WRAP_THRESHOLD);
    expect(shouldWrapCompanyName(sample)).toBe(false);
  });

  it("trả về true cho chuỗi Unicode dài", () => {
    const longName = "Công ty cổ phần giải pháp logistics quốc tế Việt Nam";
    expect(shouldWrapCompanyName(longName)).toBe(true);
  });
});

describe("sanitizeCompanyNameInput", () => {
  it("thay thế xuống dòng bằng khoảng trắng", () => {
    const input = "Công ty\nXuất Nhập Khẩu\rViệt";
    expect(sanitizeCompanyNameInput(input)).toBe("Công ty Xuất Nhập Khẩu Việt");
  });

  it("chuyển đổi giá trị null thành chuỗi rỗng", () => {
    expect(sanitizeCompanyNameInput(null)).toBe("");
  });
});

describe("CompanyNameCell", () => {
  it("hiển thị span với data-company-wrap=wrapped cho tên dài ở chế độ xem", () => {
    const longName = "Công ty cổ phần giải pháp logistics quốc tế Việt Nam";
    render(<CompanyNameCell value={longName} isReadOnly onChange={() => {}} />);
    const display = screen.getByText(longName);
    expect(display).toHaveAttribute("data-company-wrap", "wrapped");
  });

  it("lọc ký tự xuống dòng khi chỉnh sửa", () => {
    const handleChange = vi.fn();
    render(<CompanyNameCell value="" isReadOnly={false} onChange={handleChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Tên công ty\nMới" } });
    expect(handleChange).toHaveBeenCalledWith("Tên công ty Mới");
  });

  it("tự động mở rộng chiều cao textarea theo nội dung", () => {
    const handleChange = vi.fn();
    render(<CompanyNameCell value="" isReadOnly={false} onChange={handleChange} />);
    const input = screen.getByRole("textbox");
    Object.defineProperty(input, "scrollHeight", {
      configurable: true,
      get: () => 120,
    });

    fireEvent.change(input, {
      target: {
        value: "Công ty cổ phần vận tải và giao nhận quốc tế siêu dài",
      },
    });

    expect(input.style.height).toBe("120px");
  });
});
