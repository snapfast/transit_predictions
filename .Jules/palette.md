## 2026-07-06 - [Accessible Forms and Focus States]
**Learning:** Many form inputs miss basic keyboard accessibility features and clear labels. Associating `label`s with `htmlFor` pointing to an input's `id` expands the clickable area, and adding consistent focus rings aids keyboard navigation.
**Action:** Always ensure all inputs have explicit associations with their labels, and provide visual indicators (like focus rings) to reflect the focused state for keyboard accessibility.
## 2024-07-08 - Accessible Tab Navigation
**Learning:** By adding `role="tablist"` and `role="tab"` to the main navigation, and using `focus-visible:ring-2` for focus indicators, we create a much more accessible and navigable interface for screen reader and keyboard users without compromising the visual design.
**Action:** Always ensure custom tab-like navigation elements implement the correct ARIA roles and visible focus states.
## 2024-07-10 - Custom Combobox Accessibility
**Learning:** Custom auto-suggest dropdowns require complex ARIA patterns like role="combobox" and role="listbox" with aria-activedescendant to be usable by screen readers.
**Action:** Always implement full WAI-ARIA combobox specs for custom searchable dropdowns, rather than relying on focus alone.
## 2026-07-06 - [Accessible Toggle Buttons]
**Learning:** Custom toggle buttons (acting as segmented controls) miss context when screen readers interpret them as simple buttons. Adding `role="group"` to the parent container with an `aria-label`, and `aria-pressed={true/false}` on individual options creates a proper accessible radio/toggle group without needing native `<input type="radio">` tags.
**Action:** Whenever replacing native radios with stylized custom buttons, ensure the container has `role="group"` and `aria-label`, and the buttons have `aria-pressed` to communicate selection state.
## 2024-07-12 - [SVG Chart Accessibility]
**Learning:** Complex custom SVG charts in this application (like the Kundli charts and timeline graphs) must explicitly declare `role="img"` and `aria-label`. Without these attributes, screen readers may either ignore them or read out confusing raw text coordinates and elements.
**Action:** Always add `role="img"` and descriptive `aria-label` attributes to informative `<svg>` elements, especially those rendering charts or graphs.
## 2024-07-13 - [Combobox Option Focus and Keyboard Interception]
**Learning:** For custom combobox options (like the city suggestions dropdowns), using interactive elements like `<button>` inside a `role="listbox"` can disrupt the tab navigation flow. Screen readers expect focus to remain on the input field while traversing options using `aria-activedescendant`. Adding `tabIndex={-1}` and `type="button"` ensures these options do not intercept focus during regular navigation. Also, screen readers benefit from `aria-busy` to announce dynamically loading data.
**Action:** When implementing custom comboboxes, always set `tabIndex={-1}` on suggestion items when managing focus via the input (`aria-activedescendant`), and utilize `aria-busy` for loading states to provide a smoother and compliant keyboard/screen reader experience.
## 2024-07-14 - [Range Slider Reset UX]
**Learning:** For interactive range sliders with a definitive "default" or "zero" state (like scrubbing days from the current date), forcing users to manually drag the handle exactly back to zero can be frustrating and imprecise. Providing a clear, single-click "Reset" button improves usability significantly.
**Action:** When implementing range sliders (`<input type="range">`) that adjust offsets from a baseline, always provide a supplementary button to reset the value back to the baseline.
