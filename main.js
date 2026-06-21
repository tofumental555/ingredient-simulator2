// ================================
// 定数（保存版ロジック準拠）
// ================================
const LEVEL_TIME_COEF = 0.002;
const BASE_DIVISOR = 2.222;

const NATURE_SPEED_UP = 0.9;
const NATURE_SPEED_DOWN = 1.075;

const NATURE_FOOD_UP = 1.05;
const NATURE_FOOD_DOWN = 0.95;
const NATURE_SKILL_UP = 1.05;
const NATURE_SKILL_DOWN = 0.95;

const SUB_SPEED_M = 0.86;
const SUB_SPEED_S = 0.93;
const SUB_OTEBONUS = 0.95;

const SUB_FOOD_M = 1.36;
const SUB_FOOD_S = 1.18;
const SUB_SKILL_M = 1.36;
const SUB_SKILL_S = 1.18;

// きのみ基礎値
const BERRY_BASE = {
  "ドラゴン": 35,
  "はがね": 33,
  "どく": 32,
  "こおり": 32,
  "あく": 31,
  "みず": 31,
  "くさ": 30,
  "いわ": 30,
  "じめん": 29,
  "ノーマル": 28,
  "かくとう": 27,
  "ほのお": 27,
  "フェアリー": 26,
  "ゴースト": 26,
  "エスパー": 26,
  "でんき": 25,
  "むし": 24,
  "ひこう": 24
};

const ALL_PATTERNS = ["aaa", "aab", "abb", "abc", "aac", "bbc"];
const PATTERN_LABELS = {
  aaa: "A-A-A",
  aab: "A-A-B",
  abb: "A-B-B",
  abc: "A-B-C",
  aac: "A-A-C",
  bbc: "B-B-C"
};

// ================================
// DB読み込み
// ================================
let pokemonDB = [];
let ingredientEnergyDB = {};

async function loadDB() {
  pokemonDB = await (await fetch("pokemon_data.json")).json();
  ingredientEnergyDB = await (await fetch("ingredient_energy.json")).json();

  populatePokemonSelect();
  populateSubSkillSelects();
  populatePatternSelect();
}

loadDB();

// ================================
// UIセットアップ
// ================================
function populatePokemonSelect() {
  const select = document.getElementById("pokemonSelect");
  select.innerHTML = "";

  pokemonDB.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.textContent = p.name;
    select.appendChild(opt);
  });

  select.addEventListener("change", populatePatternSelect);
}

const SUB_SKILLS = [
  "その他",
  "きのみの数S",
  "おてスピM",
  "おてスピS",
  "おてぼ",
  "食材確率M",
  "食材確率S",
  "スキル確率M",
  "スキル確率S"
];

function populateSubSkillSelects() {
  ["sub10", "sub25", "sub50", "sub75", "sub100"].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = "";
    SUB_SKILLS.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
  });
}

function populatePatternSelect() {
  const patternSelect = document.getElementById("patternSelect");
  const name = document.getElementById("pokemonSelect").value;
  const pokemon = pokemonDB.find(p => p.name === name);

  patternSelect.innerHTML = "";

  const patterns = (pokemon && pokemon.patterns && pokemon.patterns.length > 0)
    ? pokemon.patterns
    : ALL_PATTERNS;

  patterns.forEach(pat => {
    const opt = document.createElement("option");
    opt.value = pat;
    opt.textContent = PATTERN_LABELS[pat] || pat;
    patternSelect.appendChild(opt);
  });
}
// ================================
// 食材1回あたりの「エナジー」期待値
// ================================
function calcIngredientEnergyPerHelp(pokemon, level, pattern) {
  const unlocked = getUnlockedSlots(level);
  const slotProb = 1 / unlocked.length;

  let energy = 0;

  for (const slot of unlocked) {
    const choices = [];

    if (slot === 1) {
      choices.push({ ingredient: pokemon.ingredientA, count: pokemon["1a"] ?? 0 });
    }

    if (slot === 2) {
      const a2 = pokemon["2a"] ?? 0;
      const b2 = pokemon["2b"] ?? 0;

      if (pattern === "aaa" || pattern === "aac")
        choices.push({ ingredient: pokemon.ingredientA, count: a2 });
      else if (pattern === "aab") {
        choices.push({ ingredient: pokemon.ingredientA, count: a2 });
        choices.push({ ingredient: pokemon.ingredientB, count: b2 });
      } else if (pattern === "abb" || pattern === "bbc")
        choices.push({ ingredient: pokemon.ingredientB, count: b2 });
      else {
        choices.push({ ingredient: pokemon.ingredientA, count: a2 });
        choices.push({ ingredient: pokemon.ingredientB, count: b2 });
      }
    }

    if (slot === 3) {
      const a3 = pokemon["3a"] ?? 0;
      const b3 = pokemon["3b"] ?? 0;
      const c3 = pokemon["3c"] ?? 0;

      if (pattern === "aaa")
        choices.push({ ingredient: pokemon.ingredientA, count: a3 });
      else if (pattern === "aab") {
        choices.push({ ingredient: pokemon.ingredientA, count: a3 });
        choices.push({ ingredient: pokemon.ingredientB, count: b3 });
      } else if (pattern === "abb")
        choices.push({ ingredient: pokemon.ingredientB, count: b3 });
      else if (pattern === "abc") {
        choices.push({ ingredient: pokemon.ingredientA, count: a3 });
        choices.push({ ingredient: pokemon.ingredientB, count: b3 });
        choices.push({ ingredient: pokemon.ingredientC, count: c3 });
      } else if (pattern === "aac") {
        choices.push({ ingredient: pokemon.ingredientA, count: a3 });
        choices.push({ ingredient: pokemon.ingredientC, count: c3 });
      } else if (pattern === "bbc") {
        choices.push({ ingredient: pokemon.ingredientB, count: b3 });
        choices.push({ ingredient: pokemon.ingredientC, count: c3 });
      } else {
        choices.push({ ingredient: pokemon.ingredientA, count: a3 });
        choices.push({ ingredient: pokemon.ingredientB, count: b3 });
        choices.push({ ingredient: pokemon.ingredientC, count: c3 });
      }
    }

    if (choices.length === 0) continue;

    const choiceProb = 1 / choices.length;

    for (const c of choices) {
      const per = calcIngredientEnergyPerUnit(c.ingredient);
      energy += slotProb * choiceProb * per * c.count;
    }
  }

  return energy;
}

