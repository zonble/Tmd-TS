import sandiansanye from "./samples/sandiansanye.tmd?raw";
import legacy from "./samples/legacy.tmd?raw";
import aiMoon from "./samples/ai-moon.tmd?raw";
import starter from "./samples/starter.tmd?raw";

export interface TMDSample {
  id: string;
  name: string;
  category: string;
  content: string;
}

export const SAMPLES: TMDSample[] = [
  {
    id: "sandiansanye",
    name: "《三天三夜》(阿怪 / 張惠妹)",
    category: "Classic Pop / Dance",
    content: sandiansanye,
  },
  {
    id: "legacy",
    name: "《Legacy》(Post-Rock Epics Version)",
    category: "Post-Rock / Ambient",
    content: legacy,
  },
  {
    id: "ai_moon",
    name: "《月映寒江》(抒情五聲調式)",
    category: "Chamber / Classical",
    content: aiMoon,
  },
  {
    id: "starter_template",
    name: "入門基礎模板 (Starter Template)",
    category: "Template",
    content: starter,
  },
];
