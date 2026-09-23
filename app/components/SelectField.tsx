// Select com label visível padronizado (F2.8/F2.9 — consistência AAA).
// Preserva id/ref/value/onChange/children repassados; só unifica o invólucro.
import type {
  ReactNode,
  Ref,
  SelectHTMLAttributes,
} from "react";

interface SelectFieldProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  labelClassName?: string;
  wrapperClassName?: string;
  selectRef?: Ref<HTMLSelectElement>;
  children: ReactNode;
}

export default function SelectField({
  id,
  label,
  labelClassName,
  wrapperClassName,
  selectRef,
  children,
  className,
  ...rest
}: SelectFieldProps) {
  return (
    <div className={wrapperClassName}>
      <label
        htmlFor={id}
        className={
          labelClassName ??
          "block text-xs font-medium text-ink-soft mb-1"
        }
      >
        {label}
      </label>
      <select
        id={id}
        ref={selectRef}
        {...rest}
        className={className ?? "input-field w-full min-h-11 text-sm"}
      >
        {children}
      </select>
    </div>
  );
}