// ================================
// 食材枠解放
// ================================
function getUnlockedSlots(level) {
  if (level < 30) return [1];
  if (level < 60) return [1, 2];
  return [1, 2, 3];
}

// ================================
// 期待値計算
// ================================
function calcDailyExpectation(pokemon, level, up, down, subs, pattern) {
  const subInfo = analyzeSubSkills(subs);

  const h = Number(pokemon.helpTime ?? 0);
  const levelCoef = 1 - (level - 1) * LEVEL_TIME_COEF;
  const natureTime = applyNatureToTimeFactor(up, down);
  const subTime = buildTimeSubSkillFactor(subInfo);

  const t = (h * levelCoef * natureTime * subTime) / BASE_DIVISOR;
  const hpd = 86400 / t;

  let fr = Number(pokemon.ingredientFindRate ?? 0) / 100;
  let sr = Number(pokemon.skillRate ?? 0) / 100;

  fr *= buildFoodRateFactor(subInfo);
  sr *= buildSkillRateFactor(subInfo);

  fr = applyNatureToFoodRate(fr, up, down);
  sr = applyNatureToSkillRate(sr, up, down);

  fr = Math.max(0, Math.min(1, fr));
  sr = Math.max(0, Math.min(1, sr));

  const berryProb = 1 - fr;

  const berryCount = hpd * berryProb * getBerryCountFactor(pokemon, subInfo.berryPlus);

  // ★ 食材個数（期待値）
  const ingCountPerHelp = calcIngredientCountPerHelp(pokemon, level, pattern);
  const foodCount = hpd * fr * ingCountPerHelp;

  // きのみエナジー
  const b1 = calcBerryEnergyPerOne(pokemon, level);
  const bE = berryCount * b1;

  // 食材エナジー
  const ingE = calcIngredientEnergyPerHelp(pokemon, level, pattern);
  const fE = ingCountPerHelp > 0 ? foodCount * (ingE / ingCountPerHelp) : 0;

  const tot = bE + fE;

  return {
    hpd,
    fr,
    sr,
    berryCount,
    foodCount,
    berryEnergyPerHelp: bE / hpd,
    ingredientEnergyPerHelp: fE / hpd,
    energyPerHelp: tot / hpd,
    dailyEnergy: tot
  };
}
// ================================
// 結果表示
// ================================
function displayResult(r) {
  const box = document.getElementById("result");
  box.classList.add("pks-has-result");

  box.innerHTML = `
    <div class="pks-result-headline">
      <span class="pks-result-num">${Math.round(r.dailyEnergy)}</span>
      <span class="pks-result-unit">エナジー / 日</span>
    </div>

    ・1日の行動回数：${r.hpd.toFixed(2)} 回<br>
    ・食材確率：${(r.fr * 100).toFixed(1)} %<br>
    ・スキル確率：${(r.sr * 100).toFixed(1)} %<br>

    ・きのみ個数（期待値）：${r.berryCount.toFixed(2)} 個 / 日<br>
    ・食材個数（期待値）：${r.foodCount.toFixed(2)} 個 / 日<br>

    ・きのみ期待値（エナジー）：${r.berryEnergyPerHelp.toFixed(1)} / 回<br>
    ・食材期待値（エナジー）：${r.ingredientEnergyPerHelp.toFixed(1)} / 回<br>

    ・1回のおてつだい期待値：${r.energyPerHelp.toFixed(1)} エナジー<br>
  `;
}
