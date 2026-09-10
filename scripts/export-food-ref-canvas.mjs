import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FOOD_REFERENCES } from '../shared/food-references.js';

function aliases(re) {
  const src = re instanceof RegExp ? re.source : String(re?.source || re);
  return src
    .split('|')
    .slice(0, 3)
    .map((s) => s.replace(/\\b/g, '').replace(/\\s\+/g, ' ').trim())
    .join(' · ');
}

function region(id) {
  if (/jollof|egusi|suya|moi|ofada|amala|waakye|banku|nyama|doro|injera|fufu|plantain|ackee|saltfish|doubles|pelau|pepper_soup|nigerian|ghana|kenyan|ethiopian|african/.test(id)) {
    return 'African & Caribbean';
  }
  if (/adobo|sinigang|lechon|pancit|mee_goreng|laksa|nasi|rendang|satay|pho|banh|dim_sum|congee|kung_pao|chow_mein|lo_mein|ramen|gyoza|sushi|maki|teriyaki|katsu|karaage|yakitori|tonkotsu|miso|biryani|tikka|tandoori|korma|madras|dal|paneer|dosa|idli|sambar|chutney|raita|roti|naan|paratha|samosa|pakora|vada|chettinad|kadai|butter_chicken|masala|gulab|jalebi|halwa|kulfi|kheer|indian/.test(id)) {
    return 'South & East Asian';
  }
  if (/taco|burrito|nachos|enchilada|quesadilla|tamale|empanada|ceviche|feijoada|arepa|guacamole|salsa|tortilla|black_beans|refried/.test(id)) {
    return 'Latin American';
  }
  if (/fish_and_chips|bacon|sausage|full_english|sunday_roast|shepherds|bangers|mash|yorkshire|cornish|scotch_egg|ploughmans|jacket|beans_on_toast|crumpet|scone|sticky_toffee|banoffee|eton|roast|pie|pastie|parmo|battered/.test(id)) {
    return 'British & Irish';
  }
  if (/burger|mac_and|hot_dog|bbq|buffalo|philly|meatloaf|pancake|waffle|bagel|donut|cookie|brownie|cheesecake|grilled_cheese|clam_chowder|jambalaya|cobb|ribs|steak|fried_chicken|southern/.test(id)) {
    return 'North American';
  }
  if (/carbonara|bolognese|margherita|pizza|pasta|risotto|lasagna|gnocchi|tiramisu|bruschetta|caprese|paella|tapas|gazpacho|croissant|baguette|quiche|crepe|fondue|schnitzel|goulash|borscht|hummus|falafel|shawarma|kebab|baklava|kunefe|turkish/.test(id)) {
    return 'European & Middle Eastern';
  }
  if (/cake|cookie|ice_cream|chocolate|dessert|pudding|sweet|donut|mochi|falooda|pie|brownie|cheesecake|jamun|jalebi|halwa|kulfi|kheer|sundae|lava_cake|mooncake|egg_tart/.test(id)) {
    return 'Desserts & sweets';
  }
  if (/coffee|tea|latte|juice|smoothie|cola|beer|wine|whisky|water|shake|lassi|horlicks|ovaltine|milk|hot_chocolate|chai|drink|sprite|fanta/.test(id)) {
    return 'Drinks';
  }
  if (/rice|noodle|bread|toast|oat|cereal|porridge|egg|pancake|waffle|bagel|muffin|croissant|sandwich|wrap|bowl|plain_rice|fried_rice|potato|vegetable|salad|soup|broccoli|beans|lentil|cheese|yogurt|fruit|nut|side_/.test(id)) {
    return 'Sides, carbs & basics';
  }
  return 'Global & other';
}

const items = FOOD_REFERENCES.map((r) => [r.id, r.kcal100, r.protein100, aliases(r.re), region(r.id)]);
const regions = {};
for (const [, , , , reg] of items) regions[reg] = (regions[reg] || 0) + 1;
const pie = Object.entries(regions)
  .sort((a, b) => b[1] - a[1])
  .map(([name, value]) => ({ name, value }));

const canvas = `import {
  BarChart,
  Card,
  CardBody,
  CardHeader,
  H1,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useHostTheme,
  useMemo,
  useState,
} from 'cursor/canvas';

const REFS = ${JSON.stringify(items)} as const;
const REGION_COUNTS = ${JSON.stringify(pie)} as const;

export default function MealNovaFoodRefs() {
  const theme = useHostTheme();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return REFS.slice(0, 200);
    return REFS.filter(([id, , , aliasText]) => id.includes(needle) || aliasText.toLowerCase().includes(needle)).slice(0, 300);
  }, [q]);

  return (
    <Stack gap={16} style={{ padding: 16, color: theme.fg, background: theme.bg }}>
      <H1>MealNova reference dishes</H1>
      <Text tone="muted">Source: shared/food-references.js · ${items.length} entries · per-100g macros</Text>
      <Row gap={12} wrap>
        <Stat label="Total dishes" value="${items.length}" />
        <Stat label="Shown" value={String(filtered.length)} tone={q ? 'accent' : 'default'} />
        <Stat label="Sub-catalogs" value="7" tone="muted" />
      </Row>
      <Card>
        <CardHeader title="By region" />
        <CardBody>
          <BarChart
            data={REGION_COUNTS.map((r) => ({ label: r.name, value: r.value }))}
            height={220}
            caption="Heuristic grouping by reference id · ${items.length} total refs"
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Search full library" trailing={<Pill tone="muted">type to filter</Pill>} />
        <CardBody>
          <Stack gap={12}>
            <TextInput value={q} onChange={setQ} placeholder="Search id or alias e.g. biryani, jollof, latte…" />
            <Table
              columns={[
                { key: 'id', header: 'Reference ID', width: '28%' },
                { key: 'aliases', header: 'Match aliases (sample)', width: '42%' },
                { key: 'kcal', header: 'kcal/100g', align: 'right', width: '15%' },
                { key: 'protein', header: 'Protein/100g', align: 'right', width: '15%' },
              ]}
              rows={filtered.map(([id, kcal, protein, aliasText]) => ({
                id,
                aliases: aliasText || '—',
                kcal: String(kcal),
                protein: protein + 'g',
              }))}
            />
            {!q && <Text tone="muted">Showing first 200 of ${items.length}. Search to browse the full list.</Text>}
            {q && filtered.length === 300 && <Text tone="muted">Results capped at 300 — refine your search.</Text>}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
`;

const canvasDir = 'C:/Users/user/.cursor/projects/c-Users-user-Projects-visanova/canvases';
mkdirSync(canvasDir, { recursive: true });
writeFileSync(resolve(canvasDir, 'mealnova-food-refs.canvas.tsx'), canvas);

const jsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '../food-reference-list.json');
writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      total: items.length,
      updated: new Date().toISOString().slice(0, 10),
      items: FOOD_REFERENCES.map((r) => ({
        id: r.id,
        aliases: aliases(r.re),
        kcal100: r.kcal100,
        protein100: r.protein100,
        carbs100: r.carbs100,
        fat100: r.fat100,
        fibre100: r.fibre100,
        region: region(r.id),
      })),
    },
    null,
    2,
  ),
);

console.log(`Exported ${items.length} refs`);
console.log(`Canvas: ${resolve(canvasDir, 'mealnova-food-refs.canvas.tsx')}`);
console.log(`JSON: ${jsonPath}`);
