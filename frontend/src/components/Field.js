import React from "react";

/**
 * Generic labelled form field.
 *
 * Props:
 *  - label, name, value, onChange (event handler), required, disabled
 *  - type: input type ("text" default), or "select"
 *  - children: <option>s when type="select"
 *  - testid: data-testid for the input
 */
export function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false,
  testid,
  children,
}) {
  const common = {
    name,
    value,
    onChange,
    required,
    disabled,
    className: "input",
    "data-testid": testid,
  };
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      {type === "select" ? (
        <select id={name} {...common}>
          {children}
        </select>
      ) : (
        <input id={name} type={type} {...common} />
      )}
    </div>
  );
}

export function FieldRow({ children }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}
