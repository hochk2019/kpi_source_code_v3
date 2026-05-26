import React from 'react';

export const Command = ({ children }) => <div data-testid="mock-command">{children}</div>;
export const CommandInput = (props) => <input data-testid="mock-command-input" {...props} />;
export const CommandList = ({ children }) => <div data-testid="mock-command-list">{children}</div>;
export const CommandEmpty = ({ children }) => <div data-testid="mock-command-empty">{children}</div>;
export const CommandGroup = ({ children, heading }) => <div data-testid="mock-command-group" data-heading={heading}>{heading}{children}</div>;
export const CommandItem = ({ children, onSelect, value }) => (
  <div 
    data-testid="mock-command-item" 
    data-value={value} 
    onClick={() => onSelect && onSelect(value)}
  >
    {children}
  </div>
);
