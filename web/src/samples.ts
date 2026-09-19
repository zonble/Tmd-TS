import starter from "./samples/starter.tmd?raw";
import sandiansanye from "./samples/sandiansanye.tmd?raw";
import landingAtTaoyuan from "./samples/landing-at-taoyuan.tmd?raw";
import tchaikovsky54 from "./samples/tchaikovsky-5-4.tmd?raw";
import legacy from "./samples/legacy.tmd?raw";
import aiMoon from "./samples/ai-moon.tmd?raw";

export interface TMDSample {
  id: string;
  name: string;
  category: string;
  content: string;
}

export const SAMPLES: TMDSample[] = [
  {
    id: "starter_template",
    name: "《小星星》(入門示範 / Twinkle Twinkle)",
    category: "Template",
    content: starter,
  },
  {
    id: "sandiansanye",
    name: "《三天三夜》(阿怪 / 張惠妹)",
    category: "Classic Pop / Dance",
    content: sandiansanye,
  },
  {
    id: "landing_at_taoyuan",
    name: "《降落桃園：管弦狂想曲》(Antigravity & zonble)",
    category: "Orchestral / Rhapsody",
    content: landingAtTaoyuan,
  },
  {
    id: "tchaikovsky_5_4",
    name: "《悲愴交響曲第二樂章》(5/4 拍古典名曲 / 柴可夫斯基)",
    category: "Classical / Odd Meter (5/4)",
    content: tchaikovsky54,
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
];
