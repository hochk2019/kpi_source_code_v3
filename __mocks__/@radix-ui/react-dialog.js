import * as React from "react";

// Radix props to strip from DOM elements
const stripProps = (props) => {
  const { asChild, sideOffset, align, side, alignOffset, collisionPadding, sticky, hideWhenDetached, avoidCollisions, updatePositionStrategy, onInteractOutside, onPointerDownOutside, onFocusOutside, onEscapeKeyDown, onOpenAutoFocus, onCloseAutoFocus, forceMount, ...domProps } = props;
  return domProps;
};

export const Root = ({ children, open }) => React.createElement("div", { "data-state": open ? "open" : "closed", "data-mock": "dialog-root" }, children);
export const Trigger = React.forwardRef((props, ref) => props.asChild ? props.children : React.createElement("button", { ...stripProps(props), ref }, props.children));
export const Portal = ({ children }) => React.createElement("div", { "data-mock": "dialog-portal" }, children);
export const Overlay = React.forwardRef((props, ref) => React.createElement("div", { ...stripProps(props), ref }));
export const Content = React.forwardRef((props, ref) => React.createElement("div", { ...stripProps(props), ref, "data-mock": "dialog-content", role: "dialog" }, props.children));
export const Title = React.forwardRef((props, ref) => React.createElement("h2", { ...stripProps(props), ref }));
export const Description = React.forwardRef((props, ref) => React.createElement("p", { ...stripProps(props), ref }));
export const Close = React.forwardRef((props, ref) => props.asChild ? props.children : React.createElement("button", { ...stripProps(props), ref }, props.children));
