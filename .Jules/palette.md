## 2026-07-06 - [Accessible Forms and Focus States]
**Learning:** Many form inputs miss basic keyboard accessibility features and clear labels. Associating `label`s with `htmlFor` pointing to an input's `id` expands the clickable area, and adding consistent focus rings aids keyboard navigation.
**Action:** Always ensure all inputs have explicit associations with their labels, and provide visual indicators (like focus rings) to reflect the focused state for keyboard accessibility.
## 2024-07-08 - Accessible Tab Navigation
**Learning:** By adding `role="tablist"` and `role="tab"` to the main navigation, and using `focus-visible:ring-2` for focus indicators, we create a much more accessible and navigable interface for screen reader and keyboard users without compromising the visual design.
**Action:** Always ensure custom tab-like navigation elements implement the correct ARIA roles and visible focus states.
## 2024-07-10 - Custom Combobox Accessibility
**Learning:** Custom auto-suggest dropdowns require complex ARIA patterns like role="combobox" and role="listbox" with aria-activedescendant to be usable by screen readers.
**Action:** Always implement full WAI-ARIA combobox specs for custom searchable dropdowns, rather than relying on focus alone.
