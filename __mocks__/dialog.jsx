import React from 'react';

export const Dialog = ({ children, open }) => (open ? <div data-testid="mock-dialog">{children}</div> : null);
export const DialogTrigger = ({ children, onClick }) => <div data-testid="mock-dialog-trigger" onClick={onClick}>{children}</div>;
export const DialogContent = ({ children }) => <div data-testid="mock-dialog-content">{children}</div>;
export const DialogHeader = ({ children }) => <div>{children}</div>;
export const DialogTitle = ({ children }) => <div>{children}</div>;
export const DialogFooter = ({ children }) => <div>{children}</div>;
export const DialogClose = ({ children }) => <div>{children}</div>;
export const DialogOverlay = () => null;
export const DialogPortal = ({ children }) => children;
