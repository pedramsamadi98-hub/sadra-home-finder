import { detectLand } from "../lib/land";
import { parseSmartQuery } from "../lib/smart-search";
const ocr = ["زمین باغشهر پردیس پلاک ۲۲","زمین مولانا پلاک ۱۳۲","زمین البرز ۳ پلاک ۴۵","زمین نیروانتظامی فاز ۲","زمین مولانا ملکی پلاک 22/الف","زمین فاز 2 زون پلاک ۱۳۲","آپارتمان ۱۲۰ متری فاز ۱"];
for (const t of ocr) console.log(t, "=>", JSON.stringify(detectLand(t)));
console.log("---");
for (const q of ["زمین باغشهر پردیس پلاک ۲۲","زمین مسکونی فاز ۱ البرز ۳","زمین فاز ۲ زون پلاک ۱۳۲","آپارتمان ۳ خواب فاز ۲ بین ۱۲۰ تا ۱۵۰ متر تا ۱۲ میلیارد پارکینگ","فقط ملکی فاز ۲ دوخوابه"]) {
  const p = parseSmartQuery(q);
  console.log(q, "=>", p.criteria.map(c=>`${c.key}=${c.value}`).join(" | "), "|| rest:", JSON.stringify(p.rest));
}
