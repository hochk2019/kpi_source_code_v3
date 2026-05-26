import * as React from "react";

const stripProps = (props) => {
  const { asChild, sideOffset, align, side, alignOffset, collisionPadding, sticky, hideWhenDetached, avoidCollisions, updatePositionStrategy, onInteractOutside, onPointerDownOutside, onFocusOutside, onEscapeKeyDown, onOpenAutoFocus, onCloseAutoFocus, forceMount, ...domProps } = props;
  return domProps;
};

export const Root = ({ children, open }) => React.createElement("div", { "data-state": open ? "open" : "closed", "data-mock": "popover-root" }, children);
export const Trigger = React.forwardRef((props, ref) => props.asChild ? props.children : React.createElement("button", { ...stripProps(props), ref }, props.children));
export const Anchor = React.forwardRef((props, ref) => props.asChild ? props.children : React.createElement("div", { ...stripProps(props), ref }, props.children));
export const Portal = ({ children }) => React.createElement("div", { "data-mock": "popover-portal" }, children);
export const Content = React.forwardRef((props, ref) => React.createElement("div", { ...stripProps(props), ref, "data-mock": "popover-content", role: "dialog" }, props.children));
export const Close = React.forwardRef((props, ref) => props.asChild ? props.children : React.createElement("button", { ...stripProps(props), ref }, props.children));
export const Arrow = React.forwardRef((props, ref) => React.createElement("div", { ...stripProps(props), ref }));
