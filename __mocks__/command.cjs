const React = require('react');

module.exports = {
  Command: ({ children }) => React.createElement("div", { "data-testid": "mock-command" }, children),
  CommandInput: ({ value, onValueChange, placeholder, ...props }) => React.createElement("input", { 
    "data-testid": "mock-command-input", 
    value: value || '', 
    onChange: (e) => onValueChange && onValueChange(e.target.value), 
    placeholder, 
    ...props 
  }),
  CommandList: ({ children }) => React.createElement("div", { "data-testid": "mock-command-list" }, children),
  CommandEmpty: ({ children }) => React.createElement("div", { "data-testid": "mock-command-empty" }, children),
  CommandGroup: ({ children, heading }) => React.createElement("div", { "data-testid": "mock-command-group", "data-heading": heading }, heading, children),
  CommandItem: ({ children, onSelect, value }) => React.createElement("div", { 
    "data-testid": "mock-command-item", 
    "data-value": value, 
    onClick: () => onSelect && onSelect(value) 
  }, children),
};
