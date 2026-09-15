# FAO/INFOODS

There is **no single FAO/INFOODS food composition database** to import like CoFID or CNF.

FAO/INFOODS publishes specialist tables, for example:

- Density Database (volume ↔ weight) — not calories/macros
- uPulses — pulses on wet/dry basis
- uFiSh — fish & shellfish
- Regional/national tables linked via INFOODS

For MealNova accuracy we already use:

- **CoFID** (UK dishes & staples)
- **IFCT** (Indian foods)
- **USDA** (selected cooked items)
- **CNF** (Canadian Nutrient File — now supported)

Pizza-type foods are covered better by **CoFID retail/takeaway pizza rows** (and CNF pizza rows where useful) than by FAO specialist tables.

If we later need pulses/fish depth, import a specific FAO Excel (e.g. uPulses) with a curated id-map — not a blanket “INFOODS” dump.
