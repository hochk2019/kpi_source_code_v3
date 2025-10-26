import { useEffect } from "react";



/**

 * Đồng bộ thuộc tính title dựa vào data-tooltip/aria-label để tooltip hiển thị thống nhất.

 * Hạn chế tình trạng tooltip chồng chéo giữa native title và UI library.

 */

export function useTooltipTitles(rootRef, deps = []) {

  useEffect(() => {

    const root = rootRef?.current;

    if (!root) return;



    const ensureTitle = (element, content) => {

      if (!content) return;

      if (element.getAttribute("title") === content) return;

      element.setAttribute("title", content);

    };



    const tooltipNodes = root.querySelectorAll("[data-tooltip]");

    tooltipNodes.forEach((node) => {

      if (!(node instanceof HTMLElement)) return;

      const tooltip = node.getAttribute("data-tooltip");

      if (tooltip) {

        ensureTitle(node, tooltip);

      }

    });



    const ariaButtons = root.querySelectorAll("button[aria-label]");

    ariaButtons.forEach((button) => {

      if (!(button instanceof HTMLElement)) return;

      const ariaLabel = button.getAttribute("aria-label");

      if (ariaLabel) {

        ensureTitle(button, ariaLabel);

      }

    });



    const fallbackButtons = root.querySelectorAll(

      "button:not([data-tooltip]):not([aria-label])"

    );

    fallbackButtons.forEach((button) => {

      if (!(button instanceof HTMLElement)) return;

      const text = (button.textContent || "").trim();

      if (text) {

        ensureTitle(button, text);

      }

    });

  }, [rootRef, deps]);

}



export default useTooltipTitles;

