import React from 'react';

export const Popover = ({ children, open }) => (open !== undefined ? (open ? <div data-testid="mock-popover">{children}</div> : null) : <div data-testid="mock-popover">{children}</div>);
export const PopoverTrigger = ({ children, onClick }) => <div data-testid="mock-popover-trigger" onClick={onClick}>{children}</div>;
export const PopoverContent = ({ children }) => <div data-testid="mock-popover-content">{children}</div>;
