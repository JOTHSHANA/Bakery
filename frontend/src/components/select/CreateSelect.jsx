import React, { useMemo, forwardRef } from "react";
import CreatableSelect from "react-select/creatable";
import { debounce } from "lodash";
import { getSelectStyles } from "../appLayout/theme/selectTheme";
import { useThemeToggle } from "../appLayout/theme/toggleTheme"; // assuming you manage darkMode here

const CustomCreatableSelect = forwardRef(
  (
    {
      className = "",
      placeholder = "Select...",
      value,
      onInputChange,
      onChange,
      options = [],
    },
    ref
  ) => {
    const { darkMode } = useThemeToggle();

    const debouncedInputChange = useMemo(
      () => debounce(onInputChange, 300),
      [onInputChange]
    );

    return (
      <CreatableSelect
        ref={ref}
        className={className}
        styles={getSelectStyles(darkMode)}
        theme={(base) => ({
          ...base,
          borderRadius: 6,
          colors: {
            ...base.colors,
            primary: "#178a84",
            neutral0: darkMode ? "#1f1f1f" : "#fff",
            neutral80: darkMode ? "#e6e6e6" : "#191c24",
          },
        })}
        placeholder={placeholder}
        value={value}
        onInputChange={debouncedInputChange}
        onChange={onChange}
        isClearable
        options={options}
      />
    );
  }
);

export default CustomCreatableSelect;


