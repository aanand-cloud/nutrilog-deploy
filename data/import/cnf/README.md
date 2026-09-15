# Canadian Nutrient File (CNF / FCÉN)

Official open data from Health Canada (2026):

https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109

## Setup

1. Download `cnf_fcen_all-files-data_2026.zip`
2. Unzip into `.tmp/cnf-2026/raw/` (must include `Food_Name.csv` + `Nutrient_Amount.csv`)
3. Build the compact proximates index:

```bash
node scripts/import/build-cnf-proximates.mjs
```

4. Map MealNova food ids → CNF `Food_Code` in `id-map.json`
5. Import curated rows only:

```bash
npm run import:cnf
```

We do **not** dump all ~6k CNF foods into verified overlays. Same rule as CoFID: curated id-map only.

## Note

Much of CNF is derived from USDA with Canadian fortification adjustments. Prefer existing CoFID/IFCT overlays when they already cover a food; use CNF for Canadian-specific or missing cooked items.
